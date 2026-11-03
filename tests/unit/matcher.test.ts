import { describe, expect, it } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import type { NoteEvent, Score } from '../../src/domain/score';
import type { AttackObservation } from '../../src/audio/observations';
import { FixedTempoMatcher, WaitTargetJudge, type MatchContext } from '../../src/assessment/matcher';
import { SignalTimeline } from '../../src/assessment/timeline';
import { combineStates, type Judgment, type TargetInstance } from '../../src/assessment/types';
import { computeStats, suggestNext } from '../../src/assessment/summary';

const score = fixture as Score;
const ev = (id: string) => score.events.find((e) => e.id === id)! as NoteEvent;
let seq = 0;
function attack(onset: number, midi: number | null, quality: AttackObservation['quality'] = 'good', simulated = false): AttackObservation {
  seq++;
  return {
    id: `a${seq}`, providerId: 'test', onsetContextSec: onset, analysisStartContextSec: onset, analysisEndContextSec: onset + 0.14,
    producedAtPerformanceMs: 0, pitchHz: midi === null ? null : 440 * 2 ** ((midi - 69) / 12), pitchMidiFloat: midi, quality,
    modelScore: 0.9, peakDb: -12, frames: 5, reasonCodes: [], simulated,
  };
}
function target(e: NoteEvent, c: number, loopIteration = 0, gap = 1): TargetInstance {
  return { key: `1:1:${loopIteration}:${e.id}`, attemptId: 1, loopIteration, event: e, contextTime: c, gapBeforeSec: gap, gapAfterSec: gap };
}
const ctx = (over: Partial<MatchContext> = {}): MatchContext => ({ deltaIO: 0, calibrated: true, rhythmEnabled: true, simulated: false, ...over });
function goodTimeline(from = 0, to = 100) {
  const tl = new SignalTimeline();
  for (let t = from; t < to; t += 0.01) tl.add(t, t + 0.0107, 'good');
  return tl;
}

describe('combined state rules', () => {
  it('derives the combined state from enabled dimensions only', () => {
    expect(combineStates(['correct', 'correct'])).toBe('correct');
    expect(combineStates(['correct', 'incorrect'])).toBe('incorrect');
    expect(combineStates(['correct', 'not_assessed'])).toBe('correct');
    expect(combineStates(['not_assessed', 'not_assessed'])).toBe('not_assessed');
    expect(combineStates(['uncertain', 'correct'])).toBe('uncertain');
  });
});

