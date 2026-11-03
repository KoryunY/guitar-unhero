/**
 * Bundled original exercise scores. The supplied fixture is imported from
 * Documents/ so it is never duplicated or allowed to drift.
 *
 * Every score here is project-authored, monophonic, standard tuning, 4/4 and a
 * single tempo (gu-score/1). Hammered, pulled and slid notes in the technique
 * scores are marked not assessed: the app only judges picked notes.
 */
import type { Score } from '../domain/score';
import firstTwoStrings from '../../Documents/original-exercise.gu-score.json';
import highEOpen from './exercises/high-e-open.gu-score.json';
import highEFrets from './exercises/high-e-frets.gu-score.json';
import bStringFrets from './exercises/b-string-frets.gu-score.json';
import pulseQuarters from './exercises/pulse-quarters.gu-score.json';
import morningSteps from './exercises/morning-steps.gu-score.json';
import longNotes from './exercises/long-notes.gu-score.json';
// Curriculum 1.0 (songs, riffs, blues, lead, theory, Knockoff Hero, metal).
import fingerpickArpeggios from './exercises/fingerpick-arpeggios.gu-score.json';
import travisCG from './exercises/travis-c-g.gu-score.json';
import lowStrings from './exercises/low-strings.gu-score.json';
import basementStomp from './exercises/basement-stomp.gu-score.json';
import garageDoor from './exercises/garage-door.gu-score.json';
import aMinorPentBox1 from './exercises/a-minor-pent-box1.gu-score.json';
import callAndResponse from './exercises/call-and-response.gu-score.json';
import hammerOns from './exercises/hammer-ons.gu-score.json';
import pullOffs from './exercises/pull-offs.gu-score.json';
import slides from './exercises/slides.gu-score.json';
import cMajorOpen from './exercises/c-major-open.gu-score.json';
import chordFills from './exercises/chord-fills.gu-score.json';
import octaveMelody from './exercises/octave-melody.gu-score.json';
import eMinorPentOpen from './exercises/e-minor-pent-open.gu-score.json';
import bootlegLegend from './exercises/bootleg-legend.gu-score.json';
import chugs from './exercises/chugs.gu-score.json';
import gallop from './exercises/gallop.gu-score.json';
import spiderLadder from './exercises/spider-ladder.gu-score.json';
import metalBoss from './exercises/metal-boss.gu-score.json';

export const BUNDLED_SCORES: readonly Score[] = [
  highEOpen as Score,
  pulseQuarters as Score,
  highEFrets as Score,
  bStringFrets as Score,
  firstTwoStrings as Score,
  longNotes as Score,
  morningSteps as Score,
  fingerpickArpeggios as Score,
  travisCG as Score,
  lowStrings as Score,
  basementStomp as Score,
  garageDoor as Score,
  aMinorPentBox1 as Score,
  callAndResponse as Score,
  hammerOns as Score,
  pullOffs as Score,
  slides as Score,
  cMajorOpen as Score,
  chordFills as Score,
  octaveMelody as Score,
  eMinorPentOpen as Score,
  bootlegLegend as Score,
  chugs as Score,
  gallop as Score,
  spiderLadder as Score,
  metalBoss as Score,
];

export function findBundledScore(arrangementId: string): Score | undefined {
  return BUNDLED_SCORES.find((s) => s.arrangementId === arrangementId);
}
