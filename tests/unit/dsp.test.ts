import { describe, expect, it } from 'vitest';
import { Yin } from '../../src/audio/dsp/yin';
import { StreamAnalyzer, type AnalyzerOutput } from '../../src/audio/dsp/analyzer';
import type { AttackObservation, PitchFrame } from '../../src/audio/observations';
import { TunerTracker } from '../../src/audio/tuner';
import { concat, harmonicTone, midiHz, mix, placeAt, pluck, silence, sine, whiteNoise } from '../fixtures/signals';

function run(sig: Float32Array, sr: number, chunk = 128): { frames: PitchFrame[]; attacks: AttackObservation[] } {
  const an = new StreamAnalyzer({ sampleRate: sr });
  const out: AnalyzerOutput[] = [];
  for (let o = 0; o < sig.length; o += chunk) out.push(...an.push(sig.subarray(o, o + chunk), o));
  return {
    frames: out.flatMap((o) => (o.type === 'frame' ? [o.frame] : [])),
    attacks: out.flatMap((o) => (o.type === 'attack' ? [o.attack] : [])),
  };
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!;

describe('YIN pitch (AC-07, synthetic steady tones E2–E6)', () => {
  for (const sr of [44100, 48000]) {
    it(`median ≤3 cents and p95 ≤5 cents at ${sr} Hz after stabilization`, () => {
      const errs: number[] = [];
      for (let m = 40; m <= 88; m++) {
        for (const detune of [-23, 0, 11.5, 37]) {
          const f = midiHz(m) * 2 ** (detune / 1200);
          const { frames } = run(sine(sr, f, 0.6, 0.3, 0.4), sr);
          const stable = frames.filter((fr) => fr.startSec >= 0.1 && fr.hz !== null);
          expect(stable.length).toBeGreaterThan(5);
          for (const fr of stable) errs.push(Math.abs(1200 * Math.log2(fr.hz! / f)));
        }
      }
      const med = pct(errs, 0.5);
      const p95 = pct(errs, 0.95);
      process.stderr.write(`\nAC-07 report ${sr} Hz: n=${errs.length} median=${med.toFixed(4)}c p95=${p95.toFixed(4)}c max=${Math.max(...errs).toFixed(4)}c\n`);
      expect(med).toBeLessThanOrEqual(3);
      expect(p95).toBeLessThanOrEqual(5);
    });
  }

  it('measures synthetic plucked strings (all six open strings) within 3 cents', () => {
    const sr = 48000;
    for (const m of [40, 45, 50, 55, 59, 64]) {
      const { attacks } = run(placeAt(sr, 2, [{ atSec: 0.3, sig: pluck(sr, midiHz(m), 1.5, 0.4, m) }]), sr);
      expect(attacks).toHaveLength(1);
      expect(attacks[0]!.quality).toBe('good');
      expect(Math.abs((attacks[0]!.pitchMidiFloat! - m) * 100)).toBeLessThan(3);
    }
  });

  it('rejects silence and returns no pitch below the range', () => {
    const yin = new Yin({ sampleRate: 48000 });
    expect(yin.detect(new Float32Array(4096)).hz).toBeNull();
    expect(yin.detect(sine(48000, 30, 0.1)).hz).toBeNull();
  });
});

describe('onsets and attacks', () => {
  it('timestamps onsets at the analyzed samples (independent of chunking)', () => {
    const sr = 44100;
    const times = [0.5, 1.25, 2.0, 2.4];
    const sig = mix(placeAt(sr, 3.5, times.map((t, i) => ({ atSec: t, sig: pluck(sr, midiHz(64 + i), 0.9, 0.4, i + 3) }))), whiteNoise(sr, 3.5, 0.0005));
    for (const chunk of [128, 441, 1024]) {
      const { attacks } = run(sig, sr, chunk);
      expect(attacks.map((a) => a.onsetContextSec)).toHaveLength(4);
      attacks.forEach((a, i) => {
        expect(Math.abs(a.onsetContextSec - times[i]!)).toBeLessThan(0.004);
        expect(Math.round(a.pitchMidiFloat!)).toBe(64 + i);
      });
    }
  });

  it('a held note produces exactly one attack (cannot clear repeated targets)', () => {
    const sr = 48000;
    // 30 ms fade-out: a physical string never stops in a single-sample step.
    const held = pluck(sr, midiHz(64), 4.5, 0.4, 2, 0.9995);
    const fade = Math.round(0.03 * sr);
    for (let i = 0; i < fade; i++) held[held.length - fade + i]! *= 1 - i / fade;
    const { attacks } = run(placeAt(sr, 5, [{ atSec: 0.2, sig: held }]), sr);
    expect(attacks).toHaveLength(1);
  });

  it('repeated identical plucks produce distinct attacks', () => {
    const sr = 48000;
    const { attacks } = run(placeAt(sr, 3, [0.3, 0.8, 1.3, 1.8].map((t) => ({ atSec: t, sig: pluck(sr, midiHz(64), 0.6, 0.4, 5) }))), sr);
    expect(attacks).toHaveLength(4);
    attacks.forEach((a) => expect(Math.round(a.pitchMidiFloat!)).toBe(64));
  });

  it('attack evidence is available within ~150 ms of the onset (analysis span, excluding transport)', () => {
    const sr = 48000;
    const { attacks } = run(placeAt(sr, 1.5, [{ atSec: 0.4, sig: pluck(sr, midiHz(64), 1, 0.4) }]), sr);
    const latency = attacks[0]!.analysisEndContextSec - attacks[0]!.onsetContextSec;
    expect(latency).toBeLessThan(0.16);
  });

  it('flags clipping as poor quality, not as a wrong note', () => {
    const sr = 48000;
    const sig = placeAt(sr, 1.5, [{ atSec: 0.3, sig: pluck(sr, midiHz(64), 1, 1.0) }]).map((x) => Math.max(-1, Math.min(1, x * 3)));
    const { attacks, frames } = run(sig, sr);
    expect(frames.some((f) => f.clipped)).toBe(true);
    expect(attacks[0]!.quality).toBe('poor');
    expect(attacks[0]!.reasonCodes).toContain('clipping');
  });
});

describe('tuner (AC-09, AC-10)', () => {
  const feed = (sig: Float32Array, sr: number, t: TunerTracker) => run(sig, sr).frames.map((f) => t.push(f));

  it('five seconds of silence or noise never locks in tune', () => {
    for (const sr of [44100, 48000]) {
      for (const sig of [silence(sr, 5), whiteNoise(sr, 5, 0.05), whiteNoise(sr, 5, 0.3, 11), sine(sr, 50, 5, 0.2) /* hum below range */]) {
        for (const opts of [{ mode: 'chromatic' as const }, { mode: 'string' as const, targetMidi: 64, targetString: 1 as const }]) {
          const readings = feed(sig, sr, new TunerTracker(opts));
          expect(readings.some((r) => r.status === 'inTune')).toBe(false);
          expect(readings.some((r) => r.direction !== null)).toBe(false);
        }
      }
    }
  });

  it('locks only after ≥300 ms stable within ±5 cents', () => {
    const sr = 48000;
    const t = new TunerTracker({ mode: 'string', targetMidi: 64, targetString: 1 });
    const frames = run(concat(silence(sr, 0.3), sine(sr, midiHz(64) * 2 ** (2 / 1200), 1.5, 0.3)), sr).frames;
    const firstGood = frames.find((f) => f.hz !== null)!;
    const firstLock = frames.find((f) => t.push(f).status === 'inTune')!;
    expect(firstLock).toBeDefined();
    expect(firstLock.centerSec - firstGood.centerSec).toBeGreaterThanOrEqual(0.3);
  });

  it('gives the correct direction for flat and sharp strings', () => {
    const sr = 48000;
    const flat = feed(sine(sr, midiHz(45) * 2 ** (-30 / 1200), 1, 0.3), sr, new TunerTracker({ mode: 'string', targetMidi: 45, targetString: 5 })).at(-1)!;
    expect(flat.direction).toBe('up');
    expect(flat.cents!).toBeCloseTo(-30, 0);
    const sharp = feed(sine(sr, midiHz(45) * 2 ** (20 / 1200), 1, 0.3), sr, new TunerTracker({ mode: 'string', targetMidi: 45, targetString: 5 })).at(-1)!;
    expect(sharp.direction).toBe('down');
  });

  it('a strong second harmonic does not cause a confident wrong-octave lock or tuning instruction', () => {
    const sr = 48000;
    // Low E with a weak fundamental, then a pure second harmonic (as if a harmonic was played).
    for (const sig of [harmonicTone(sr, midiHz(40), 2, [0.07, 0.5, 0.2, 0.1]), sine(sr, midiHz(40) * 2, 2, 0.3)]) {
      const readings = feed(sig, sr, new TunerTracker({ mode: 'string', targetMidi: 40, targetString: 6 }));
      const settled = readings.slice(30);
      // Either correctly identified as E2 (lock allowed), or flagged as a harmonic — never "tune down an octave".
      expect(settled.every((r) => r.status === 'inTune' || r.status === 'tuning' || r.status === 'harmonic')).toBe(true);
      expect(settled.some((r) => r.status === 'harmonic' && r.direction !== null)).toBe(false);
      expect(settled.some((r) => Math.abs(r.cents ?? 0) > 300)).toBe(false);
    }
    const pureOctave = feed(sine(sr, midiHz(52), 2, 0.3), sr, new TunerTracker({ mode: 'string', targetMidi: 40, targetString: 6 })).slice(30);
    expect(pureOctave.every((r) => r.status === 'harmonic')).toBe(true);
  });

  it('far-off pitch gives a check instruction, not a tighten/loosen direction', () => {
    const sr = 48000;
    const r = feed(sine(sr, midiHz(57), 1, 0.3), sr, new TunerTracker({ mode: 'string', targetMidi: 64, targetString: 1 })).at(-1)!;
    expect(r.status).toBe('farOff');
    expect(r.direction).toBeNull();
  });
});

import { renderClick } from '../../src/audio/dsp/pluckSynth';
describe('review regressions (audio)', () => {
  it('metronome clicks over a ringing note never become extra pitched attacks', () => {
    for (const sr of [44100, 48000]) {
      const ring = pluck(sr, midiHz(64), 5, 0.4, 4, 0.9995);
      const fade = Math.round(0.03 * sr);
      for (let i = 0; i < fade; i++) ring[ring.length - fade + i]! *= 1 - i / fade;
      const clicks = [1.5, 2.5, 3.5, 4.5].map((t) => ({ atSec: t, sig: renderClick(sr, false) }));
      const sig = mix(placeAt(sr, 6, [{ atSec: 0.3, sig: ring }, ...clicks]), whiteNoise(sr, 6, 0.0005));
      const pitched = run(sig, sr).attacks.filter((a) => a.pitchMidiFloat !== null);
      expect(pitched.map((a) => a.onsetContextSec.toFixed(2))).toEqual(['0.30']);
    }
  });

  it('digital silence (muted input) is reported as no input, not as good listening', () => {
    const { frames } = run(silence(48000, 1.5), 48000);
    const late = frames.filter((f) => f.centerSec > 0.8);
    expect(late.length).toBeGreaterThan(10);
    expect(late.every((f) => f.inputQuality === 'unavailable' && f.reasonCodes.includes('no_input_signal'))).toBe(true);
  });

  it('a weak low-E fundamental (laptop-mic-like) still yields a pitch via the looser YIN pass', () => {
    const sr = 48000;
    const { attacks } = run(placeAt(sr, 2, [{ atSec: 0.3, sig: harmonicTone(sr, midiHz(40), 1.5, [0.02, 0.4, 0.3, 0.2, 0.1]) }]), sr);
    const a = attacks.find((x) => x.pitchMidiFloat !== null);
    expect(a && Math.round(a.pitchMidiFloat!)).toBe(40);
  });
});

describe('tuner lock re-checks (review)', () => {
  it('a new note or an unstable reading ends a lock', () => {
    const sr = 48000;
    const t = new TunerTracker({ mode: 'chromatic' });
    const frames = run(concat(sine(sr, midiHz(40), 1.2, 0.3), sine(sr, midiHz(45) * 2 ** (3 / 1200), 1.2, 0.3)), sr).frames;
    const readings = frames.map((f) => ({ t: f.centerSec, r: t.push(f) }));
    expect(readings.some((x) => x.t < 1.2 && x.r.status === 'inTune')).toBe(true);
    // Right after switching to A, the old lock must not carry over.
    const justAfter = readings.filter((x) => x.t > 1.25 && x.t < 1.45);
    expect(justAfter.every((x) => x.r.status !== 'inTune' || x.r.noteName === 'A2')).toBe(true);
    expect(justAfter.filter((x) => x.r.status === 'inTune').length).toBeLessThan(justAfter.length);
  });
});
