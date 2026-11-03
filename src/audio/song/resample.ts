/**
 * Band-limited resampling read on demand: frames of the resampled signal are
 * produced from the original PCM in bounded chunks, so a long song is never
 * copied in full at the analysis rate. Windowed-sinc (Blackman) polyphase
 * filter for rational rate ratios; identity when the rates match.
 */
const CHUNK = 1 << 16;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export class ResampledReader {
  readonly outRate: number;
  /** Output length in samples. */
  readonly length: number;
  private readonly pcm: Float32Array;
  private readonly p: number;
  private readonly q: number;
  private readonly half: number;
  private readonly taps: Float32Array[] = [];
  private cache = new Float32Array(0);
  private cacheStart = 0;
  private cacheLen = 0;

  constructor(pcm: Float32Array, inRate: number, outRate: number) {
    this.pcm = pcm;
    this.outRate = outRate;
    // Rational ratio outRate/inRate = p/q (rates rounded to 1 Hz).
    const a = Math.round(outRate);
    const b = Math.round(inRate);
    const g = gcd(a, b);
    let p = a / g;
    let q = b / g;
    if (p > 4096) {
      // Awkward ratio: approximate with ≤ 4096 phases (error < 0.03 %).
      const r = outRate / inRate;
      p = 4096;
      q = Math.max(1, Math.round(p / r));
    }
    this.p = p;
    this.q = q;
    this.length = Math.floor((pcm.length * p) / q);
    if (p === q) {
      this.half = 0;
      return;
    }
    const fc = 0.5 * Math.min(1, p / q) * 0.92; // cycles per input sample
    const zeroCrossings = 10;
    const half = Math.ceil(zeroCrossings / (2 * fc));
    this.half = half;
    for (let ph = 0; ph < p; ph++) {
      const frac = ph / p;
      const c = new Float32Array(2 * half);
      let sum = 0;
      for (let j = 0; j < 2 * half; j++) {
        const t = frac + half - 1 - j; // x − k
        const x = 2 * fc * t;
        const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        const u = (t + half) / (2 * half); // 0..1 across the window
        const win = u <= 0 || u >= 1 ? 0 : 0.42 - 0.5 * Math.cos(2 * Math.PI * u) + 0.08 * Math.cos(4 * Math.PI * u);
        c[j] = 2 * fc * sinc * win;
        sum += c[j]!;
      }
      if (sum !== 0) for (let j = 0; j < c.length; j++) c[j]! /= sum;
      this.taps.push(c);
    }
  }

  /** Copies output samples [start, start + n) into `out` (zeros outside the signal). */
  read(start: number, n: number, out: Float32Array): void {
    const a = Math.max(0, start);
    const b = Math.min(this.length, start + n);
    if (b <= a) {
      out.fill(0, 0, n);
      return;
    }
    if (a > start) out.fill(0, 0, a - start);
    if (b < start + n) out.fill(0, b - start, n);
    if (this.p === this.q) {
      out.set(this.pcm.subarray(a, b), a - start);
      return;
    }
    if (a < this.cacheStart || b > this.cacheStart + this.cacheLen) this.fill(a, Math.max(CHUNK, n));
    out.set(this.cache.subarray(a - this.cacheStart, b - this.cacheStart), a - start);
  }

  private fill(start: number, len: number): void {
    const n = Math.min(len, this.length - start);
    const pcm = this.pcm;
    const N = pcm.length;
    const { p, q, half } = this;
    // Keep the overlap with the previous chunk instead of recomputing it.
    let o0 = 0;
    const prevEnd = this.cacheStart + this.cacheLen;
    const overlap = this.cacheLen > 0 && start >= this.cacheStart && start < prevEnd;
    if (this.cache.length < n) {
      const next = new Float32Array(Math.max(n, CHUNK));
      if (overlap) next.set(this.cache.subarray(start - this.cacheStart, this.cacheLen));
      this.cache = next;
      if (overlap) o0 = Math.min(n, prevEnd - start);
    } else if (overlap) {
      o0 = Math.min(n, prevEnd - start);
      this.cache.copyWithin(0, start - this.cacheStart, this.cacheLen);
    }
    for (let o = o0; o < n; o++) {
      const num = (start + o) * q;
      const i = Math.floor(num / p);
      const c = this.taps[num - i * p]!;
      const k0 = i - half + 1;
      let s = 0;
      if (k0 >= 0 && k0 + 2 * half <= N) {
        for (let j = 0; j < c.length; j++) s += pcm[k0 + j]! * c[j]!;
      } else {
        for (let j = 0; j < c.length; j++) {
          const k = k0 + j;
          if (k >= 0 && k < N) s += pcm[k]! * c[j]!;
        }
      }
      this.cache[o] = s;
    }
    this.cacheStart = start;
    this.cacheLen = n;
  }
}

/** Number of centred frames (frame j is centred on sample j·hop) covering `length` samples. */
export function frameCount(length: number, hop: number): number {
  return Math.max(1, Math.floor(length / hop) + 1);
}
