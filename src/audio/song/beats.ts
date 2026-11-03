/**
 * Tempo estimation and beat tracking on an onset envelope.
 *   1. Global tempo: autocorrelation with a comb over the first four multiples
 *      of each lag, weighted by a log-Gaussian prior around ~115 BPM
 *      (range 50–220 BPM).
 *   2. Local tempo curve: the same comb on overlapping 8 s windows, restricted
 *      to ±20 % of the global tempo, median-smoothed — lets the tracker follow
 *      moderate drift.
 *   3. Dynamic-programming beat tracking (Ellis 2007): each frame's score is
 *      its onset strength plus the best predecessor score minus
 *      tightness·log²(interval / local period).
 */
export const MIN_BPM = 50;
export const MAX_BPM = 220;
const PRIOR_BPM = 115;
const PRIOR_OCTAVES = 1.0;
const COMB = [1, 0.5, 0.33, 0.25];

export interface TempoEstimate {
  /** Beat period in envelope frames (fractional). */
  period: number;
  bpm: number;
  /** Comb strength of the chosen period relative to the envelope energy (0..~1). */
  strength: number;
  /** Next-best period candidate outside ±10 % of the winner (frames), or null. */
  runnerUp: number | null;
}

/** Normalised autocorrelation r[0..maxLag] (r[0] = 1) of a slice. */
export function autocorrelation(env: Float32Array, start: number, end: number, maxLag: number): Float32Array {
  const r = new Float32Array(maxLag + 1);
  let mean = 0;
  for (let i = start; i < end; i++) mean += env[i]!;
  mean /= Math.max(1, end - start);
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = start + lag; i < end; i++) s += (env[i]! - mean) * (env[i - lag]! - mean);
    r[lag] = s;
  }
  const r0 = r[0]!;
  if (r0 > 0) for (let lag = 0; lag <= maxLag; lag++) r[lag]! /= r0;
  return r;
}

function interp(r: Float32Array, x: number): number {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= r.length) return 0;
  const f = x - i;
  return r[i]! * (1 - f) + r[i + 1]! * f;
}

function combScore(r: Float32Array, tau: number, terms = COMB.length): number {
  let s = 0;
  for (let k = 1; k <= terms; k++) {
    const x = k * tau;
    if (x + 1 >= r.length) break;
    s += COMB[k - 1]! * Math.max(0, interp(r, x));
  }
  return s;
}

function prior(bpm: number): number {
  const z = Math.log2(bpm / PRIOR_BPM) / PRIOR_OCTAVES;
  return Math.exp(-0.5 * z * z);
}

/** Global tempo of an onset envelope sampled at `fps` frames per second. */
export function estimateTempo(env: Float32Array, fps: number): TempoEstimate {
  const minLag = (60 * fps) / MAX_BPM;
  const maxLag = (60 * fps) / MIN_BPM;
  const r = autocorrelation(env, 0, env.length, Math.min(env.length - 2, Math.ceil(maxLag * COMB.length) + 2));
  const cands: { tau: number; score: number }[] = [];
  let best = { tau: (60 * fps) / PRIOR_BPM, score: -1 };
  for (let tau = Math.floor(minLag); tau <= Math.ceil(maxLag); tau += 0.25) {
    if (tau < minLag || tau > maxLag) continue;
    const s = combScore(r, tau) * prior((60 * fps) / tau);
    cands.push({ tau, score: s });
    if (s > best.score) best = { tau, score: s };
  }
  // Refine on a fine grid.
  let fine = best;
  for (let tau = best.tau - 0.3; tau <= best.tau + 0.3; tau += 0.02) {
    const s = combScore(r, tau) * prior((60 * fps) / tau);
    if (s > fine.score) fine = { tau, score: s };
  }
  let runner: { tau: number; score: number } | null = null;
  for (const c of cands) {
    if (Math.abs(Math.log(c.tau / fine.tau)) < Math.log(1.1)) continue;
    if (!runner || c.score > runner.score) runner = c;
  }
  const norm = COMB.reduce((a, b) => a + b, 0);
  return {
    period: fine.tau,
    bpm: (60 * fps) / fine.tau,
    strength: Math.max(0, combScore(r, fine.tau) / norm),
    runnerUp: runner && runner.score > 0.6 * fine.score ? runner.tau : null,
  };
}

/** Per-frame beat period (frames) following slow tempo changes around `period`. */
export function localPeriods(env: Float32Array, fps: number, period: number, signal?: { aborted: boolean }): Float32Array {
  const n = env.length;
  const out = new Float32Array(n).fill(period);
  const win = Math.round(8 * fps);
  if (n < win * 1.5) return out;
  const hop = Math.round(2 * fps);
  const lo = period / 1.2;
  const hi = period * 1.2;
  const maxLag = Math.ceil(hi * 3) + 2;
  if (maxLag >= win) return out;
  const centers: number[] = [];
  const values: number[] = [];
  for (let s = 0; s + win <= n; s += hop) {
    if (signal?.aborted) throw new Error('cancelled');
    const r = autocorrelation(env, s, s + win, maxLag);
    let best = { tau: period, score: 0 };
    for (let tau = lo; tau <= hi; tau += 0.05) {
      const z = Math.log2(tau / period) / 0.15;
      const sc = combScore(r, tau, 3) * Math.exp(-0.5 * z * z);
      if (sc > best.score) best = { tau, score: sc };
    }
    centers.push(s + win / 2);
    values.push(best.score > 0.05 ? best.tau : NaN);
  }
  // Fill weak windows from neighbours, then median-smooth (5 windows).
  let last = period;
  for (let i = 0; i < values.length; i++) {
    if (Number.isNaN(values[i]!)) values[i] = last;
    else last = values[i]!;
  }
  const smooth = values.map((_, i) => {
    const w = values.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b);
    return w[w.length >> 1]!;
  });
  for (let t = 0; t < n; t++) {
    let v: number;
    if (t <= centers[0]!) v = smooth[0]!;
    else if (t >= centers[centers.length - 1]!) v = smooth[smooth.length - 1]!;
    else {
      const j = Math.min(centers.length - 2, Math.floor((t - centers[0]!) / hop));
      const f = (t - centers[j]!) / (centers[j + 1]! - centers[j]!);
      v = smooth[j]! * (1 - f) + smooth[j + 1]! * f;
    }
    out[t] = v;
  }
  return out;
}

