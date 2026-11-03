/**
 * Global key: Krumhansl–Schmuckler correlation of a whole-song pitch-class
 * profile with the 24 rotated Krumhansl–Kessler major/minor profiles.
 * The song profile is the duration-weighted sum of (unit-normalised) treble
 * chroma plus half-weighted bass chroma, so chord roots count a little more.
 */
import type { SongKey } from './types';
import type { BeatChroma } from './chroma';

export const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: ArrayLike<number>, b: ArrayLike<number>, rot: number): number {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < 12; i++) {
    ma += a[i]!;
    mb += b[i]!;
  }
  ma /= 12;
  mb /= 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[(i + rot) % 12]! - ma;
    const y = b[i]! - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

/** Key from a 12-bin pitch-class profile. */
export function keyFromProfile(profile: ArrayLike<number>): SongKey & { scores: number[] } {
  const scores: number[] = [];
  for (let t = 0; t < 12; t++) scores.push(pearson(profile, KK_MAJOR, t));
  for (let t = 0; t < 12; t++) scores.push(pearson(profile, KK_MINOR, t));
  let best = 0;
  for (let i = 1; i < 24; i++) if (scores[i]! > scores[best]!) best = i;
  const sorted = [...scores].sort((a, b) => b - a);
  const margin = sorted[0]! - sorted[1]!;
  const r = sorted[0]!;
  const confidence = r <= 0 ? 0 : Math.max(0, Math.min(1, r)) * Math.max(0, Math.min(1, margin / 0.1 + 0.2));
  return { tonic: best % 12, mode: best < 12 ? 'major' : 'minor', confidence: Math.round(100 * confidence) / 100, scores };
}

/** Song profile from beat chroma (intervals weighted by duration; silent ones skipped). */
export function songProfile(bc: BeatChroma, durations: ArrayLike<number>, silent: Uint8Array): Float64Array {
  const prof = new Float64Array(12);
  for (let i = 0; i < bc.count; i++) {
    if (silent[i]) continue;
    let tn = 0;
    let bn = 0;
    for (let c = 0; c < 12; c++) {
      tn += bc.treble[i * 12 + c]! ** 2;
      bn += bc.bass[i * 12 + c]! ** 2;
    }
    tn = Math.sqrt(tn);
    bn = Math.sqrt(bn);
    const d = durations[i]!;
    for (let c = 0; c < 12; c++) {
      if (tn > 0) prof[c]! += (d * bc.treble[i * 12 + c]!) / tn;
      if (bn > 0) prof[c]! += (0.5 * d * bc.bass[i * 12 + c]!) / bn;
    }
  }
  return prof;
}
