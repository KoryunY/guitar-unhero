/**
 * Novelty-based segmentation on beat-synchronous features. Each feature set
 * (chroma, compared by cosine; coarse timbre in dB, compared by a Gaussian of
 * the level difference so that a steady sound gives no novelty) contributes a
 * weighted similarity to one banded self-similarity matrix. A Gaussian-tapered
 * checkerboard kernel along the diagonal gives a novelty curve; peaks with a
 * minimum section length become boundaries, each refined by a local
 * change-point fit. Sections are labelled 'A', 'B', … by greedy clustering of
 * their mean features (a later section reuses the label of the most similar
 * earlier one when every feature set is similar enough).
 */
export interface FeatureSet {
  /** Per-beat rows (count × dim). */
  data: Float32Array;
  dim: number;
  /** 'cosine' for chroma-like vectors; 'gaussian' for levels: exp(−meanSqDiff / (2·scale²)). */
  kind: 'cosine' | 'gaussian';
  scale?: number;
  weight: number;
  /** Two sections may share a label only if their mean rows are at least this similar. */
  sameLabel: number;
}

export interface SectionInput {
  count: number;
  sets: FeatureSet[];
}

export interface SectionOptions {
  /** Kernel half-width in beats. */
  halfWidth: number;
  /** Features are averaged over ±this many beats before the novelty kernel. */
  smoothBeats: number;
  /** Minimum section length in beats. */
  minBeats: number;
  maxSections: number;
}

export const DEFAULT_SECTION_OPTIONS: SectionOptions = { halfWidth: 16, smoothBeats: 4, minBeats: 8, maxSections: 12 };

function normalizeRows(f: Float32Array, n: number, dim: number): Float32Array {
  const out = new Float32Array(f.length);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let d = 0; d < dim; d++) s += f[i * dim + d]! ** 2;
    s = Math.sqrt(s);
    if (s > 0) for (let d = 0; d < dim; d++) out[i * dim + d] = f[i * dim + d]! / s;
  }
  return out;
}

/** Centred moving average over ±r rows. */
function smoothRows(f: Float32Array, n: number, dim: number, r: number): Float32Array {
  if (r <= 0) return f;
  const out = new Float32Array(f.length);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r);
    const b = Math.min(n - 1, i + r);
    for (let j = a; j <= b; j++) for (let d = 0; d < dim; d++) out[i * dim + d]! += f[j * dim + d]!;
    for (let d = 0; d < dim; d++) out[i * dim + d]! /= b - a + 1;
  }
  return out;
}

/** Rows ready for comparison: unit rows for cosine sets, raw (optionally smoothed) rows for Gaussian sets. */
function prepare(s: FeatureSet, n: number, smooth: number): Float32Array {
  if (s.kind === 'cosine') return normalizeRows(smoothRows(normalizeRows(s.data, n, s.dim), n, s.dim, smooth), n, s.dim);
  return smoothRows(s.data, n, s.dim, smooth);
}

function similarity(s: FeatureSet, a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number): number {
  let acc = 0;
  if (s.kind === 'cosine') {
    for (let d = 0; d < s.dim; d++) acc += a[ao + d]! * b[bo + d]!;
    return acc;
  }
  for (let d = 0; d < s.dim; d++) acc += (a[ao + d]! - b[bo + d]!) ** 2;
  const sc = s.scale ?? 1;
  return Math.exp(-acc / s.dim / (2 * sc * sc));
}

/**
 * Checkerboard-kernel novelty along the diagonal of the (banded, weighted)
 * self-similarity matrix: Gaussian-weighted mean similarity within the past and
 * future blocks minus that across them. Positions without enough context on
 * both sides (half a kernel) score 0, so song edges are not mistaken for boundaries.
 */
export function noveltyCurve(x: SectionInput, halfWidth: number, smoothBeats = 4): Float32Array {
  const n = x.count;
  const L = halfWidth;
  const W = 2 * L + 1;
  const band = new Float32Array(n * W);
  for (const s of x.sets) {
    const f = prepare(s, n, smoothBeats);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < W && i + d < n; d++) band[i * W + d]! += s.weight * similarity(s, f, i * s.dim, f, (i + d) * s.dim);
    }
  }
  const sim = (a: number, b: number) => (a <= b ? band[a * W + (b - a)]! : band[b * W + (a - b)]!);
  const g = new Float32Array(2 * L);
  for (let a = -L; a < L; a++) g[a + L] = Math.exp(-0.5 * ((a + 0.5) / (L / 2)) ** 2);
  const nov = new Float32Array(n);
  const need = Math.ceil(L / 2);
  for (let i = need; i + need <= n; i++) {
    // Near the ends the kernel shrinks symmetrically so both blocks have equal support.
    const m = Math.min(L, i, n - i);
    let within = 0;
    let wW = 0;
    let cross = 0;
    let wC = 0;
    for (let a = -m; a < m; a++) {
      const ia = i + a;
      for (let b = a; b < m; b++) {
        const ib = i + b;
        const k = g[a + L]! * g[b + L]!;
        if ((a < 0) === (b < 0)) {
          within += k * sim(ia, ib);
          wW += k;
        } else {
          cross += k * sim(ia, ib);
          wC += k;
        }
      }
    }
    nov[i] = wW > 0 && wC > 0 ? Math.max(0, within / wW - cross / wC) : 0;
  }
  return nov;
}

