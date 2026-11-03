/**
 * Monophonic fingering planner (master spec §7.5). Enumerates pitch-compatible
 * positions f = p − T(s) − C within the profile's fret range and chooses a
 * sequence by dynamic programming over a transparent cost:
 *   handShift + fretSpan + stringCrossing + higherFret + fingerChange.
 * Weights are configuration to review with a teacher, not measured difficulty.
 * If any pitch has no position, the result says so — never an impossible tab.
 */
import type { Finger, StringNumber } from './score';
import { openMidi, STRING_NUMBERS } from './tuning';

export interface FingeringProfile {
  id: string;
  minFret: number;
  maxFret: number;
  capo: number;
  weights: { handShift: number; stringCrossing: number; higherFret: number; openStringBonus: number };
}

export const BEGINNER_PROFILE: FingeringProfile = {
  id: 'beginner-open-0-3',
  minFret: 0,
  maxFret: 3,
  capo: 0,
  weights: { handShift: 2, stringCrossing: 0.6, higherFret: 0.25, openStringBonus: 0.3 },
};

export const OPEN_POSITION_PROFILE: FingeringProfile = { ...BEGINNER_PROFILE, id: 'open-0-5', maxFret: 5 };
export const FULL_NECK_PROFILE: FingeringProfile = { ...BEGINNER_PROFILE, id: 'full-0-12', maxFret: 12, weights: { ...BEGINNER_PROFILE.weights, handShift: 1 } };

export interface Position {
  string: StringNumber;
  fret: number;
  finger: Finger;
}

export function positionsFor(pitch: number, profile: FingeringProfile): Position[] {
  const out: Position[] = [];
  for (const s of STRING_NUMBERS) {
    const f = pitch - openMidi(s) - profile.capo;
    if (f >= profile.minFret && f <= profile.maxFret) out.push({ string: s, fret: f, finger: defaultFinger(f) });
  }
  return out;
}

/** One-finger-per-fret default in open position (fret n → finger n, capped at 4). */
export function defaultFinger(fret: number, handPos = 1): Finger {
  if (fret === 0) return null;
  const f = fret - handPos + 1;
  return (f >= 1 && f <= 4 ? f : Math.min(4, Math.max(1, f))) as Finger;
}

/** Hand position (index finger fret) implied by a fretted note; open strings don't move the hand. */
function handFor(p: Position): number | null {
  if (p.fret === 0) return null;
  return p.fret <= 4 ? 1 : p.fret - 3;
}

export type FingeringResult =
  | { ok: true; positions: Position[]; cost: number }
  | { ok: false; reason: 'no_playable_fingering'; impossibleIndexes: number[] };

export function planFingering(pitches: readonly number[], profile: FingeringProfile = BEGINNER_PROFILE): FingeringResult {
  const options = pitches.map((p) => positionsFor(p, profile));
  const impossible = options.map((o, i) => (o.length === 0 ? i : -1)).filter((i) => i >= 0);
  if (impossible.length) return { ok: false, reason: 'no_playable_fingering', impossibleIndexes: impossible };
  if (pitches.length === 0) return { ok: true, positions: [], cost: 0 };
  const w = profile.weights;
  const local = (p: Position) => p.fret * w.higherFret - (p.fret === 0 ? w.openStringBonus : 0);
  const trans = (a: Position, b: Position) => {
    const ha = handFor(a);
    const hb = handFor(b);
    const shift = ha !== null && hb !== null ? Math.abs(ha - hb) : 0;
    return shift * w.handShift + Math.abs(a.string - b.string) * w.stringCrossing;
  };
  // Viterbi over positions.
  let cost = options[0]!.map(local);
  const back: number[][] = [];
  for (let i = 1; i < options.length; i++) {
    const cur = options[i]!;
    const prev = options[i - 1]!;
    const nc: number[] = [];
    const bp: number[] = [];
    for (let j = 0; j < cur.length; j++) {
      let best = Infinity;
      let arg = 0;
      for (let k = 0; k < prev.length; k++) {
        const c = cost[k]! + trans(prev[k]!, cur[j]!);
        if (c < best) {
          best = c;
          arg = k;
        }
      }
      nc.push(best + local(cur[j]!));
      bp.push(arg);
    }
    cost = nc;
    back.push(bp);
  }
  let j = cost.indexOf(Math.min(...cost));
  const total = cost[j]!;
  const path: Position[] = new Array(options.length);
  for (let i = options.length - 1; i >= 0; i--) {
    path[i] = options[i]![j]!;
    if (i > 0) j = back[i - 1]![j]!;
  }
  // Finger numbers relative to the chosen hand position of each fretted note.
  const positions = path.map((p) => ({ ...p, finger: p.fret === 0 ? null : defaultFinger(p.fret, handFor(p) ?? 1) }));
  return { ok: true, positions, cost: Math.round(total * 100) / 100 };
}
