/**
 * Offline analysis of a short, deliberately recorded clip (diagnostics). Shared by
 * the Diagnostics screen and the recordings evaluation harness so both measure
 * exactly the same thing.
 */
import { StreamAnalyzer } from './dsp/analyzer';
import type { AttackObservation, PitchFrame } from './observations';

export interface ClipReport {
  targetMidi: number;
  requestedPlucks: number;
  attacks: number;
  pitched: number;
  onTarget: number;
  wrongPitch: number;
  /** Fraction of assessable steady frames within ±15 cents of the target (AC-08 style). */
  framesWithin15: number | null;
  steadyFrames: number;
  medianCents: number | null;
  clipped: boolean;
  details: { onsetSec: number; midi: number | null; cents: number | null; quality: string; reasons: string[] }[];
}

export interface DiagnosticLabel {
  format: 'gu-diagnostic-label';
  version: 1;
  targetMidi: number;
  string: number;
  fret: number;
  requestedPlucks: number;
  sampleRate: number;
  recordedAt: string;
  app: string;
  note?: string;
}

export function analyzeClip(pcm: Float32Array, sampleRate: number, targetMidi: number, requestedPlucks: number): ClipReport {
  const an = new StreamAnalyzer({ sampleRate });
  const attacks: AttackObservation[] = [];
  const frames: PitchFrame[] = [];
  for (let o = 0; o < pcm.length; o += 512) {
    for (const x of an.push(pcm.subarray(o, o + 512), o)) {
      if (x.type === 'attack') attacks.push(x.attack);
      else frames.push(x.frame);
    }
  }
  const details = attacks.map((a) => ({
    onsetSec: a.onsetContextSec,
    midi: a.pitchMidiFloat,
    cents: a.pitchMidiFloat === null ? null : (a.pitchMidiFloat - targetMidi) * 100,
    quality: a.quality,
    reasons: a.reasonCodes,
  }));
  const pitched = details.filter((d) => d.quality === 'good' && d.cents !== null);
  const onTarget = pitched.filter((d) => Math.abs(d.cents!) <= 50).length;
  // Steady frames: good pitch frames near the target pitch class region (±100 c) after attacks.
  const steady = frames.filter((f) => f.pitchQuality === 'good' && f.midiFloat !== null && Math.abs(f.midiFloat - targetMidi) * 100 <= 100);
  const within15 = steady.filter((f) => Math.abs(f.midiFloat! - targetMidi) * 100 <= 15).length;
  const cents = pitched.map((d) => d.cents!).sort((a, b) => a - b);
  return {
    targetMidi,
    requestedPlucks,
    attacks: attacks.length,
    pitched: pitched.length,
    onTarget,
    wrongPitch: pitched.length - onTarget,
    framesWithin15: steady.length ? within15 / steady.length : null,
    steadyFrames: steady.length,
    medianCents: cents.length ? cents[cents.length >> 1]! : null,
    clipped: frames.some((f) => f.clipped),
    details,
  };
}