describe('fixed-tempo matcher', () => {
  it('scores correct pitch and timing; correct pitch + late attack recorded independently (AC-16)', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addTarget(target(ev('n2'), 11));
    m.addAttack(attack(10.02, 64.1));
    m.addAttack(attack(11.3, 65)); // 300 ms late, right pitch
    const js = m.finalize(20);
    expect(js[0]).toMatchObject({ state: 'correct', pitchState: 'correct', rhythmState: 'correct', timingErrorMs: 20 });
    expect(js[1]).toMatchObject({ state: 'incorrect', pitchState: 'correct', rhythmState: 'incorrect', timingErrorMs: 300 });
    expect(js[1]!.reasonCodes).toContain('late');
  });

  it('applies the calibrated offset once: timingError = cObserved − cTarget − deltaIO', () => {
    const m = new FixedTempoMatcher(ctx({ deltaIO: 0.08 }), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addAttack(attack(10.1, 64));
    expect(m.finalize(20)[0]!.timingErrorMs).toBe(20);
  });

  it('one held attack cannot clear repeated targets (AC-14)', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    // Four repeated E4 targets; one attack only.
    const e = ev('n1');
    for (let i = 0; i < 4; i++) m.addTarget({ ...target(e, 10 + i), key: `k${i}` });
    m.addAttack(attack(10.01, 64));
    const js = m.finalize(30);
    expect(js.filter((j) => j.state === 'correct')).toHaveLength(1);
    expect(js.slice(1).every((j) => j.reasonCodes.includes('no_attack_detected'))).toBe(true);
  });

  it('a burst of attacks earns at most one credit per target; extras are counted, not credited', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addAttack(attack(9.95, 64));
    m.addAttack(attack(10.05, 64));
    m.addAttack(attack(10.15, 64));
    const js = m.finalize(30);
    expect(js).toHaveLength(1);
    expect(js[0]!.observationIds).toHaveLength(1);
    expect(js[0]!.timingErrorMs).toBe(-50);
    m.finalize(40);
    expect(m.extras).toBe(2);
  });

  it('windows never overlap at fast tempos: one attack cannot serve two adjacent targets', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget({ ...target(ev('n1'), 10, 0, 0.25), key: 'a' });
    m.addTarget({ ...target(ev('n4'), 10.25, 0, 0.25), key: 'b' });
    m.addAttack(attack(10.12, 64));
    const js = m.finalize(30);
    expect(js.filter((j) => j.observationIds.length > 0)).toHaveLength(1);
  });

  it('a later correct note does not erase an earlier miss', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addTarget(target(ev('n2'), 11));
    m.addAttack(attack(11.0, 65));
    const js = m.finalize(30);
    expect(js[0]!.reasonCodes).toContain('no_attack_detected');
    expect(js[1]!.state).toBe('correct');
  });

  it('loop iterations score the same note again without duplicate credit', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n2'), 10, 0));
    m.addTarget(target(ev('n2'), 12, 1));
    m.addTarget(target(ev('n2'), 12, 1)); // duplicate registration ignored
    m.addAttack(attack(10, 65));
    m.addAttack(attack(12, 65));
    const js = m.finalize(30);
    expect(js).toHaveLength(2);
    expect(js.map((j) => j.loopIteration)).toEqual([0, 1]);
    expect(js.every((j) => j.state === 'correct')).toBe(true);
  });

  it('wrong pitch is an assessed mismatch; octave-only difference is uncertain', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n3'), 10));
    m.addTarget(target(ev('n1'), 11));
    m.addAttack(attack(10, 65)); // F instead of G
    m.addAttack(attack(11, 76)); // E5 instead of E4
    const js = m.finalize(30);
    expect(js[0]).toMatchObject({ pitchState: 'incorrect', state: 'incorrect' });
    expect(js[1]).toMatchObject({ pitchState: 'uncertain', state: 'uncertain' });
    expect(js[1]!.reasonCodes).toContain('octave_ambiguous');
  });

  it('missing listening produces not_assessed, never a miss (AC-15)', () => {
    const m = new FixedTempoMatcher(ctx(), new SignalTimeline());
    m.addTarget(target(ev('n1'), 10));
    const js = m.finalize(30);
    expect(js[0]).toMatchObject({ state: 'not_assessed', pitchState: 'not_assessed', rhythmState: 'not_assessed' });
    const stats = computeStats(js, { rhythmEnabled: true, calibrated: true });
    expect(stats.pitch.accuracy).toBeNull();
    expect(stats.coverage).toBe(0);
  });

  it('poor (clipped) signal without an attack is uncertain, and blocked spans are not assessed', () => {
    const tl = new SignalTimeline();
    for (let t = 0; t < 30; t += 0.01) tl.add(t, t + 0.01, 'poor', 'clipping');
    const m = new FixedTempoMatcher(ctx(), tl);
    m.addTarget(target(ev('n1'), 10));
    expect(m.finalize(30)[0]).toMatchObject({ state: 'uncertain' });

    const tl2 = goodTimeline();
    tl2.block(0, 100, 'guide_audible_on_speakers');
    const m2 = new FixedTempoMatcher(ctx(), tl2);
    m2.addTarget(target(ev('n1'), 10));
    m2.addAttack(attack(10, 64));
    const j = m2.finalize(30)[0]!;
    expect(j.state).toBe('not_assessed');
    expect(j.reasonCodes).toContain('guide_audible_on_speakers');
  });

  it('an unpitched attack (e.g. a leaked click) is never matched and its timing is never graded', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addAttack(attack(10, null, 'unavailable'));
    const j = m.finalize(30)[0]!;
    expect(j.observationIds).toEqual([]);
    expect(j.rhythmState).not.toBe('correct');
    expect(j.reasonCodes).toContain('no_attack_detected');
  });

  it('unstable pitch evidence gives uncertain pitch, not incorrect', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addAttack(attack(10, 66, 'poor'));
    expect(m.finalize(30)[0]!.pitchState).toBe('uncertain');
  });

  it('uncalibrated timing uses the wider window and labels results approximate', () => {
    const m = new FixedTempoMatcher(ctx({ calibrated: false }), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    m.addAttack(attack(10.2, 64));
    const j = m.finalize(30)[0]!;
    expect(j.rhythmState).toBe('correct');
    expect(j.reasonCodes).toContain('timing_uncalibrated');
  });

  it('does not judge a target before its window plus stabilization delay has passed', () => {
    const m = new FixedTempoMatcher(ctx(), goodTimeline());
    m.addTarget(target(ev('n1'), 10));
    expect(m.finalize(10.3)).toHaveLength(0);
    expect(m.finalize(10.9)).toHaveLength(1);
  });
});

