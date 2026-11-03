/**
 * Downbeat phase for 4/4: chords and bass notes tend to change, and kick/bass
 * onsets tend to be strongest, on beat 1. For each of the four phases, average
 * the harmonic change into each beat (1 − cosine of consecutive beat chroma,
 * treble and bass) plus the low-band onset strength at the beat; the best phase
 * wins. Confidence is the winner's margin over the runner-up.
 */
export interface DownbeatInput {
  /** Per-beat treble and bass chroma (count × 12), beat i ↔ row i. */
  treble: Float32Array;
  bass: Float32Array;
  count: number;
  /** Low-band onset strength at each beat (already normalised). */
  lowOnset: ArrayLike<number>;
}

function cosDist(a: Float32Array, i: number, j: number): number {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let c = 0; c < 12; c++) {
    const x = a[i * 12 + c]!;
    const y = a[j * 12 + c]!;
    d += x * y;
    na += x * x;
    nb += y * y;
  }
  return na > 0 && nb > 0 ? 1 - d / Math.sqrt(na * nb) : 0;
}

export function harmonicChange(x: DownbeatInput): Float32Array {
  const h = new Float32Array(x.count);
  for (let i = 1; i < x.count; i++) h[i] = cosDist(x.treble, i - 1, i) + cosDist(x.bass, i - 1, i);
  return h;
}

export function estimateDownbeat(x: DownbeatInput): { index: number; confidence: number; scores: number[] } {
  if (x.count < 8) return { index: 0, confidence: 0, scores: [0, 0, 0, 0] };
  const h = harmonicChange(x);
  const mean = (a: ArrayLike<number>, from: number) => {
    let s = 0;
    for (let i = from; i < x.count; i++) s += a[i]!;
    return s / Math.max(1, x.count - from);
  };
  const mh = mean(h, 1) || 1;
  const ml = mean(x.lowOnset, 0) || 1;
  const scores = [0, 0, 0, 0];
  const counts = [0, 0, 0, 0];
  for (let i = 1; i < x.count; i++) {
    scores[i % 4]! += h[i]! / mh + 0.5 * (x.lowOnset[i]! / ml);
    counts[i % 4]!++;
  }
  for (let p = 0; p < 4; p++) scores[p] = counts[p]! ? scores[p]! / counts[p]! : 0;
  const order = [0, 1, 2, 3].sort((a, b) => scores[b]! - scores[a]!);
  const best = order[0]!;
  const margin = (scores[best]! - scores[order[1]!]!) / Math.max(1e-9, scores[best]!);
  return { index: best, confidence: Math.round(100 * Math.max(0, Math.min(1, margin / 0.3))) / 100, scores };
}
