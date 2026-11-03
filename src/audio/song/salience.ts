/**
 * Harmonic-summation pitch salience from spectral peaks (after Salamon &
 * Gómez's Melodia): every peak votes for the candidate fundamentals f/h,
 * h = 1..H, with weight α^(h−1)·amp and a cos² tolerance of ±1 semitone,
 * on a 10-cent grid. Only the strongest local maxima per frame are kept.
 */
export interface SalienceOptions {
  minMidi: number;
  maxMidi: number;
  harmonics: number;
  alpha: number;
  /** Ignore peaks more than this many dB below the frame's strongest peak. */
  rangeDb: number;
  /** Per-peak amplitude weighting by frequency (equal-loudness-like emphasis). */
  weight?: (hz: number) => number;
}

const BINS_PER_SEMITONE = 10;
const TOL = 10; // ±1 semitone in bins
const COS2 = new Float32Array(2 * TOL * 8 + 1);
for (let i = 0; i < COS2.length; i++) {
  const d = (i - TOL * 8) / (TOL * 8); // −1..1 semitone
  COS2[i] = Math.cos((d * Math.PI) / 2) ** 2;
}

export class SalienceGrid {
  readonly bins: number;
  readonly minMidi: number;
  private readonly o: SalienceOptions;
  private readonly logH: Float32Array;
  private readonly alphaH: Float32Array;
  readonly sal: Float32Array;

  constructor(o: SalienceOptions) {
    this.o = o;
    this.minMidi = o.minMidi;
    this.bins = Math.round((o.maxMidi - o.minMidi) * BINS_PER_SEMITONE) + 1;
    this.sal = new Float32Array(this.bins);
    this.logH = new Float32Array(o.harmonics + 1);
    this.alphaH = new Float32Array(o.harmonics + 1);
    for (let h = 1; h <= o.harmonics; h++) {
      this.logH[h] = 12 * Math.log2(h);
      this.alphaH[h] = o.alpha ** (h - 1);
    }
  }

  /** Fills `this.sal` from peaks (Hz, amplitude), strongest first. Returns the summed weighted peak amplitude. */
  compute(hz: ArrayLike<number>, amp: ArrayLike<number>, start: number, count: number): number {
    const sal = this.sal;
    sal.fill(0);
    if (count <= 0) return 0;
    const floor = amp[start]! * 10 ** (-this.o.rangeDb / 20);
    const { minMidi, harmonics, weight } = this.o;
    const top = this.bins - 1;
    let total = 0;
    for (let i = start; i < start + count; i++) {
      const a0 = amp[i]!;
      if (a0 < floor) break; // strongest first
      const f = hz[i]!;
      const a = weight ? a0 * weight(f) : a0;
      total += a;
      const m = 69 + 12 * Math.log2(f / 440);
      for (let h = 1; h <= harmonics; h++) {
        const c = (m - this.logH[h]! - minMidi) * BINS_PER_SEMITONE;
        if (c < -TOL) break;
        if (c > top + TOL) continue;
        const v = a * this.alphaH[h]!;
        const b0 = Math.max(0, Math.ceil(c - TOL));
        const b1 = Math.min(top, Math.floor(c + TOL));
        for (let b = b0; b <= b1; b++) sal[b]! += v * COS2[Math.round((b - c) * 8) + TOL * 8]!;
      }
    }
    return total;
  }

  /** Strongest `k` local maxima of `this.sal` as (MIDI float, salience), strongest first. Returns count. */
  topPeaks(k: number, outMidi: Float32Array, outSal: Float32Array, offset: number): number {
    const sal = this.sal;
    let count = 0;
    for (let b = 1; b < this.bins - 1; b++) {
      const v = sal[b]!;
      if (v <= 0 || v < sal[b - 1]! || v <= sal[b + 1]!) continue;
      if (count === k && v <= outSal[offset + k - 1]!) continue;
      const l = sal[b - 1]!;
      const r = sal[b + 1]!;
      const den = l - 2 * v + r;
      const d = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den)) : 0;
      const midi = this.minMidi + (b + d) / BINS_PER_SEMITONE;
      if (count < k) count++;
      let j = count - 1;
      while (j > 0 && outSal[offset + j - 1]! < v) {
        outSal[offset + j] = outSal[offset + j - 1]!;
        outMidi[offset + j] = outMidi[offset + j - 1]!;
        j--;
      }
      outSal[offset + j] = v;
      outMidi[offset + j] = midi;
    }
    for (let j = count; j < k; j++) {
      outSal[offset + j] = 0;
      outMidi[offset + j] = 0;
    }
    return count;
  }
}
