/**
 * Robustness evaluation on more realistic *synthetic* guitar-like signals:
 * inharmonic partials, attack glide, room echo, hum, noise at several SNRs,
 * low level and fast repeated notes. A proxy for AC-08 until real recordings
 * exist; results are printed as a report and gated at conservative levels.
 */
import { describe, expect, it } from 'vitest';
import { StreamAnalyzer } from '../../src/audio/dsp/analyzer';
import type { AttackObservation, PitchFrame } from '../../src/audio/observations';
import { guitarLike, midiHz, mix, placeAt, reverb, rms, scale, sine, whiteNoise } from '../fixtures/signals';

interface Case { name: string; sig: Float32Array; notes: { t: number; midi: number }[] }

function analyze(sig: Float32Array, sr: number) {
  const an = new StreamAnalyzer({ sampleRate: sr });
  const attacks: AttackObservation[] = [];
  const frames: PitchFrame[] = [];
  for (let o = 0; o < sig.length; o += 512) {
    for (const x of an.push(sig.subarray(o, o + 512), o)) {
      if (x.type === 'attack') attacks.push(x.attack);
      else frames.push(x.frame);
    }
  }
  return { attacks, frames };
}

/** One-to-one match of expected notes to attacks within ±50 ms. */
function score(c: Case, attacks: AttackObservation[]) {
  const used = new Set<string>();
  let detected = 0, pitchOk = 0, pitchTight = 0, assessable = 0;
  for (const n of c.notes) {
    const a = attacks.find((x) => !used.has(x.id) && Math.abs(x.onsetContextSec - n.t) <= 0.05);
    if (!a) continue;
    used.add(a.id);
    detected++;
    if (process.env.GU_DEBUG) process.stderr.write(`  note ${n.midi} @${n.t.toFixed(2)} → ${a.onsetContextSec.toFixed(3)} ${a.pitchMidiFloat?.toFixed(2)} ${a.quality} ${a.reasonCodes.join(',')} frames=${a.frames}\n`);
    if (a.quality === 'good' && a.pitchMidiFloat !== null) {
      assessable++;
      const cents = Math.abs((a.pitchMidiFloat - n.midi) * 100);
      if (cents <= 50) pitchOk++;
      if (cents <= 15) pitchTight++;
    }
  }
  const extras = attacks.length - used.size;
  return { recall: detected / c.notes.length, precision: attacks.length ? used.size / attacks.length : 1, pitchOk: assessable ? pitchOk / assessable : null, pitchTight: assessable ? pitchTight / assessable : null, coverage: assessable / c.notes.length, extras };
}

const SR = 48000;
const MELODY = [64, 65, 67, 64, 59, 60, 62, 59, 55, 57, 50, 52, 45, 47, 40, 43];

const stringOf = (m: number) => (m >= 64 ? 1 : m >= 59 ? 2 : m >= 55 ? 3 : m >= 50 ? 4 : m >= 45 ? 5 : 6);

/**
 * Notes on the same string cut the previous note (fretting a new note stops it);
 * notes on another string let the previous one keep ringing, as on a guitar.
 */
function melodyCase(name: string, opts: { gap?: number; transform?: (s: Float32Array) => Float32Array; level?: number; seedOffset?: number } = {}): Case {
  const gap = opts.gap ?? 0.6;
  const notes = MELODY.map((m, i) => ({ t: 0.4 + i * gap, midi: m }));
  const total = 0.4 + MELODY.length * gap + 1.5;
  const items = notes.map((n, i) => {
    const next = notes[i + 1];
    const sameStringNext = next && stringOf(next.midi) === stringOf(n.midi);
    const len = sameStringNext ? gap : 1.6;
    const sig = guitarLike(SR, midiHz(n.midi), len, { amp: opts.level ?? 0.35, seed: i + 1 + (opts.seedOffset ?? 0), glideCents: 10 + (i % 3) * 5, inharmonicity: n.midi < 50 ? 0.0002 : 0.0006 });
    if (sameStringNext) {
      const fade = Math.round(0.015 * SR);
      for (let k = 0; k < fade; k++) sig[sig.length - fade + k]! *= 1 - k / fade;
    }
    return { atSec: n.t, sig };
  });
  let sig = placeAt(SR, total, items);
  if (opts.transform) sig = opts.transform(sig);
  return { name, sig, notes };
}

function noiseAt(sig: Float32Array, snrDb: number, seed: number): Float32Array {
  const target = rms(sig) / 10 ** (snrDb / 20);
  const n = whiteNoise(SR, sig.length / SR, 1, seed);
  return mix(sig, scale(n, target / rms(n)));
}

const CASES: { c: Case; minRecall: number; minPitchOk: number }[] = [
  { c: melodyCase('clean, 0.6 s apart'), minRecall: 0.9, minPitchOk: 0.95 },
  { c: melodyCase('room echo', { transform: (s) => reverb(s, SR, 0.4) }), minRecall: 0.9, minPitchOk: 0.95 },
  { c: melodyCase('50 Hz hum', { transform: (s) => mix(s, sine(SR, 50, s.length / SR, 0.02)) }), minRecall: 0.9, minPitchOk: 0.95 },
  { c: melodyCase('SNR 30 dB', { transform: (s) => noiseAt(s, 30, 5) }), minRecall: 0.9, minPitchOk: 0.95 },
  { c: melodyCase('SNR 20 dB', { transform: (s) => noiseAt(s, 20, 6) }), minRecall: 0.85, minPitchOk: 0.9 },
  { c: melodyCase('quiet (−30 dBFS peak)', { level: 0.03, transform: (s) => mix(s, whiteNoise(SR, s.length / SR, 0.0003, 9)) }), minRecall: 0.85, minPitchOk: 0.9 },
  { c: melodyCase('fast 8ths at 120 BPM', { gap: 0.25 }), minRecall: 0.85, minPitchOk: 0.85 },
];

describe('robustness on guitar-like synthetic signals (AC-08 proxy, not a hardware result)', () => {
  for (const { c, minRecall, minPitchOk } of CASES) {
    it(c.name, () => {
      const { attacks } = analyze(c.sig, SR);
      const r = score(c, attacks);
      process.stderr.write(
        `\nROBUSTNESS ${c.name.padEnd(24)} recall=${r.recall.toFixed(2)} precision=${r.precision.toFixed(2)} coverage=${r.coverage.toFixed(2)} pitch±50c=${r.pitchOk?.toFixed(2)} pitch±15c=${r.pitchTight?.toFixed(2)} extras=${r.extras}\n`,
      );
      expect(r.recall).toBeGreaterThanOrEqual(minRecall);
      expect(r.pitchOk ?? 0).toBeGreaterThanOrEqual(minPitchOk);
      expect(r.extras).toBeLessThanOrEqual(2);
    });
  }

  it('noise at SNR 10 dB yields fewer assessed notes rather than wrong ones', () => {
    const c = melodyCase('SNR 10 dB', { transform: (s) => noiseAt(s, 10, 8) });
    const r = score(c, analyze(c.sig, SR).attacks);
    process.stderr.write(`\nROBUSTNESS SNR 10 dB                 recall=${r.recall.toFixed(2)} coverage=${r.coverage.toFixed(2)} pitch±50c=${r.pitchOk?.toFixed(2)}\n`);
    // Honesty: whatever is assessed must be right; coverage may drop.
    expect(r.pitchOk ?? 1).toBeGreaterThanOrEqual(0.9);
  });
});
