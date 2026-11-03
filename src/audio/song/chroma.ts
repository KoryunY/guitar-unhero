/**
 * Chroma from the harmony pass's spectral peaks, with the tuning offset
 * removed. Each peak adds its log-compressed amplitude to the pitch class of
 * its nearest semitone, weighted by cos²(π·distance) (off-pitch partials count
 * less) and by register:
 *   - treble chroma: MIDI ≈ 40–96, weighted towards the low-mid register
 *     (fundamentals of chord instruments) rather than upper harmonics;
 *   - bass chroma: MIDI ≈ 26–58, centred near E2.
 * Beat-synchronous chroma averages frames over each beat interval, weighting
 * frames by how much of their central window lies inside the interval.
 */
import type { HarmonyPass } from './passes';
import { PEAKS_PER_FRAME } from './passes';

export interface FrameChroma {
  frames: number;
  fps: number;
  treble: Float32Array;
  bass: Float32Array;
  /** Reference amplitude used for log compression. */
  ref: number;
}

export function trebleWeight(m: number): number {
  if (m < 38 || m > 98) return 0;
  const ramp = m < 46 ? (m - 38) / 8 : 1;
  return ramp * Math.exp(-0.5 * ((m - 58) / 14) ** 2);
}

export function bassWeight(m: number): number {
  if (m < 24 || m > 60) return 0;
  return Math.exp(-0.5 * ((m - 40) / 7) ** 2);
}

/** 95th percentile of each frame's strongest peak (loud passages), used as the 0 dB reference. */
export function peakReference(h: HarmonyPass): number {
  const vals: number[] = [];
  for (let f = 0; f < h.frames; f++) if (h.peakCount[f]) vals.push(h.peakAmp[f * PEAKS_PER_FRAME]!);
  if (!vals.length) return 0;
  vals.sort((a, b) => a - b);
  return vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))]!;
}

export function frameChroma(h: HarmonyPass, tuningCents: number): FrameChroma {
  const treble = new Float32Array(h.frames * 12);
  const bass = new Float32Array(h.frames * 12);
  const ref = peakReference(h);
  const out: FrameChroma = { frames: h.frames, fps: h.fps, treble, bass, ref };
  if (ref <= 0) return out;
  const k = 100 / ref;
  const shift = tuningCents / 100;
  for (let f = 0; f < h.frames; f++) {
    const n = h.peakCount[f]!;
    const base = f * PEAKS_PER_FRAME;
    for (let i = 0; i < n; i++) {
      const hz = h.peakHz[base + i]!;
      const m = 69 + 12 * Math.log2(hz / 440) - shift;
      const p = Math.round(m);
      const d = m - p;
      const tw = trebleWeight(m);
      const bw = bassWeight(m);
      if (tw <= 0 && bw <= 0) continue;
      const a = Math.log1p(k * h.peakAmp[base + i]!) * Math.cos(Math.PI * d) ** 2;
      const pc = ((p % 12) + 12) % 12;
      if (tw > 0) treble[f * 12 + pc]! += a * tw;
      if (bw > 0) bass[f * 12 + pc]! += a * bw;
    }
  }
  return out;
}

export interface BeatChroma {
  count: number;
  treble: Float32Array;
  bass: Float32Array;
  /** Mean harmony-pass frame energy over the interval. */
  energy: Float32Array;
  /** Mean spectral flatness over the interval (≈0.55 for white noise, ≪ 0.1 for tonal music). */
  flatness: Float32Array;
}

/** Averages frame chroma over consecutive intervals [bounds[i], bounds[i+1]) (seconds). */
export function beatSyncChroma(fc: FrameChroma, energy: Float32Array, bounds: readonly number[], flatness?: Float32Array): BeatChroma {
  const count = Math.max(0, bounds.length - 1);
  const out: BeatChroma = { count, treble: new Float32Array(count * 12), bass: new Float32Array(count * 12), energy: new Float32Array(count), flatness: new Float32Array(count) };
  const R = 0.09;
  for (let i = 0; i < count; i++) {
    const b0 = bounds[i]!;
    const b1 = bounds[i + 1]!;
    const f0 = Math.max(0, Math.floor((b0 - R) * fc.fps));
    const f1 = Math.min(fc.frames - 1, Math.ceil((b1 + R) * fc.fps));
    let ws = 0;
    for (let f = f0; f <= f1; f++) {
      const t = f / fc.fps;
      const w = Math.max(0, Math.min(t + R, b1) - Math.max(t - R, b0)) / (2 * R);
      if (w <= 0) continue;
      ws += w;
      for (let c = 0; c < 12; c++) {
        out.treble[i * 12 + c]! += w * fc.treble[f * 12 + c]!;
        out.bass[i * 12 + c]! += w * fc.bass[f * 12 + c]!;
      }
      out.energy[i]! += w * energy[f]!;
      if (flatness) out.flatness[i]! += w * flatness[f]!;
    }
    if (ws <= 0) {
      const f = Math.min(fc.frames - 1, Math.max(0, Math.round(((b0 + b1) / 2) * fc.fps)));
      for (let c = 0; c < 12; c++) {
        out.treble[i * 12 + c] = fc.treble[f * 12 + c]!;
        out.bass[i * 12 + c] = fc.bass[f * 12 + c]!;
      }
      out.energy[i] = energy[f]!;
      out.flatness[i] = flatness?.[f] ?? 0;
      continue;
    }
    for (let c = 0; c < 12; c++) {
      out.treble[i * 12 + c]! /= ws;
      out.bass[i * 12 + c]! /= ws;
    }
    out.energy[i]! /= ws;
    out.flatness[i]! /= ws;
  }
  return out;
}
