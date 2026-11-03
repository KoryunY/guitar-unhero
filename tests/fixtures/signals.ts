/**
 * Deterministic synthetic test signals (original, generated at test time).
 * They are repeatable but cannot certify a physical guitar, microphone or room.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sine(sr: number, hz: number, seconds: number, amp = 0.5, phase = 0): Float32Array {
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(phase + (2 * Math.PI * hz * i) / sr);
  return out;
}

/** Sum of harmonics with given amplitudes [fundamental, 2nd, 3rd, ...]. */
export function harmonicTone(sr: number, hz: number, seconds: number, amps: number[]): Float32Array {
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  amps.forEach((a, k) => {
    const f = hz * (k + 1);
    if (f >= sr / 2) return;
    for (let i = 0; i < n; i++) out[i]! += a * Math.sin((2 * Math.PI * f * i) / sr + k * 0.7);
  });
  return out;
}

/** Karplus–Strong plucked string with fractional delay (allpass), deterministic. */
export function pluck(sr: number, hz: number, seconds: number, amp = 0.5, seed = 1, decay = 0.996): Float32Array {
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  const period = sr / hz - 0.5; // averaging filter adds half a sample of delay
  const L = Math.floor(period);
  const frac = period - L;
  const c = (1 - frac) / (1 + frac); // first-order allpass coefficient
  const rnd = mulberry32(seed);
  const buf = new Float64Array(L);
  for (let i = 0; i < L; i++) buf[i] = rnd() * 2 - 1;
  // gentle lowpass on the excitation for a softer pluck
  for (let i = 1; i < L; i++) buf[i] = 0.5 * (buf[i]! + buf[i - 1]!);
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  let peak = 0;
  const tmp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const cur = buf[idx]!;
    const avg = decay * 0.5 * (cur + prev);
    prev = cur;
    const y = c * avg + apX - c * apY;
    apX = avg;
    apY = y;
    buf[idx] = y;
    idx = (idx + 1) % L;
    tmp[i] = cur;
    peak = Math.max(peak, Math.abs(cur));
  }
  const g = peak > 0 ? amp / peak : 0;
  for (let i = 0; i < n; i++) out[i] = tmp[i]! * g;
  return out;
}

export function whiteNoise(sr: number, seconds: number, amp: number, seed = 7): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * (rnd() * 2 - 1);
  return out;
}

export function silence(sr: number, seconds: number): Float32Array {
  return new Float32Array(Math.round(sr * seconds));
}

export function concat(...parts: Float32Array[]): Float32Array {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function mix(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

/** Place `sig` at `atSec` inside a buffer of `totalSec`. */
export function placeAt(sr: number, totalSec: number, items: { atSec: number; sig: Float32Array }[]): Float32Array {
  const out = new Float32Array(Math.round(sr * totalSec));
  for (const { atSec, sig } of items) {
    const o = Math.round(atSec * sr);
    for (let i = 0; i < sig.length && o + i < out.length; i++) out[o + i]! += sig[i]!;
  }
  return out;
}

export function midiHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

/**
 * More guitar-like additive tone: inharmonic partials (stiff string),
 * per-partial decay, pluck-position comb, and a brief sharp pitch glide at the
 * attack. Original synthetic model — still not a real instrument.
 */
export function guitarLike(
  sr: number,
  hz: number,
  seconds: number,
  opts: { amp?: number; inharmonicity?: number; glideCents?: number; pluckPos?: number; decaySec?: number; seed?: number } = {},
): Float32Array {
  const { amp = 0.4, inharmonicity = 0.0004, glideCents = 15, pluckPos = 0.18, decaySec = 2.5, seed = 3 } = opts;
  const n = Math.round(sr * seconds);
  const out = new Float32Array(n);
  const rnd = mulberry32(seed);
  for (let k = 1; k <= 24; k++) {
    const fk = k * hz * Math.sqrt(1 + inharmonicity * k * k);
    if (fk > sr / 2.2) break;
    const a = Math.abs(Math.sin(Math.PI * k * pluckPos)) / k;
    const tau = decaySec / (1 + 0.35 * (k - 1));
    const ph = rnd() * 2 * Math.PI;
    let phase = ph;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const glide = 2 ** ((glideCents * Math.exp(-t / 0.04)) / 1200);
      phase += (2 * Math.PI * fk * glide) / sr;
      out[i]! += a * Math.exp(-t / tau) * Math.sin(phase);
    }
  }
  // Short noisy pick transient.
  for (let i = 0; i < Math.min(n, Math.round(sr * 0.004)); i++) out[i]! += 0.15 * (rnd() * 2 - 1) * (1 - i / (sr * 0.004));
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const g = peak > 0 ? amp / peak : 0;
  for (let i = 0; i < n; i++) out[i]! *= g;
  return out;
}

/** Simple room: a few feedback comb echoes. */
export function reverb(sig: Float32Array, sr: number, mixAmt = 0.3): Float32Array {
  const out = new Float32Array(sig.length);
  out.set(sig);
  for (const [ms, g] of [[29, 0.5], [37, 0.45], [41, 0.4], [53, 0.35]] as const) {
    const d = Math.round((ms / 1000) * sr);
    const buf = new Float32Array(sig.length);
    for (let i = 0; i < sig.length; i++) buf[i] = sig[i]! + (i >= d ? g * buf[i - d]! : 0);
    for (let i = 0; i < sig.length; i++) out[i]! += (mixAmt / 4) * buf[i]!;
  }
  return out;
}

export function scale(sig: Float32Array, g: number): Float32Array {
  return sig.map((x) => x * g);
}

export function rms(sig: Float32Array): number {
  let s = 0;
  for (const x of sig) s += x * x;
  return Math.sqrt(s / Math.max(1, sig.length));
}
