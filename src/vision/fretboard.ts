/**
 * Camera experiment geometry (master spec §8). The learner marks four points on
 * a still frame: the nut and fret 5 at the low-E edge and at the high-E edge.
 * A planar homography maps image points into fretboard coordinates
 * (u = distance along the neck from the nut, in fret-5 lengths; v = 0 at
 * string 6 … 1 at string 1). Fret lines follow the 12th-root spacing rule.
 *
 * This only supports *rough region* statements about a fingertip landmark that
 * appears over the calibrated plane. It can never tell whether a finger touches
 * a string, which string is pressed, or how hard — those claims are not made.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface Calibration {
  /** Image points (normalized 0..1): [nut@string6, nut@string1, fret5@string1, fret5@string6]. */
  corners: [Pt, Pt, Pt, Pt];
  createdAt: string;
}

/** Solve the 3×3 homography H with H·src_i ∝ dst_i for four point pairs. */
export function homography(src: readonly Pt[], dst: readonly Pt[]): number[] | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting.
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (Math.abs(A[p]![c]!) < 1e-12) return null;
    [A[c], A[p]] = [A[p]!, A[c]!];
    [b[c], b[p]] = [b[p]!, b[c]!];
    for (let r = c + 1; r < n; r++) {
      const f = A[r]![c]! / A[c]![c]!;
      for (let k = c; k < n; k++) A[r]![k]! -= f * A[c]![k]!;
      b[r]! -= f * b[c]!;
    }
  }
  const h = new Array<number>(8).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let k = r + 1; k < n; k++) s -= A[r]![k]! * h[k]!;
    h[r] = s / A[r]![r]!;
  }
  return [...h, 1];
}

export function apply(H: readonly number[], p: Pt): Pt | null {
  const w = H[6]! * p.x + H[7]! * p.y + H[8]!;
  if (Math.abs(w) < 1e-12) return null;
  return { x: (H[0]! * p.x + H[1]! * p.y + H[2]!) / w, y: (H[3]! * p.x + H[4]! * p.y + H[5]!) / w };
}

/** Distance from the nut to fret n as a fraction of the nut→fret-5 distance. */
export function fretPosition(n: number): number {
  const d = (k: number) => 1 - 2 ** (-k / 12);
  return d(n) / d(5);
}

/** Board coordinates for the four calibration corners (u along the neck, v across strings). */
export const BOARD_CORNERS: [Pt, Pt, Pt, Pt] = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
];

export function calibrationHomography(c: Calibration): number[] | null {
  const pts = c.corners;
  // Reject degenerate marks (points too close together).
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) < 0.03) return null;
  return homography(pts, BOARD_CORNERS);
}

export type RegionEvidence =
  | { kind: 'not_visible'; text: string }
  | { kind: 'off_board'; text: string }
  | { kind: 'region'; fretFrom: number; fretTo: number; text: string };

/**
 * Rough fret region for a fingertip image point. Returns a span (e.g. "between
 * the nut and fret 1" or "around frets 2–3"), never a single exact fret.
 */
export function fretRegion(H: readonly number[], tip: Pt | null): RegionEvidence {
  if (!tip) return { kind: 'not_visible', text: "I can't see your fretting hand clearly." };
  const b = apply(H, tip);
  if (!b || b.y < -0.25 || b.y > 1.25 || b.x < -0.15 || b.x > 1.15) return { kind: 'off_board', text: 'Your fingertip is outside the area you marked.' };
  // Find the fret space the projected point falls into.
  let n = 0;
  while (n < 5 && fretPosition(n + 1) < b.x) n++;
  const from = Math.max(0, n - (b.x - fretPosition(n) < 0.2 * (fretPosition(n + 1) - fretPosition(n)) ? 1 : 0));
  const to = Math.min(5, n + 1);
  const text = from === 0 && to === 1 ? 'Roughly between the nut and fret 1.' : `Roughly around frets ${Math.max(1, from)}–${to}.`;
  return { kind: 'region', fretFrom: from, fretTo: to, text };
}

/** Evidence older than this cannot support anything (spec §8.3). */
export const VISION_FRESHNESS_MS = 250;

export function isFresh(producedAtMs: number, nowMs: number): boolean {
  return nowMs - producedAtMs <= VISION_FRESHNESS_MS;
}
