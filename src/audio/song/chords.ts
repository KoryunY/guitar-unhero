/**
 * Chord recognition on beat-synchronous chroma.
 *   - Templates: chord tones of maj, min, 7, min7, maj7 and 5 (power chord),
 *     each tone with its first harmonics folded in (octaves, fifth, major
 *     third, decaying), unit-normalised; plus 'N' (flat chroma = noise/no chord).
 *   - Score: cosine of treble chroma with the template, plus a bass term (root
 *     in the bass), plus a small prior favouring plain triads.
 *   - HMM over beats (73 states) with a strong self-transition; Viterbi for the
 *     labels, forward–backward for per-beat posteriors (confidence).
 *   - Consecutive equal labels merge into segments.
 */
import type { ChordQuality, ChordSegment } from './types';
import type { BeatChroma } from './chroma';

export const QUALITIES: Exclude<ChordQuality, 'N'>[] = ['maj', 'min', '7', 'min7', 'maj7', '5'];
const INTERVALS: Record<Exclude<ChordQuality, 'N'>, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  '7': [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  '5': [0, 7],
};
const QUALITY_PRIOR: Record<Exclude<ChordQuality, 'N'>, number> = { maj: 0, min: 0, '7': -0.025, min7: -0.025, maj7: -0.035, '5': -0.045 };
/** Pitch-class offsets of harmonics 1..6 (octaves fold to 0; 3 → fifth; 5 → major third). */
const HARMONIC_PC = [0, 0, 7, 0, 4, 7];

export const STATE_COUNT = 1 + QUALITIES.length * 12;

export function stateLabel(s: number): { root: number | null; quality: ChordQuality } {
  if (s === 0) return { root: null, quality: 'N' };
  const q = Math.floor((s - 1) / 12);
  return { root: (s - 1) % 12, quality: QUALITIES[q]! };
}

export interface ChordParams {
  /** Harmonic decay folded into the templates (0 = plain binary templates). */
  harmonicDecay: number;
  /** Emission sharpness. */
  kappa: number;
  /** Self-transition probability per beat. */
  stay: number;
  /** Weight of the bass-root term. */
  bassWeight: number;
  /** Penalty on the 'N' (flat) template so weak chords are still named. */
  noChordPenalty: number;
}

export const DEFAULT_CHORD_PARAMS: ChordParams = { harmonicDecay: 0.6, kappa: 22, stay: 0.88, bassWeight: 0.3, noChordPenalty: 0.1 };

export function chordTemplates(harmonicDecay: number): Float32Array {
  const T = new Float32Array(STATE_COUNT * 12);
  for (let c = 0; c < 12; c++) T[c] = 1 / Math.sqrt(12);
  QUALITIES.forEach((q, qi) => {
    for (let r = 0; r < 12; r++) {
      const s = 1 + qi * 12 + r;
      const v = new Float64Array(12);
      for (const iv of INTERVALS[q]) {
        for (let h = 0; h < (harmonicDecay > 0 ? HARMONIC_PC.length : 1); h++) v[(r + iv + HARMONIC_PC[h]!) % 12]! += harmonicDecay > 0 ? harmonicDecay ** h : 1;
      }
      let n = 0;
      for (let c = 0; c < 12; c++) n += v[c]! * v[c]!;
      n = Math.sqrt(n);
      for (let c = 0; c < 12; c++) T[s * 12 + c] = v[c]! / n;
    }
  });
  return T;
}

/**
 * Per-beat state scores (n × STATE_COUNT). `silent[i]` marks beats with too
 * little energy to judge; they score strongly for 'N', as do noise-like beats.
 */
export function chordScores(bc: BeatChroma, silent: Uint8Array, p: ChordParams = DEFAULT_CHORD_PARAMS): Float32Array {
  const T = chordTemplates(p.harmonicDecay);
  const n = bc.count;
  const S = new Float32Array(n * STATE_COUNT);
  const t = new Float64Array(12);
  const b = new Float64Array(12);
  for (let i = 0; i < n; i++) {
    const row = i * STATE_COUNT;
    if (silent[i]) {
      S[row] = 1;
      continue;
    }
    let tn = 0;
    let bmax = 0;
    let bsum = 0;
    for (let c = 0; c < 12; c++) {
      t[c] = bc.treble[i * 12 + c]!;
      b[c] = bc.bass[i * 12 + c]!;
      tn += t[c]! * t[c]!;
      bmax = Math.max(bmax, b[c]!);
      bsum += b[c]!;
    }
    tn = Math.sqrt(tn);
    if (tn <= 1e-9) {
      S[row] = 1;
      continue;
    }
    for (let c = 0; c < 12; c++) t[c]! /= tn;
    // Bass is informative only when it has a clear peak.
    const bmean = bsum / 12;
    const bassClear = bmax > 0 ? Math.max(0, Math.min(1, (bmax - bmean) / bmax / 0.5)) : 0;
    for (let s = 0; s < STATE_COUNT; s++) {
      let dot = 0;
      for (let c = 0; c < 12; c++) dot += t[c]! * T[s * 12 + c]!;
      if (s === 0) {
        // Noise-like beats (high spectral flatness) favour 'no chord'.
        const noisy = Math.max(0, Math.min(1, (bc.flatness[i]! - 0.25) / 0.2));
        S[row] = dot - p.noChordPenalty + noisy;
        continue;
      }
      const { root, quality } = stateLabel(s);
      const bassTerm = bmax > 0 ? ((b[root!]! - bmean) / bmax) * bassClear : 0;
      S[row + s] = dot + p.bassWeight * bassTerm + QUALITY_PRIOR[quality as Exclude<ChordQuality, 'N'>];
    }
  }
  return S;
}

