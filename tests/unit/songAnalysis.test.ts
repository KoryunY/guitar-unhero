/**
 * Full-song analysis on *synthetic* band-like mixes (additive keys, bass and a
 * vibrato "voice", noise-burst drums, room reverb). These are repeatable but
 * do not certify accuracy on real recordings. Measured numbers are logged.
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeSong,
  analyzeSongDetailed,
  chordScores,
  decodeChords,
  estimateTempo,
  estimateTuning,
  keyFromProfile,
  localPeriods,
  localScore,
  RealFFT,
  ResampledReader,
  segmentNotes,
  segmentSections,
  stateLabel,
  trackBeats,
  MELODY_PARAMS,
  type SongAnalysis,
} from '../../src/audio/song';
import { KK_MAJOR } from '../../src/audio/song/key';
import { renderSong, type SongOptions, type SynthSong } from '../fixtures/songSynth';
import { silence, whiteNoise } from '../fixtures/signals';

const log = (s: string) => process.stderr.write(`\nSONG ${s}`);

// ---------- metrics ----------

function beatScores(ref: number[], est: number[], tol: number) {
  const near = (t: number, arr: number[]) => arr.some((x) => Math.abs(x - t) <= tol);
  return {
    recall: ref.filter((r) => near(r, est)).length / Math.max(1, ref.length),
    precision: est.filter((e) => near(e, ref)).length / Math.max(1, est.length),
  };
}

const family = (q: string) => (q === 'min' || q === 'min7' ? 'min' : q === 'N' ? 'N' : q === '5' ? '5' : 'maj');

/** Fraction of chord-bearing beats whose label at mid-beat has the right root and maj/min family. */
function chordAccuracy(s: SynthSong, a: SongAnalysis): number {
  let ok = 0;
  let n = 0;
  s.beats.forEach((b, i) => {
    const ref = s.beatChords[i];
    if (!ref) return;
    n++;
    const ibi = (s.beats[i + 1] ?? b + 0.6) - b;
    const mid = b + ibi / 2;
    const seg = a.chords.find((c) => c.startSec <= mid && c.endSec > mid);
    if (seg && seg.root === ref.root && family(seg.quality) === family(ref.quality)) ok++;
  });
  return ok / Math.max(1, n);
}

/** Note F1: onset within ±tol and exact MIDI pitch, one-to-one. */
function noteF1(ref: { startSec: number; midi: number }[], est: { startSec: number; midi: number }[], tol = 0.06) {
  const used = new Set<number>();
  let tp = 0;
  for (const r of ref) {
    const i = est.findIndex((e, k) => !used.has(k) && e.midi === r.midi && Math.abs(e.startSec - r.startSec) <= tol);
    if (i >= 0) {
      used.add(i);
      tp++;
    }
  }
  const p = tp / Math.max(1, est.length);
  const r = tp / Math.max(1, ref.length);
  return { f1: p + r > 0 ? (2 * p * r) / (p + r) : 0, precision: p, recall: r };
}

/** Fraction of chord-bearing beats where the bass note sounding mid-beat has the chord root's pitch class. */
function bassRootAccuracy(s: SynthSong, a: SongAnalysis): number {
  let ok = 0;
  let n = 0;
  s.beats.forEach((b, i) => {
    const ref = s.beatChords[i];
    if (!ref) return;
    n++;
    const mid = b + ((s.beats[i + 1] ?? b + 0.6) - b) / 2;
    const note = a.bass.find((x) => x.startSec <= mid && x.endSec > mid);
    if (note && ((note.midi % 12) + 12) % 12 === ref.root) ok++;
  });
  return ok / Math.max(1, n);
}

const BAND = { inversions: true, reverb: 0.25, drumGain: 1.3, melody: true } as const;

// ---------- components ----------

