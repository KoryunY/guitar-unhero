/** Assessment contracts (master spec §6.5, §9.2). */
import type { NoteEvent } from '../domain/score';

export type AssessmentState = 'correct' | 'incorrect' | 'uncertain' | 'not_assessed';

export interface Judgment {
  attemptId: string;
  targetKey: string;
  targetEventId: string;
  loopIteration: number;
  observationIds: string[];
  state: AssessmentState;
  pitchState: AssessmentState;
  rhythmState: AssessmentState;
  timingErrorMs: number | null;
  pitchErrorCents: number | null;
  observedMidi: number | null;
  targetMidi: number;
  reasonCodes: string[];
  policyVersion: string;
  simulated: boolean;
}

export interface MatchPolicy {
  version: string;
  pitchToleranceCents: number;
  attackToleranceSec: number;
  /** Wider window used when timing is uncalibrated; results are labeled approximate. */
  uncalibratedAttackToleranceSec: number;
  /** Search window for candidate attacks (bounded by half the gap to neighbours). */
  searchWindowSec: number;
  octaveToleranceCents: number;
}

export const BEGINNER_POLICY: MatchPolicy = {
  version: 'beginner-1',
  pitchToleranceCents: 50,
  attackToleranceSec: 0.15,
  uncalibratedAttackToleranceSec: 0.25,
  searchWindowSec: 0.4,
  octaveToleranceCents: 60,
};

export interface TargetInstance {
  key: string;
  attemptId: number;
  loopIteration: number;
  event: NoteEvent;
  /** Scheduled context time of the intended heard onset (cTarget). */
  contextTime: number;
  /** Context-time gaps to neighbouring targets (Infinity if none). */
  gapBeforeSec: number;
  gapAfterSec: number;
}

/**
 * Combined state from enabled dimensions only: any confidently incorrect → incorrect;
 * all enabled assessed and correct → correct; nothing assessed and nothing ambiguous →
 * not_assessed; otherwise uncertain.
 */
export function combineStates(dims: AssessmentState[]): AssessmentState {
  const enabled = dims.filter((d) => d !== 'not_assessed');
  if (dims.includes('incorrect')) return 'incorrect';
  if (enabled.length === 0) return 'not_assessed';
  if (enabled.every((d) => d === 'correct')) return 'correct';
  return 'uncertain';
}