/** Viterbi labels and forward–backward posteriors of the chosen labels. */
export function decodeChords(S: Float32Array, n: number, p: ChordParams = DEFAULT_CHORD_PARAMS): { path: Int32Array; posterior: Float32Array } {
  const K = STATE_COUNT;
  const path = new Int32Array(n);
  const posterior = new Float32Array(n);
  if (n === 0) return { path, posterior };
  const lStay = Math.log(p.stay);
  const lMove = Math.log((1 - p.stay) / (K - 1));
  // Viterbi.
  let prev = new Float64Array(K);
  let cur = new Float64Array(K);
  const back = new Uint8Array(n * K);
  for (let s = 0; s < K; s++) prev[s] = p.kappa * S[s]!;
  for (let i = 1; i < n; i++) {
    let best = 0;
    for (let s = 1; s < K; s++) if (prev[s]! > prev[best]!) best = s;
    for (let s = 0; s < K; s++) {
      const stay = prev[s]! + lStay;
      const move = prev[best]! + lMove;
      if (stay >= move || best === s) {
        cur[s] = stay;
        back[i * K + s] = s;
      } else {
        cur[s] = move;
        back[i * K + s] = best;
      }
      cur[s]! += p.kappa * S[i * K + s]!;
    }
    [prev, cur] = [cur, prev];
  }
  let last = 0;
  for (let s = 1; s < K; s++) if (prev[s]! > prev[last]!) last = s;
  path[n - 1] = last;
  for (let i = n - 1; i > 0; i--) path[i - 1] = back[i * K + path[i]!]!;
  // Forward–backward (scaled).
  const alpha = new Float64Array(n * K);
  const e = new Float64Array(K);
  const emit = (i: number) => {
    let m = -Infinity;
    for (let s = 0; s < K; s++) m = Math.max(m, S[i * K + s]!);
    for (let s = 0; s < K; s++) e[s] = Math.exp(p.kappa * (S[i * K + s]! - m));
  };
  const pS = p.stay;
  const pM = (1 - p.stay) / (K - 1);
  emit(0);
  let z = 0;
  for (let s = 0; s < K; s++) z += alpha[s] = e[s]! / K;
  for (let s = 0; s < K; s++) alpha[s]! /= z;
  for (let i = 1; i < n; i++) {
    emit(i);
    let tot = 0;
    for (let s = 0; s < K; s++) tot += alpha[(i - 1) * K + s]!;
    z = 0;
    for (let s = 0; s < K; s++) {
      const a = alpha[(i - 1) * K + s]!;
      const v = e[s]! * (pS * a + pM * (tot - a));
      alpha[i * K + s] = v;
      z += v;
    }
    for (let s = 0; s < K; s++) alpha[i * K + s]! /= z;
  }
  let beta = new Float64Array(K).fill(1);
  let nb = new Float64Array(K);
  for (let i = n - 1; i >= 0; i--) {
    let g = 0;
    for (let s = 0; s < K; s++) g += alpha[i * K + s]! * beta[s]!;
    posterior[i] = g > 0 ? (alpha[i * K + path[i]!]! * beta[path[i]!]!) / g : 0;
    if (i === 0) break;
    emit(i);
    let tot = 0;
    for (let s = 0; s < K; s++) tot += e[s]! * beta[s]!;
    let zz = 0;
    for (let s = 0; s < K; s++) {
      const v = pS * e[s]! * beta[s]! + pM * (tot - e[s]! * beta[s]!);
      nb[s] = v;
      zz += v;
    }
    for (let s = 0; s < K; s++) nb[s]! /= zz;
    [beta, nb] = [nb, beta];
  }
  return { path, posterior };
}

/** Merge per-interval labels into chord segments. */
export function chordSegments(bounds: readonly number[], path: Int32Array, posterior: Float32Array): ChordSegment[] {
  const out: ChordSegment[] = [];
  let i = 0;
  while (i < path.length) {
    let j = i;
    let conf = 0;
    while (j < path.length && path[j] === path[i]) conf += posterior[j++]!;
    const { root, quality } = stateLabel(path[i]!);
    out.push({ startSec: bounds[i]!, endSec: bounds[j]!, root, quality, confidence: Math.round((100 * conf) / (j - i)) / 100 });
    i = j;
  }
  return out;
}