/**
 * Boundary beat indices (excluding 0), ascending. Novelty is valid on
 * [validFrom, validTo); a peak must be the maximum within ±minBeats/2 and
 * drop on both sides (prominence) inside the valid range.
 */
export function pickBoundaries(nov: Float32Array, o: SectionOptions, validFrom: number, validTo: number): number[] {
  const n = nov.length;
  const lo = Math.max(validFrom + 1, o.minBeats);
  const hi = Math.min(validTo - 2, n - o.minBeats);
  if (hi < lo) return [];
  let mean = 0;
  let max = 0;
  for (let i = validFrom; i < validTo; i++) {
    mean += nov[i]!;
    max = Math.max(max, nov[i]!);
  }
  mean /= validTo - validFrom;
  let sd = 0;
  for (let i = validFrom; i < validTo; i++) sd += (nov[i]! - mean) ** 2;
  sd = Math.sqrt(sd / (validTo - validFrom));
  if (max <= 1e-6) return [];
  const half = Math.floor(o.minBeats / 2);
  const cands: number[] = [];
  for (let i = lo; i <= hi; i++) {
    let isMax = true;
    for (let j = Math.max(validFrom, i - half); j <= Math.min(validTo - 1, i + half); j++) {
      if (nov[j]! > nov[i]! || (nov[j] === nov[i] && j < i)) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;
    let left = Infinity;
    let right = Infinity;
    for (let j = Math.max(validFrom, i - o.halfWidth); j < i; j++) left = Math.min(left, nov[j]!);
    for (let j = i + 1; j <= Math.min(validTo - 1, i + o.halfWidth); j++) right = Math.min(right, nov[j]!);
    const prom = nov[i]! - Math.max(left, right);
    if (Number.isFinite(prom) && prom > 0.15 * nov[i]!) cands.push(i);
  }
  cands.sort((a, b) => nov[b]! - nov[a]!);
  const chosen: number[] = [];
  const thr = Math.max(mean + sd, 0.3 * max);
  for (const i of cands) {
    if (chosen.length >= o.maxSections - 1) break;
    // The strongest candidate is always accepted so a long song gets at least two parts.
    if (chosen.length > 0 && nov[i]! < thr) break;
    if (chosen.every((b) => Math.abs(b - i) >= o.minBeats)) chosen.push(i);
  }
  return chosen.sort((a, b) => a - b);
}

function centroid(f: Float32Array, dim: number, a: number, b: number, unit: boolean): Float64Array {
  const c = new Float64Array(dim);
  for (let i = a; i < b; i++) for (let d = 0; d < dim; d++) c[d]! += f[i * dim + d]!;
  let nn = 0;
  for (let d = 0; d < dim; d++) {
    c[d]! /= Math.max(1, b - a);
    nn += c[d]! ** 2;
  }
  if (unit && nn > 0) for (let d = 0; d < dim; d++) c[d]! /= Math.sqrt(nn);
  return c;
}

/**
 * Fine localisation of a coarse boundary p: centroids of the (unsmoothed)
 * features well inside the left and right sections are built, and the split
 * j ∈ [p − radius, p + radius] maximising the similarity of rows before j to
 * the left centroid and from j on to the right one is chosen (a 1-D
 * change-point fit). One feature set is used, so a feature that barely changes
 * here adds no noise: sets are in priority order (most precise first) and the
 * first whose centroids differ by at least `REFINE_CONTRAST` wins; otherwise
 * the most contrasting set.
 */
const REFINE_CONTRAST = 0.25;

export function refineBoundary(x: SectionInput, prepared: Float32Array[], p: number, radius: number, ctx: number, lo: number, hi: number): number {
  const a0 = Math.max(lo, p - ctx);
  const a1 = Math.max(a0 + 1, p - radius);
  const b0 = Math.min(hi - 1, p + radius);
  const b1 = Math.min(hi, p + ctx);
  if (a1 - a0 < 2 || b1 - b0 < 2) return p;
  const from = a1;
  const to = b0;
  let k = -1;
  let contrast = 0;
  let cl: Float64Array = new Float64Array(0);
  let cr: Float64Array = new Float64Array(0);
  for (let q = 0; q < x.sets.length; q++) {
    const s = x.sets[q]!;
    const f = prepared[q]!;
    const l = centroid(f, s.dim, a0, a1, s.kind === 'cosine');
    const r = centroid(f, s.dim, b0, b1, s.kind === 'cosine');
    const c = s.weight * (1 - similarity(s, l, 0, r, 0));
    if (c >= REFINE_CONTRAST) {
      [k, contrast, cl, cr] = [q, c, l, r];
      break;
    }
    if (c > contrast) [k, contrast, cl, cr] = [q, c, l, r];
  }
  if (k < 0) return p;
  const s = x.sets[k]!;
  const f = prepared[k]!;
  // Per-row fit to a centroid: cosine for chroma; for levels a Laplacian
  // log-likelihood (−mean |dB difference| / scale), which, unlike the Gaussian
  // similarity, does not saturate when a row is far from both centroids.
  const fit = (i: number, c: Float64Array) => {
    if (s.kind === 'cosine') return similarity(s, f, i * s.dim, c, 0);
    let acc = 0;
    for (let d = 0; d < s.dim; d++) acc += Math.abs(f[i * s.dim + d]! - c[d]!);
    return -acc / s.dim / (s.scale ?? 1);
  };
  // diff[i] = fit(row_i, left) − fit(row_i, right); choose j maximising Σ_{i<j} diff[i].
  const diff = new Float64Array(to - from);
  for (let i = from; i < to; i++) diff[i - from] = fit(i, cl) - fit(i, cr);
  let best = p;
  let bestScore = -Infinity;
  let run = 0;
  for (let j = from; j <= to; j++) {
    if (j > from) run += diff[j - 1 - from]!;
    // Ties go to the split nearest the coarse peak.
    const score = run - 1e-6 * Math.abs(j - p);
    if (score > bestScore) {
      bestScore = score;
      best = j;
    }
  }
  return best;
}

/** Labels for sections [bounds[i], bounds[i+1]) by greedy clustering of mean features. */
export function labelSections(x: SectionInput, prepared: Float32Array[], bounds: readonly number[]): string[] {
  const means = bounds.slice(0, -1).map((b, s) => x.sets.map((set, k) => centroid(prepared[k]!, set.dim, b, bounds[s + 1]!, set.kind === 'cosine')));
  const labels: string[] = [];
  const reps: { label: string; idx: number }[] = [];
  for (let s = 0; s < means.length; s++) {
    let best: { label: string; sim: number } | null = null;
    for (const r of reps) {
      let ok = true;
      let total = 0;
      x.sets.forEach((set, k) => {
        const v = similarity(set, means[s]![k]!, 0, means[r.idx]![k]!, 0);
        if (v < set.sameLabel) ok = false;
        total += set.weight * v;
      });
      if (ok && (!best || total > best.sim)) best = { label: r.label, sim: total };
    }
    if (best) labels.push(best.label);
    else {
      const label = reps.length < 26 ? String.fromCharCode(65 + reps.length) : `Part ${reps.length + 1}`;
      reps.push({ label, idx: s });
      labels.push(label);
    }
  }
  return labels;
}

export function segmentSections(x: SectionInput, o: SectionOptions = DEFAULT_SECTION_OPTIONS): { boundaries: number[]; labels: string[]; novelty: Float32Array } {
  if (x.count === 0) return { boundaries: [0], labels: ['A'], novelty: new Float32Array(0) };
  const L = Math.min(o.halfWidth, Math.max(2, Math.floor(x.count / 4)));
  const novelty = noveltyCurve(x, L, o.smoothBeats);
  const need = Math.ceil(L / 2);
  const coarse = pickBoundaries(novelty, { ...o, halfWidth: L }, need, x.count - need + 1);
  const raw = x.sets.map((s) => prepare(s, x.count, 0));
  const inner: number[] = [];
  coarse.forEach((p, k) => {
    const lo = k > 0 ? coarse[k - 1]! : 0;
    const hi = k + 1 < coarse.length ? coarse[k + 1]! : x.count;
    const j = refineBoundary(x, raw, p, Math.floor(o.minBeats / 2), L, lo, hi);
    const prev = inner.length ? inner[inner.length - 1]! : 0;
    if (j - prev >= o.minBeats && x.count - j >= o.minBeats) inner.push(j);
    else if (p - prev >= o.minBeats) inner.push(p);
  });
  const boundaries = [0, ...inner];
  const labels = labelSections(x, raw, [...boundaries, x.count]);
  return { boundaries, labels, novelty };
}
