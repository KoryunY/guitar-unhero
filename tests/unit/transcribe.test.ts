/**
 * M4 evaluation on *synthetic* guitar-like recordings (not a hardware result).
 * Spec gate for enabling the feature beyond candidate review: note F1 ≥ 0.85.
 */
import { describe, expect, it } from 'vitest';
import { buildCandidate, estimateTempo, noteF1, quantize, transcribeRaw } from '../../src/audio/transcribe';
import { validateScore } from '../../src/domain/validate';
import { guitarLike, midiHz, mix, placeAt, whiteNoise } from '../fixtures/signals';

const SR = 44100;
const rights = { status: 'user_declared' as const, author: 'me', license: null, allowedUses: ['local_practice' as const, 'modify' as const], sourceUri: null, evidence: 'Own playing.' };

function melody(bpm: number, pattern: [number, number][], lead = 0.7) {
  const beat = 60 / bpm;
  let t = lead;
  const ref: { onsetSec: number; offsetSec: number; midi: number }[] = [];
  const items: { atSec: number; sig: Float32Array }[] = [];
  pattern.forEach(([midi, beats], i) => {
    const dur = beats * beat;
    const sig = guitarLike(SR, midiHz(midi), dur, { seed: i + 3, glideCents: 10 });
    const fade = Math.round(0.015 * SR);
    for (let k = 0; k < fade; k++) sig[sig.length - fade + k]! *= 1 - k / fade;
    items.push({ atSec: t, sig });
    ref.push({ onsetSec: t, offsetSec: t + dur, midi });
    t += dur;
  });
  const total = t + 1;
  return { pcm: mix(placeAt(SR, total, items), whiteNoise(SR, total, 0.0008)), ref, beat, lead };
}

const MORNING: [number, number][] = [[64, 1], [65, 1], [67, 2], [65, 1], [64, 1], [62, 2], [60, 1], [62, 1], [64, 2], [62, 1], [60, 1], [59, 2]];

describe('experimental monophonic transcription (M4)', () => {
  it('reaches the note F1 gate on a clean synthetic melody and reports offsets separately', () => {
    const { pcm, ref } = melody(80, MORNING);
    const raw = transcribeRaw(pcm, SR);
    const on = noteF1(ref, raw.notes);
    const off = noteF1(ref, raw.notes, true);
    process.stderr.write(`\nTRANSCRIBE clean: onset/pitch F1=${on.f1.toFixed(3)} (P=${on.precision.toFixed(2)} R=${on.recall.toFixed(2)}), with offsets F1=${off.f1.toFixed(3)}, uncertain=${raw.uncertain.length}, ${raw.elapsedMs} ms\n`);
    expect(on.f1).toBeGreaterThanOrEqual(0.85);
  });

  it('estimates tempo (or a half/double alternative) and downbeat, then builds a valid candidate', () => {
    const { pcm, beat, lead } = melody(80, MORNING);
    const raw = transcribeRaw(pcm, SR);
    const tempo = estimateTempo(raw.notes.map((n) => n.onsetSec))!;
    const candidates = [tempo.bpm, ...tempo.alternatives];
    expect(candidates.some((b) => Math.abs(b - 80) <= 2)).toBe(true);
    const q = quantize(raw.notes, { bpm: 80, firstBeatSec: lead, division: 2 });
    expect(q.slice(0, 4).map((x) => x.startTick)).toEqual([0, 960, 1920, 3840]);
    const c = buildCandidate({ arrangementId: 'user.t1.candidate', title: 'Take 1', quantized: q, bpm: 80, firstBeatSec: lead, rights, source: { assetId: 'a1', sha256: 'a'.repeat(64), durationSec: pcm.length / SR } });
    expect(c.score).not.toBeNull();
    expect(c.score!.role).toBe('transcription_candidate');
    expect(c.score!.provenance).toMatchObject({ method: 'model_candidate', reviewStatus: 'unreviewed', providerId: 'gu-dsp-mono', modelArtifactSha256: null });
    const r = validateScore(JSON.parse(JSON.stringify(c.score)));
    expect(r.issues).toEqual([]);
    void beat;
  });

  it('silence and noise produce no notes rather than invented ones', () => {
    const raw = transcribeRaw(whiteNoise(SR, 4, 0.01), SR);
    expect(raw.notes).toHaveLength(0);
    expect(buildCandidate({ arrangementId: 'x', title: 'x', quantized: [], bpm: 60, firstBeatSec: 0, rights }).reason).toBe('low_signal');
  });
});