describe('song analysis components', () => {
  it('real FFT magnitude matches a direct DFT', () => {
    const N = 64;
    const x = Array.from({ length: N }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1) + (i % 5) * 0.01);
    const mag = new Float32Array(N / 2 + 1);
    new RealFFT(N).magnitude(x, mag);
    for (let k = 0; k <= N / 2; k++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        re += x[n]! * Math.cos((2 * Math.PI * k * n) / N);
        im -= x[n]! * Math.sin((2 * Math.PI * k * n) / N);
      }
      expect(mag[k]!).toBeCloseTo(Math.hypot(re, im), 3);
    }
  });

  it('resamples 44.1 kHz and 48 kHz to 22.05 kHz keeping pitch and level', () => {
    for (const sr of [44100, 48000]) {
      const pcm = new Float32Array(sr).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));
      const r = new ResampledReader(pcm, sr, 22050);
      const out = new Float32Array(4096);
      r.read(8000, 4096, out);
      let zc = 0;
      let peak = 0;
      for (let i = 1; i < out.length; i++) {
        if (out[i - 1]! < 0 && out[i]! >= 0) zc++;
        peak = Math.max(peak, Math.abs(out[i]!));
      }
      expect(Math.abs(zc / (4096 / 22050) - 440)).toBeLessThan(8);
      expect(peak).toBeGreaterThan(0.48);
      expect(peak).toBeLessThan(0.52);
    }
  });

  it('estimates tuning from spectral peaks', () => {
    const frames = 50;
    const per = 4;
    const hz = new Float32Array(frames * per);
    const amp = new Float32Array(frames * per);
    const count = new Uint8Array(frames).fill(per);
    for (let f = 0; f < frames; f++) {
      [57, 60, 64, 69].forEach((m, i) => {
        hz[f * per + i] = 440 * 2 ** ((m - 69 - 0.22) / 12);
        amp[f * per + i] = 1 - i * 0.1;
      });
    }
    const t = estimateTuning(hz, amp, count, per);
    expect(t.cents).toBeGreaterThan(-24);
    expect(t.cents).toBeLessThan(-20);
    expect(t.concentration).toBeGreaterThan(0.9);
  });

  it('finds the key of Krumhansl-like profiles (C major, A minor)', () => {
    expect(keyFromProfile(KK_MAJOR)).toMatchObject({ tonic: 0, mode: 'major' });
    // A natural minor triad-heavy profile.
    const am = [3, 0, 1, 0, 2.5, 1, 0, 1, 0, 4, 0, 1];
    expect(keyFromProfile(am)).toMatchObject({ tonic: 9, mode: 'minor' });
  });

  it('tracks beats on an impulse-train envelope and follows a tempo step', () => {
    const fps = 100;
    const env = new Float32Array(3000);
    const truth: number[] = [];
    for (let t = 50, p = 60; t < 3000; t += p) {
      truth.push(t);
      env[Math.round(t)] = 5;
      if (t > 1500) p = 54;
    }
    const tempo = estimateTempo(env, fps);
    expect(tempo.bpm).toBeGreaterThan(95);
    expect(tempo.bpm).toBeLessThan(113);
    const beats = trackBeats(localScore(env, tempo.period), localPeriods(env, fps, tempo.period));
    const hit = truth.filter((t) => beats.some((b) => Math.abs(b - t) <= 2)).length / truth.length;
    expect(hit).toBeGreaterThan(0.9);
  });

  it('decodes chords from chroma with HMM smoothing', () => {
    const rows = [
      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], // C
      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      [1, 0, 0, 0, 0.9, 0, 0, 1, 0, 1, 0, 0], // C with a passing A: still C
      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], // Am
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    ];
    const n = rows.length;
    const treble = new Float32Array(rows.flat());
    const bass = new Float32Array(n * 12);
    for (let i = 0; i < n; i++) bass[i * 12 + (i < 4 ? 0 : 9)] = 1;
    const bc = { count: n, treble, bass, energy: new Float32Array(n).fill(1), flatness: new Float32Array(n) };
    const S = chordScores(bc, new Uint8Array(n));
    const { path, posterior } = decodeChords(S, n);
    const labels = Array.from(path).map((s) => stateLabel(s));
    expect(labels.slice(0, 4).every((l) => l.root === 0 && l.quality === 'maj')).toBe(true);
    expect(labels.slice(4).every((l) => l.root === 9 && l.quality === 'min')).toBe(true);
    expect(Math.min(...posterior)).toBeGreaterThan(0.5);
  });

  it('segments a contour into notes, splitting on pitch moves and re-attacks', () => {
    const fps = 100;
    const pitch = new Float32Array(100).fill(NaN);
    const sal = new Float32Array(100);
    for (let f = 10; f < 40; f++) {
      pitch[f] = 64.1;
      sal[f] = 1 - (f - 10) * 0.02;
    }
    for (let f = 40; f < 60; f++) {
      pitch[f] = 64;
      sal[f] = 1 - (f - 40) * 0.02; // re-attack of the same pitch
    }
    for (let f = 60; f < 90; f++) {
      pitch[f] = 67;
      sal[f] = 0.8;
    }
    const notes = segmentNotes({ pitch, sal, ref: 1 }, fps, MELODY_PARAMS, 0);
    expect(notes.map((n) => n.midi)).toEqual([64, 64, 67]);
    expect(notes[1]!.startSec).toBeCloseTo(0.4, 1);
    expect(notes[2]!.startSec).toBeCloseTo(0.6, 1);
  });

  it('finds section boundaries from harmony or from level/timbre changes', () => {
    const n = 96;
    const dim = 4;
    const chroma = new Float32Array(n * dim);
    const flatChroma = new Float32Array(n * dim);
    const levels = new Float32Array(n * 2);
    const flatLevels = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const b = i >= 32 && i < 64;
      chroma[i * dim + (b ? 2 : 0)] = 1;
      chroma[i * dim + 1] = 0.3 + 0.2 * Math.sin(i);
      chroma[i * dim + 3] = 0.2 * ((i * 7) % 3);
      flatChroma.set([1, 0.3 + 0.2 * Math.sin(i), 0, 0.5], i * dim);
      levels.set([b ? -20 : -30, b ? -25 : -26 + Math.sin(i)], i * 2);
      flatLevels.set([-30 + Math.sin(i), -26], i * 2);
    }
    const set = (data: Float32Array, kind: 'cosine' | 'gaussian') =>
      kind === 'cosine' ? { data, dim, kind, weight: 1, sameLabel: 0.92 } : { data, dim: 2, kind, scale: 4, weight: 0.5, sameLabel: 0.6 };
    for (const sets of [
      [set(chroma, 'cosine'), set(flatLevels, 'gaussian')],
      [set(flatChroma, 'cosine'), set(levels, 'gaussian')],
    ]) {
      const s = segmentSections({ count: n, sets });
      expect(s.boundaries).toEqual([0, 32, 64]);
      expect(s.labels).toEqual(['A', 'B', 'A']);
    }
  });
});