/** Onset envelope smoothed with a narrow Gaussian (σ = period/32), as in Ellis/librosa. */
export function localScore(env: Float32Array, period: number): Float32Array {
  const half = Math.max(1, Math.round(period / 8));
  const k: number[] = [];
  for (let i = -half; i <= half; i++) k.push(Math.exp(-0.5 * ((i * 32) / period) ** 2));
  const n = env.length;
  const out = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (let i = -half; i <= half; i++) {
      const j = t + i;
      if (j >= 0 && j < n) s += env[j]! * k[i + half]!;
    }
    out[t] = s;
  }
  return out;
}

/**
 * Ellis-style DP beat tracker. `score` is the smoothed onset strength, `periods`
 * the per-frame beat period. Returns beat positions in (fractional) frames.
 */
export function trackBeats(score: Float32Array, periods: Float32Array, tightness = 100, signal?: { aborted: boolean }): number[] {
  const n = score.length;
  if (n < 4) return [];
  const cum = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  let maxScore = 0;
  for (let t = 0; t < n; t++) maxScore = Math.max(maxScore, score[t]!);
  if (maxScore <= 0) return [];
  let first = true;
  for (let t = 0; t < n; t++) {
    if ((t & 4095) === 0 && signal?.aborted) throw new Error('cancelled');
    const tau = periods[t]!;
    const lo = t - Math.round(2 * tau);
    const hi = t - Math.round(tau / 2);
    let best = -Infinity;
    let arg = -1;
    for (let p = hi; p >= lo; p--) {
      const pen = -tightness * Math.log((t - p) / tau) ** 2;
      const v = pen + (p >= 0 ? cum[p]! : 0);
      if (v > best) {
        best = v;
        arg = p;
      }
    }
    cum[t] = score[t]! + (Number.isFinite(best) ? best : 0);
    if (first && score[t]! < 0.01 * maxScore) back[t] = -1;
    else {
      back[t] = arg >= 0 ? arg : -1;
      first = false;
    }
  }
  // Last beat: last local maximum of the cumulative score above half the median of maxima.
  const maxima: number[] = [];
  for (let t = 1; t < n - 1; t++) if (cum[t]! > cum[t - 1]! && cum[t]! >= cum[t + 1]!) maxima.push(t);
  if (!maxima.length) return [];
  const vals = maxima.map((t) => cum[t]!).sort((a, b) => a - b);
  const med = vals[vals.length >> 1]!;
  let last = maxima[maxima.length - 1]!;
  for (let i = maxima.length - 1; i >= 0; i--) {
    if (cum[maxima[i]!]! >= 0.5 * med) {
      last = maxima[i]!;
      break;
    }
  }
  const beats: number[] = [];
  for (let t = last; t >= 0; t = back[t]!) {
    beats.push(t);
    if (back[t]! < 0 || back[t]! >= t) break;
  }
  beats.reverse();
  // Trim weak leading/trailing beats (below half the RMS of the smoothed score at beats).
  const sm = beats.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let j = -2; j <= 2; j++) {
      const x = beats[i + j];
      if (x === undefined) continue;
      const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * (j + 3)) / 6);
      s += h * score[x]!;
      w += h;
    }
    return w > 0 ? s / w : 0;
  });
  const rms = Math.sqrt(sm.reduce((a, v) => a + v * v, 0) / Math.max(1, sm.length));
  let a = 0;
  let b = beats.length;
  while (a < b && sm[a]! < 0.5 * rms) a++;
  while (b > a && sm[b - 1]! < 0.5 * rms) b--;
  // Sub-frame refinement: parabolic peak of the score near each beat frame.
  return beats.slice(a, b).map((t) => {
    if (t <= 0 || t >= n - 1) return t;
    const l = score[t - 1]!;
    const c = score[t]!;
    const r = score[t + 1]!;
    const den = l - 2 * c + r;
    if (c >= l && c >= r && den < 0) return t + Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den));
    return t;
  });
}

/**
 * 0..1 heuristic: how much stronger the onset envelope is at the tracked beats
 * than on average, combined with how periodic the envelope is.
 */
export function beatConfidence(env: Float32Array, beatFrames: readonly number[], strength: number): number {
  if (beatFrames.length < 4) return 0;
  let all = 0;
  for (let i = 0; i < env.length; i++) all += env[i]!;
  all /= Math.max(1, env.length);
  if (all <= 0) return 0;
  let at = 0;
  for (const b of beatFrames) {
    const t = Math.round(b);
    let m = 0;
    for (let j = t - 2; j <= t + 2; j++) if (j >= 0 && j < env.length) m = Math.max(m, env[j]!);
    at += m;
  }
  at /= beatFrames.length;
  const ratio = at / all;
  const c1 = Math.max(0, Math.min(1, (ratio - 2) / 4));
  const c2 = Math.max(0, Math.min(1, (strength - 0.05) / 0.3));
  return Math.round(100 * Math.sqrt(c1 * c2)) / 100;
}
