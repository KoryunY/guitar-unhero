/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002) with the
 * difference function computed through FFT cross-correlation. Original
 * implementation for this project (no third-party code).
 *
 * The cumulative-mean-normalized difference d'(τ) is a periodicity measure, not
 * a calibrated probability. Results outside the configured range are rejected.
 */
import { FFT } from './fft';

const FALLBACK_THRESHOLD = 0.2;

export interface YinConfig {
  sampleRate: number;
  /** Total samples per analysis buffer (window + max lag). */
  bufferSize: number;
  minHz: number;
  maxHz: number;
  threshold: number;
  /** Second-pass threshold for shallow dips (weak fundamentals); null disables it. */
  fallbackThreshold: number | null;
}

export interface YinResult {
  /** null when no periodicity was found in range. */
  hz: number | null;
  /** d'(τ) at the chosen lag: 0 = perfectly periodic, ≈1 = aperiodic. */
  aperiodicity: number;
}

export class Yin {
  readonly cfg: YinConfig;
  readonly tauMin: number;
  readonly tauMax: number;
  readonly window: number;
  private readonly fft: FFT;
  private readonly aRe: Float64Array;
  private readonly aIm: Float64Array;
  private readonly bRe: Float64Array;
  private readonly bIm: Float64Array;
  private readonly diff: Float64Array;
  private readonly cmnd: Float64Array;
  private readonly prefix: Float64Array;

  constructor(cfg: Partial<YinConfig> & { sampleRate: number }) {
    this.cfg = { bufferSize: 4096, minHz: 60, maxHz: 1500, threshold: 0.12, fallbackThreshold: FALLBACK_THRESHOLD, ...cfg };
    const { sampleRate, bufferSize, minHz, maxHz } = this.cfg;
    this.tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
    this.tauMax = Math.min(Math.ceil(sampleRate / minHz), Math.floor(bufferSize / 2));
    this.window = bufferSize - this.tauMax - 1;
    let m = 1;
    while (m < bufferSize + this.window) m <<= 1;
    this.fft = new FFT(m);
    this.aRe = new Float64Array(m);
    this.aIm = new Float64Array(m);
    this.bRe = new Float64Array(m);
    this.bIm = new Float64Array(m);
    this.diff = new Float64Array(this.tauMax + 2);
    this.cmnd = new Float64Array(this.tauMax + 2);
    this.prefix = new Float64Array(bufferSize + 1);
  }

  /** Analyze `buf` (length ≥ bufferSize; the last bufferSize samples are used). */
  detect(buf: ArrayLike<number>): YinResult {
    const N = this.cfg.bufferSize;
    const off = buf.length - N;
    if (off < 0) throw new RangeError('Buffer too short');
    const W = this.window;
    const { aRe, aIm, bRe, bIm, prefix, diff, cmnd } = this;
    aRe.fill(0); aIm.fill(0); bRe.fill(0); bIm.fill(0);
    prefix[0] = 0;
    for (let i = 0; i < N; i++) {
      const v = buf[off + i]!;
      bRe[i] = v;
      if (i < W) aRe[i] = v;
      prefix[i + 1] = prefix[i]! + v * v;
    }
    this.fft.transform(aRe, aIm);
    this.fft.transform(bRe, bIm);
    // conj(A) * B → cross-correlation r(τ) = Σ a_j b_{j+τ}
    for (let k = 0; k < aRe.length; k++) {
      const re = aRe[k]! * bRe[k]! + aIm[k]! * bIm[k]!;
      const im = aRe[k]! * bIm[k]! - aIm[k]! * bRe[k]!;
      aRe[k] = re;
      aIm[k] = im;
    }
    this.fft.transform(aRe, aIm, true);
    const scale = 1 / aRe.length;
    const e0 = prefix[W]!;
    if (e0 <= 1e-12) return { hz: null, aperiodicity: 1 };
    diff[0] = 0;
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= this.tauMax; tau++) {
      const r = aRe[tau]! * scale;
      const et = prefix[tau + W]! - prefix[tau]!;
      const d = Math.max(0, e0 + et - 2 * r);
      diff[tau] = d;
      running += d;
      cmnd[tau] = running > 0 ? (d * tau) / running : 1;
    }
    // First dip below threshold, then walk to its local minimum.
    let tau = -1;
    for (let t = this.tauMin; t < this.tauMax; t++) {
      if (cmnd[t]! < this.cfg.threshold) {
        while (t + 1 < this.tauMax && cmnd[t + 1]! < cmnd[t]!) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0 && this.cfg.fallbackThreshold !== null) {
      // Second pass at a looser threshold: weak fundamentals (laptop mics on low
      // strings) give shallower dips. The analyzer still grades these frames by
      // their aperiodicity and fundamental support.
      for (let t = this.tauMin; t < this.tauMax; t++) {
        if (cmnd[t]! < this.cfg.fallbackThreshold) {
          while (t + 1 < this.tauMax && cmnd[t + 1]! < cmnd[t]!) t++;
          tau = t;
          break;
        }
      }
    }
    if (tau < 0) {
      // No confident dip: report the global minimum as aperiodic evidence only.
      let best = this.tauMin;
      for (let t = this.tauMin; t < this.tauMax; t++) if (cmnd[t]! < cmnd[best]!) best = t;
      return { hz: null, aperiodicity: cmnd[best]! };
    }
    // Parabolic interpolation on the raw difference function.
    const y0 = diff[tau - 1]!;
    const y1 = diff[tau]!;
    const y2 = diff[tau + 1]!;
    const den = y0 - 2 * y1 + y2;
    const shift = den > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
    const period = tau + shift;
    const hz = this.cfg.sampleRate / period;
    if (hz < this.cfg.minHz || hz > this.cfg.maxHz) return { hz: null, aperiodicity: cmnd[tau]! };
    return { hz, aperiodicity: cmnd[tau]! };
  }
}
