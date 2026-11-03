/**
 * Leakage regression (AC-18, §5.4): the app's own sound must not earn a
 * successful assessed performance in supported configurations.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import type { Score } from '../../src/domain/score';
import { StreamAnalyzer } from '../../src/audio/dsp/analyzer';
import { renderClick, renderPluck } from '../../src/audio/dsp/pluckSynth';
import { FixedTempoMatcher } from '../../src/assessment/matcher';
import { SignalTimeline } from '../../src/assessment/timeline';
import { guidePolicy } from '../../src/assessment/guidePolicy';
import { midiToHz } from '../../src/domain/tuning';
import { placeAt, whiteNoise, mix } from '../fixtures/signals';
import type { TargetInstance } from '../../src/assessment/types';

const score = fixture as Score;
const sr = 48000;
const t0 = 1;

function analyze(sig: Float32Array, blockGuide: boolean) {
  const an = new StreamAnalyzer({ sampleRate: sr });
  const tl = new SignalTimeline();
  if (blockGuide) tl.block(0, 100, 'guide_audible_on_speakers');
  const m = new FixedTempoMatcher({ deltaIO: 0, calibrated: false, rhythmEnabled: true, simulated: false }, tl);
  score.events.forEach((e, i) => {
    const t: TargetInstance = { key: e.id, attemptId: 1, loopIteration: 0, event: e, contextTime: t0 + i, gapBeforeSec: 1, gapAfterSec: 1 };
    m.addTarget(t);
  });
  for (let o = 0; o < sig.length; o += 512) {
    for (const out of an.push(sig.subarray(o, o + 512), o)) {
      if (out.type === 'frame') tl.add(out.frame.hopStartSec, out.frame.endSec, out.frame.inputQuality);
      else m.addAttack(out.attack);
    }
  }
  return m.finalize(100);
}

describe('leakage regression', () => {
  it('policy mutes the guide on speakers/unknown while assessing, allows it on headphones', () => {
    expect(guidePolicy({ guideOn: true, route: 'speakers', assessing: true }).guideAudible).toBe(false);
    expect(guidePolicy({ guideOn: true, route: 'unknown', assessing: true }).guideAudible).toBe(false);
    expect(guidePolicy({ guideOn: true, route: 'headphones', assessing: true }).guideAudible).toBe(true);
    expect(guidePolicy({ guideOn: true, route: 'speakers', assessing: false }).guideAudible).toBe(true);
  });

  it('metronome clicks alone (guide muted on speakers) never produce a correct note', () => {
    const clicks = placeAt(sr, 10, Array.from({ length: 9 }, (_, i) => ({ atSec: t0 + i, sig: renderClick(sr, i % 4 === 0) })));
    const js = analyze(mix(clicks, whiteNoise(sr, 10, 0.0005)), false);
    expect(js).toHaveLength(8);
    expect(js.filter((j) => j.state === 'correct' || j.pitchState === 'correct')).toHaveLength(0);
  });

  it('if the synth guide leaks into the mic, the blocked span is not assessed (no false success)', () => {
    const guide = placeAt(sr, 10, score.events.map((e, i) => ({ atSec: t0 + i, sig: renderPluck(sr, midiToHz(e.pitchMidi), 1.2) })));
    // Sanity: unblocked, the detector would indeed "hear" the guide — which is why it is muted/blocked.
    const unguarded = analyze(guide, false);
    expect(unguarded.filter((j) => j.state === 'correct').length).toBeGreaterThan(4);
    const guarded = analyze(guide, true);
    expect(guarded.every((j) => j.state === 'not_assessed')).toBe(true);
  });
});