// ---------- whole songs ----------

describe('full-song analysis on synthetic mixes', () => {
  it('1. click and drum tracks at 92 and 140 BPM: tempo within 2 %, beats within 40 ms', () => {
    for (const bpm of [92, 140]) {
      for (const clicksOnly of [true, false]) {
        const s = renderSong({ bpm, progression: ['C'], repeats: Math.round((bpm / 60) * 30 / 4), chordsOn: false, clicksOnly });
        const a = analyzeSong(s.pcm, s.sr);
        const m = beatScores(s.beats, a.beats, 0.04);
        log(`beats ${bpm} BPM ${clicksOnly ? 'clicks' : 'drums'}: est ${a.bpm} (alts ${a.bpmAlternatives.join('/')}), recall@40ms ${m.recall.toFixed(3)}, precision ${m.precision.toFixed(3)}, confidence ${a.beatConfidence}`);
        expect([a.bpm, ...a.bpmAlternatives].some((b) => Math.abs(b / bpm - 1) <= 0.02)).toBe(true);
        expect(m.recall).toBeGreaterThanOrEqual(0.9);
        expect(m.precision).toBeGreaterThanOrEqual(0.9);
        expect(a.beatConfidence).toBeGreaterThan(0.5);
      }
    }
  });

  it('2. follows a gradual tempo drift 100 → 110 BPM over 60 s within 50 ms', () => {
    const s = renderSong({ bpm: (t) => 100 + (10 * Math.min(60, t)) / 60, progression: ['C', 'G', 'Am', 'F'], repeats: 6, ...BAND });
    const a = analyzeSong(s.pcm, s.sr);
    const m = beatScores(s.beats, a.beats, 0.05);
    log(`drift 100→110: est ${a.bpm}, recall@50ms ${m.recall.toFixed(3)}, precision ${m.precision.toFixed(3)}, warnings: ${a.warnings.join(' | ')}`);
    expect(m.recall).toBeGreaterThanOrEqual(0.9);
    expect(m.precision).toBeGreaterThanOrEqual(0.9);
    expect(a.warnings.some((w) => /drift/.test(w))).toBe(true);
  });

  it('3. recognises C–G–Am–F (C major) and Am–Dm–E7–Am (A minor), one chord per bar at 100 BPM', () => {
    const major = renderSong({ bpm: 100, progression: ['C', 'G', 'Am', 'F'], repeats: 4, ...BAND });
    const a1 = analyzeSong(major.pcm, major.sr);
    const acc1 = chordAccuracy(major, a1);
    const minor = renderSong({ bpm: 100, progression: ['Am', 'Dm', 'E7', 'Am'], repeats: 4, pickupBeats: 2, ...BAND });
    const a2 = analyzeSong(minor.pcm, minor.sr);
    const acc2 = chordAccuracy(minor, a2);
    log(`chords C–G–Am–F: ${(100 * acc1).toFixed(1)} % of beats, key ${a1.key.tonic} ${a1.key.mode} (${a1.key.confidence}), downbeat ${a1.downbeatIndex}/${major.downbeatIndex}`);
    log(`chords Am–Dm–E7–Am: ${(100 * acc2).toFixed(1)} % of beats, key ${a2.key.tonic} ${a2.key.mode} (${a2.key.confidence}), downbeat ${a2.downbeatIndex}/${minor.downbeatIndex}, E7 labelled ${[...new Set(a2.chords.filter((c) => c.root === 4).map((c) => c.quality))].join('/')}`);
    expect(acc1).toBeGreaterThanOrEqual(0.8);
    expect(acc2).toBeGreaterThanOrEqual(0.8);
    expect(a1.key).toMatchObject({ tonic: 0, mode: 'major' });
    expect(a2.key).toMatchObject({ tonic: 9, mode: 'minor' });
    expect(a1.downbeatIndex).toBe(major.downbeatIndex);
    expect(a2.downbeatIndex).toBe(minor.downbeatIndex);
    // Segments are contiguous, ordered and cover the song.
    for (const a of [a1, a2]) {
      expect(a.chords[0]!.startSec).toBe(0);
      expect(a.chords[a.chords.length - 1]!.endSec).toBeCloseTo(a.durationSec, 2);
      a.chords.slice(1).forEach((c, i) => expect(c.startSec).toBeCloseTo(a.chords[i]!.endSec, 3));
    }
  });

  it('3b. gives the same answers for 44.1 kHz and 48 kHz input', () => {
    for (const sr of [44100, 48000]) {
      const s = renderSong({ sr, bpm: 100, progression: ['C', 'G', 'Am', 'F'], repeats: 2, ...BAND });
      const a = analyzeSong(s.pcm, s.sr);
      const acc = chordAccuracy(s, a);
      const m = beatScores(s.beats, a.beats, 0.04);
      const mel = noteF1(s.melody, a.melody);
      log(`${sr} Hz: chords ${(100 * acc).toFixed(1)} %, beats recall ${m.recall.toFixed(3)}, melody F1 ${mel.f1.toFixed(3)}`);
      expect(a.sampleRate).toBe(sr);
      expect(acc).toBeGreaterThanOrEqual(0.8);
      expect(m.recall).toBeGreaterThanOrEqual(0.9);
      expect(mel.f1).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('4. handles a band tuned 30 cents flat', () => {
    const s = renderSong({ bpm: 100, progression: ['C', 'G', 'Am', 'F'], repeats: 4, detuneCents: -30, ...BAND });
    const a = analyzeSong(s.pcm, s.sr);
    const acc = chordAccuracy(s, a);
    const mel = noteF1(s.melody, a.melody);
    log(`detuned −30 c: tuning ${a.tuningCents} c, chords ${(100 * acc).toFixed(1)} %, melody F1 ${mel.f1.toFixed(3)}, key ${a.key.tonic} ${a.key.mode}`);
    expect(Math.abs(a.tuningCents + 30)).toBeLessThanOrEqual(10);
    expect(acc).toBeGreaterThanOrEqual(0.75);
    expect(a.warnings.some((w) => /flat/.test(w))).toBe(true);
  });

  it('5. transcribes a melody over chords and the bass roots', () => {
    const s = renderSong({ bpm: 100, progression: ['C', 'G', 'Am', 'F', 'Dm', 'G', 'C', 'C'], repeats: 2, seed: 5, ...BAND });
    const a = analyzeSong(s.pcm, s.sr);
    const mel = noteF1(s.melody, a.melody);
    const bassNotes = noteF1(s.bass, a.bass, 0.1);
    const roots = bassRootAccuracy(s, a);
    log(`melody: F1 ${mel.f1.toFixed(3)} (P ${mel.precision.toFixed(3)}, R ${mel.recall.toFixed(3)}; ${a.melody.length} est / ${s.melody.length} ref; onset ±60 ms, exact pitch)`);
    log(`bass: root pitch class right on ${(100 * roots).toFixed(1)} % of beats; note F1 (±100 ms, exact pitch) ${bassNotes.f1.toFixed(3)}`);
    expect(mel.f1).toBeGreaterThanOrEqual(0.7);
    expect(roots).toBeGreaterThanOrEqual(0.8);
    for (const n of [...a.melody, ...a.bass]) {
      expect(n.endSec).toBeGreaterThan(n.startSec);
      expect(n.confidence).toBeGreaterThanOrEqual(0);
      expect(n.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('6. silence and white noise: no crash, no chords, no melody, with warnings', () => {
    const quiet = analyzeSong(silence(22050, 20), 22050);
    expect(quiet.chords.every((c) => c.quality === 'N')).toBe(true);
    expect(quiet.melody).toHaveLength(0);
    expect(quiet.bass).toHaveLength(0);
    expect(quiet.beats).toHaveLength(0);
    expect(quiet.warnings.length).toBeGreaterThan(0);
    for (const amp of [0.3, 0.003]) {
      const a = analyzeSong(whiteNoise(22050, 20, amp), 22050);
      const chordTime = a.chords.filter((c) => c.quality !== 'N' && c.confidence >= 0.5).reduce((s, c) => s + c.endSec - c.startSec, 0);
      log(`noise ${amp}: chord time ${chordTime.toFixed(2)} s, melody ${a.melody.length}, bass ${a.bass.length}, beat confidence ${a.beatConfidence}, warnings: ${a.warnings.join(' | ')}`);
      expect(chordTime).toBeLessThan(1);
      expect(a.melody.length).toBeLessThanOrEqual(2);
      expect(a.bass.length).toBeLessThanOrEqual(2);
      expect(a.beatConfidence).toBeLessThan(0.3);
      expect(a.key.confidence).toBeLessThan(0.3);
      expect(a.warnings.some((w) => /noise/.test(w))).toBe(true);
    }
  });

  it('7. finds A B A sections near the boundaries (± 2 beats)', () => {
    const A = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'];
    const B = ['Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab'];
    const s = renderSong({ bpm: 100, progression: [...A, ...B, ...A], repeats: 1, ...BAND });
    const a = analyzeSong(s.pcm, s.sr);
    const ibi = 0.6;
    const truth = [s.beats[32]!, s.beats[64]!];
    log(`sections: ${a.sections.map((x) => `${x.label}@${x.startSec.toFixed(2)}`).join(' ')} (truth ${truth.map((t) => t.toFixed(2)).join(', ')})`);
    expect(a.sections.length).toBeGreaterThanOrEqual(3);
    expect(a.sections.length).toBeLessThanOrEqual(5);
    const at = truth.map((t) => a.sections.findIndex((x) => Math.abs(x.startSec - t) <= 2 * ibi + 0.01));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(a.sections[at[0]!]!.label).not.toBe(a.sections[0]!.label);
    expect(a.sections[at[1]!]!.label).toBe(a.sections[0]!.label);
  });

  it('7b. finds a louder, re-orchestrated chorus over the same chords (texture-only contrast)', () => {
    const prog = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'];
    const part = (o: Partial<SongOptions>, gain: number) => {
      const s = renderSong({ bpm: 100, progression: prog, repeats: 1, lead: 0, inversions: true, melody: true, ...o });
      return s.pcm.subarray(0, Math.round(32 * 0.6 * s.sr)).map((x) => x * gain);
    };
    const parts = [part({}, 1), part({ keysTimbre: 'keys2', hatsOn: false, drumGain: 2.2, chordOctave: 12, seed: 3 }, 2), part({ seed: 7 }, 1)];
    const pcm = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    parts.reduce((o, p) => (pcm.set(p, o), o + p.length), 0);
    const a = analyzeSong(pcm, 22050);
    const truth = [19.2, 38.4];
    log(`texture sections: ${a.sections.map((x) => `${x.label}@${x.startSec.toFixed(2)}`).join(' ')} (truth ${truth.join(', ')})`);
    // Measured +2 and −1 beats: per-beat band levels are noisier than chroma, so this
    // texture-only case is held to ±3 beats (the harmonic A B A case above is exact).
    const at = truth.map((t) => a.sections.findIndex((x) => Math.abs(x.startSec - t) <= 3 * 0.6 + 0.01));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(a.sections.length).toBeLessThanOrEqual(5);
    expect(a.sections[at[0]!]!.label).not.toBe(a.sections[0]!.label);
    expect(a.sections[at[1]!]!.label).toBe(a.sections[0]!.label);
  });

  it('8. analyses 5 minutes of music well within budget, reports progress, and cancels early', () => {
    const s = renderSong({ bpm: 112, progression: ['C', 'G', 'Am', 'F', 'Dm', 'G', 'C', 'C', 'Am', 'Em', 'F', 'G'], repeats: 12, ...BAND });
    const fractions: number[] = [];
    const stages = new Set<string>();
    const { analysis: a, details } = analyzeSongDetailed(s.pcm, s.sr, {
      onProgress: (f, stage) => {
        fractions.push(f);
        stages.add(stage);
      },
    });
    const acc = chordAccuracy(s, a);
    const m = beatScores(s.beats, a.beats, 0.04);
    const mel = noteF1(s.melody, a.melody);
    log(`5 min @ 22050 Hz: ${details.elapsedMs} ms (${(a.durationSec / 60).toFixed(2)} min), beats recall ${m.recall.toFixed(3)}, chords ${(100 * acc).toFixed(1)} %, melody F1 ${mel.f1.toFixed(3)}, ${a.sections.length} sections, ${fractions.length} progress events`);
    // Generous bound for slow CI machines; locally ≈ 5–8 s.
    expect(details.elapsedMs).toBeLessThan(45000);
    expect(a.durationSec).toBeGreaterThan(300);
    expect(fractions[fractions.length - 1]).toBe(1);
    expect(fractions.every((f, i) => i === 0 || f >= fractions[i - 1]!)).toBe(true);
    expect(stages.size).toBeGreaterThanOrEqual(5);
    expect(m.recall).toBeGreaterThanOrEqual(0.9);
    expect(acc).toBeGreaterThanOrEqual(0.8);
    expect(a.sections.length).toBeGreaterThanOrEqual(2);
    expect(a.sections.length).toBeLessThanOrEqual(12);

    // Cancellation: abort once a fifth of the work is done.
    const signal = { aborted: false };
    let last = 0;
    const t0 = performance.now();
    expect(() =>
      analyzeSong(s.pcm, s.sr, {
        signal,
        onProgress: (f) => {
          last = f;
          if (f >= 0.2) signal.aborted = true;
        },
      }),
    ).toThrow('cancelled');
    const cancelMs = performance.now() - t0;
    log(`cancel: stopped at ${(100 * last).toFixed(0)} % after ${cancelMs.toFixed(0)} ms`);
    expect(last).toBeLessThan(0.3);
    expect(cancelMs).toBeLessThan(details.elapsedMs * 0.6);
  });
});
