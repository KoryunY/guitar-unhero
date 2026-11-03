/**
 * Spectral helpers for song analysis: a real-input FFT built on the shared
 * complex FFT (packs even/odd samples into one half-size transform), a Hann
 * window, and spectral peak picking with parabolic interpolation.
 */
import { FFT } from '../dsp/fft';

export function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/** Magnitude spectrum of a real frame of power-of-two length N (bins 0..N/2). */
export class RealFFT {
  readonly size: number;
  private readonly fft: FFT;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly wr: Float64Array;
  private readonly wi: Float64Array;

  constructor(size: number) {
    if (size < 4 || (size & (size - 1)) !== 0) throw new RangeError('RealFFT size must be a power of two ≥ 4');
    this.size = size;
    const m = size / 2;
    this.fft = new FFT(m);
    this.re = new Float64Array(m);
    this.im = new Float64Array(m);
    this.wr = new Float64Array(m + 1);
    this.wi = new Float64Array(m + 1);
    for (let k = 0; k <= m; k++) {
      this.wr[k] = Math.cos((2 * Math.PI * k) / size);
      this.wi[k] = -Math.sin((2 * Math.PI * k) / size);
    }
  }

  /** Writes |X[k]| for k = 0..N/2 into `mag` (length ≥ N/2 + 1). `frame` has length N. */
  magnitude(frame: ArrayLike<number>, mag: Float32Array): void {
    const m = this.size / 2;
    const re = this.re;
    const im = this.im;
    for (let n = 0; n < m; n++) {
      re[n] = frame[2 * n]!;
      im[n] = frame[2 * n + 1]!;
    }
    this.fft.transform(re, im);
    for (let k = 0; k <= m; k++) {
      const a = k % m;
      const b = (m - k) % m;
      const zr = re[a]!;
      const zi = im[a]!;
      const cr = re[b]!;
      const ci = -im[b]!;
      const er = (zr + cr) / 2;
      const ei = (zi + ci) / 2;
      const or = (zi - ci) / 2;
      const oi = -(zr - cr) / 2;
      const wr = this.wr[k]!;
      const wi = this.wi[k]!;
      const xr = er + wr * or - wi * oi;
      const xi = ei + wr * oi + wi * or;
      mag[k] = Math.sqrt(xr * xr + xi * xi);
    }
  }
}

export interface PeakOptions {
  minHz: number;
  maxHz: number;
  /** Peak must exceed this many times the local mean magnitude (±`localBins`). */
  prominence: number;
  localBins: number;
  /** Peak must be within this many dB of the frame's largest magnitude in range. */
  rangeDb: number;
  maxPeaks: number;
}

/**
 * Local maxima with parabolic interpolation on log magnitude. Writes peak
 * frequencies (Hz) and amplitudes (interpolated magnitude) into the output
 * arrays, strongest first; returns the count. `scratch` must have length ≥ mag.length.
 */
export function pickPeaks(
  mag: Float32Array,
  bins: number,
  binHz: number,
  o: PeakOptions,
  outHz: Float32Array,
  outAmp: Float32Array,
  scratch: Float32Array,
): number {
  const lo = Math.max(2, Math.floor(o.minHz / binHz));
  const hi = Math.min(bins - 2, Math.ceil(o.maxHz / binHz));
  if (hi <= lo) return 0;
  // Running local mean via prefix sums.
  const pre = scratch;
  let acc = 0;
  for (let k = 0; k < bins; k++) {
    acc += mag[k]!;
    pre[k] = acc;
  }
  let maxMag = 0;
  for (let k = lo; k <= hi; k++) if (mag[k]! > maxMag) maxMag = mag[k]!;
  if (maxMag <= 0) return 0;
  const floor = maxMag * 10 ** (-o.rangeDb / 20);
  let count = 0;
  const L = o.localBins;
  for (let k = lo; k <= hi; k++) {
    const m = mag[k]!;
    if (m < floor || m <= mag[k - 1]! || m < mag[k + 1]!) continue;
    const a = Math.max(0, k - L);
    const b = Math.min(bins - 1, k + L);
    const localMean = (pre[b]! - (a > 0 ? pre[a - 1]! : 0)) / (b - a + 1);
    if (m < o.prominence * localMean) continue;
    const l = Math.log(mag[k - 1]! + 1e-12);
    const c = Math.log(m + 1e-12);
    const r = Math.log(mag[k + 1]! + 1e-12);
    const den = l - 2 * c + r;
    const d = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den)) : 0;
    const hz = (k + d) * binHz;
    const amp = Math.exp(c - 0.25 * (l - r) * d);
    // Insert into the strongest-first list (bounded).
    if (count < o.maxPeaks) count++;
    else if (amp <= outAmp[count - 1]!) continue;
    let j = count - 1;
    while (j > 0 && outAmp[j - 1]! < amp) {
      outAmp[j] = outAmp[j - 1]!;
      outHz[j] = outHz[j - 1]!;
      j--;
    }
    outAmp[j] = amp;
    outHz[j] = hz;
  }
  return count;
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}