describe('wait mode judge', () => {
  it('requires a new attack, ignores held/older attacks, and disables rhythm', () => {
    const w = new WaitTargetJudge();
    w.begin(target(ev('n3'), 0), 20);
    expect(w.addAttack(attack(19, 67)).outcome).toBe('ignored'); // before wait (beyond grace)
    expect(w.addAttack(attack(20.5, 65)).outcome).toBe('wrong');
    const r = w.addAttack(attack(21, 67));
    expect(r.outcome).toBe('accepted');
    expect(r.judgment).toMatchObject({ rhythmState: 'not_assessed', pitchState: 'incorrect' });
    expect(r.judgment!.reasonCodes).toContain('recovered_after_retry');
    // Next target: the same attack cannot be reused.
    w.begin(target(ev('n4'), 0), 21.05);
    expect(w.addAttack(attack(21, 64)).outcome).toBe('ignored');
    expect(w.addAttack(attack(21.5, 64)).judgment).toMatchObject({ state: 'correct', rhythmState: 'not_assessed' });
  });

  it('skip records not_assessed when nothing was attempted', () => {
    const w = new WaitTargetJudge();
    w.begin(target(ev('n1'), 0), 5);
    expect(w.skip()).toMatchObject({ state: 'not_assessed', reasonCodes: expect.arrayContaining(['skipped']) });
  });
});

describe('summary and suggestion', () => {
  const mk = (over: Partial<Judgment>): Judgment => ({
    attemptId: '1', targetKey: Math.random().toString(), targetEventId: 'n3', loopIteration: 0, observationIds: [], state: 'correct', pitchState: 'correct', rhythmState: 'correct',
    timingErrorMs: 0, pitchErrorCents: 0, observedMidi: 67, targetMidi: 67, reasonCodes: [], policyVersion: 'beginner-1', simulated: false, ...over,
  });
  it('shows coverage beside accuracy, null when nothing assessed', () => {
    const s = computeStats([mk({}), mk({ state: 'not_assessed', pitchState: 'not_assessed', rhythmState: 'not_assessed' })], { rhythmEnabled: true, calibrated: true });
    expect(s.coverage).toBe(0.5);
    expect(s.pitch.accuracy).toBe(1);
    const z = computeStats([], { rhythmEnabled: true, calibrated: false });
    expect(z.pitch.accuracy).toBeNull();
    expect(z.coverage).toBeNull();
  });
  it('gives a specific note correction for a repeated wrong pitch', () => {
    const js = [mk({ state: 'incorrect', pitchState: 'incorrect', observedMidi: 65, reasonCodes: ['wrong_pitch'] }), mk({ state: 'incorrect', pitchState: 'incorrect', observedMidi: 65.1, reasonCodes: ['wrong_pitch'] })];
    const st = computeStats(js, { rhythmEnabled: true, calibrated: true });
    const sug = suggestNext(js, st, { inputSource: 'microphone', rate: 1, events: score.events as NoteEvent[], mode: 'fixed' });
    expect(sug.text).toContain('That sounded like F4. The target is G4');
    expect(sug.text).toContain('fret 3');
  });
  it('asks for a setup check instead of criticism when coverage is low', () => {
    const js = [mk({ state: 'not_assessed', pitchState: 'not_assessed', rhythmState: 'not_assessed', reasonCodes: ['listening_unavailable'] })];
    const sug = suggestNext(js, computeStats(js, { rhythmEnabled: true, calibrated: true }), { inputSource: 'microphone', rate: 1, events: [], mode: 'fixed' });
    expect(sug.code).toBe('setup_check');
  });
  it('labels simulation suggestions', () => {
    const js = [mk({ simulated: true })];
    const sug = suggestNext(js, computeStats(js, { rhythmEnabled: true, calibrated: true }), { inputSource: 'simulation', rate: 0.5, events: [], mode: 'fixed' });
    expect(sug.text).toMatch(/^Simulation only/);
  });
});
