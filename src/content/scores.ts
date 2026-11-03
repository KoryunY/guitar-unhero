/**
 * Bundled original exercise scores. The supplied fixture is imported from
 * Documents/ so it is never duplicated or allowed to drift.
 */
import type { Score } from '../domain/score';
import firstTwoStrings from '../../Documents/original-exercise.gu-score.json';
import highEOpen from './exercises/high-e-open.gu-score.json';
import highEFrets from './exercises/high-e-frets.gu-score.json';
import bStringFrets from './exercises/b-string-frets.gu-score.json';
import pulseQuarters from './exercises/pulse-quarters.gu-score.json';
import morningSteps from './exercises/morning-steps.gu-score.json';
import longNotes from './exercises/long-notes.gu-score.json';

export const BUNDLED_SCORES: readonly Score[] = [
  highEOpen as Score,
  pulseQuarters as Score,
  highEFrets as Score,
  bStringFrets as Score,
  firstTwoStrings as Score,
  longNotes as Score,
  morningSteps as Score,
];

export function findBundledScore(arrangementId: string): Score | undefined {
  return BUNDLED_SCORES.find((s) => s.arrangementId === arrangementId);
}
