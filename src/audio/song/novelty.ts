/**
 * Onset/novelty envelope: log-magnitude spectral flux over log-spaced bands
 * (≈ 3 per octave), half-wave rectified. A second envelope uses only the low
 * bands (< 200 Hz) to show bass/kick onsets for downbeat finding.
 */
export interface FluxValue {
  full: number;
  low: number;
}

export class BandFlux {
  private readonly bandLo: Int32Array;
  private readonly bandHi: Int32Array;
  private readonly lowBands: number;
  private readonly history: Float32Array[];
  private pos = 0;
  private filled = 0;
  private readonly gain: number;
  readonly bands: number;

  constructor(binHz: number, bins: number, opts: { minHz?: number; maxHz?: number; perOctave?: number; lag?: number; fftSize: number }) {
    const minHz = opts.minHz ?? 30;
    const maxHz = Math.min(opts.maxHz ?? 10000, binHz * (bins - 1));
    const per = opts.perOctave ?? 3;
    const lo: number[] = [];
    const hi: number[] = [];
    let f = minHz;
    let k = Math.max(1, Math.round(minHz / binHz));
    while (k < bins - 1 && f < maxHz) {
      const f2 = f * 2 ** (1 / per);
      // Bins whose centre lies below f2; every band gets at least one bin.
      const e = Math.min(bins - 1, Math.max(k, Math.floor(f2 / binHz - 1e-9)));
      lo.push(k);
      hi.push(e);
      k = e + 1;
      f = Math.max(f2, k * binHz);
    }
    this.bandLo = Int32Array.from(lo);
    this.bandHi = Int32Array.from(hi);
    this.bands = lo.length;
    this.lowBands = hi.filter((b) => (b + 0.5) * binHz <= 200).length;
    const lag = Math.max(1, opts.lag ?? 2);
    this.history = Array.from({ length: lag + 1 }, () => new Float32Array(this.bands));
    // A full-scale sine of amplitude A peaks at A·N/4 with a Hann window; normalise so the
    // log knee sits near −60 dBFS.
    this.gain = 1000 / (opts.fftSize / 4);
  }

  push(mag: Float32Array): FluxValue {
    const cur = this.history[this.pos]!;
    for (let b = 0; b < this.bands; b++) {
      let s = 0;
      const a = this.bandLo[b]!;
      const e = this.bandHi[b]!;
      for (let k = a; k <= e; k++) s += mag[k]! * mag[k]!;
      cur[b] = Math.log1p(this.gain * Math.sqrt(s / (e - a + 1)));
    }
    const lag = this.history.length - 1;
    let full = 0;
    let low = 0;
    if (this.filled >= lag) {
      const prev = this.history[(this.pos + 1) % this.history.length]!;
      for (let b = 0; b < this.bands; b++) {
        const d = cur[b]! - prev[b]!;
        if (d > 0) {
          full += d;
          if (b < this.lowBands) low += d;
        }
      }
      full /= this.bands;
      low /= Math.max(1, this.lowBands);
    }
    this.filled++;
    this.pos = (this.pos + 1) % this.history.length;
    return { full, low };
  }
}

/** Subtract a centred moving average (±`radius` frames), half-wave rectify, scale to unit std. */
export function normalizeEnvelope(env: Float32Array, radius: number): Float32Array {
  const n = env.length;
  const out = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i]! + env[i]!;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(n, i + radius + 1);
    out[i] = Math.max(0, env[i]! - (pre[b]! - pre[a]!) / (b - a));
  }
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    s += out[i]!;
    s2 += out[i]! * out[i]!;
  }
  const mean = s / Math.max(1, n);
  const std = Math.sqrt(Math.max(0, s2 / Math.max(1, n) - mean * mean));
  if (std > 1e-9) for (let i = 0; i < n; i++) out[i]! /= std;
  return out;
}
