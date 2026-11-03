import { describe, expect, it } from 'vitest';
import { adaptationOffer } from '../../src/learning/adaptation';
import { retentionCheck } from '../../src/learning/retention';
import { pulseFeedback, scoreTaps } from '../../src/learning/pulse';
import { higherLowerRounds } from '../../src/learning/ear';
import type { PracticeSummaryRecord } from '../../src/storage/types';

let n = 0;
function rec(over: Partial<PracticeSummaryRecord> & { acc?: number; cov?: number; day?: string } = {}): PracticeSummaryRecord {
  const { acc = 0.9, cov = 1, day = '2026-11-03', ...rest } = over;
  n++;
  return {
    id: `s${n}`, arrangementId: 'piece.morning-steps', arrangementVersion: 1, title: 't', mode: 'fixed', rate: 0.5, loop: null, inputSource: 'microphone',
    simulated: false, calibrated: false, policyVersion: 'beginner-1', cueLevel: 'full',
    stats: { eligible: 10, assessable: Math.round(cov * 10), coverage: cov, pitch: { correct: Math.round(acc * 10), assessed: 10, accuracy: acc }, timing: { correct: 0, assessed: 0, accuracy: null, meanErrorMs: null, approximate: true, enabled: true }, states: { correct: 0, incorrect: 0, uncertain: 0, not_assessed: 0 }, missed: 0, wrongPitch: 0 },
    suggestion: '', startedAt: `${day}T10:00:00.000Z`, finishedAt: `${day}T10:01:00.000Z`, ...rest,
  };
}
const cur = { arrangementId: 'piece.morning-steps', rate: 0.5, mode: 'fixed', cueLevel: 'full', loop: false };

describe('adaptation offers (§3.4)', () => {
  it('offers the next tempo after two strong phrases', () => {
    expect(adaptationOffer([rec(), rec()], cur)).toMatchObject({ kind: 'faster', rate: 0.75 });
  });
  it('needs two phrases and never counts simulation', () => {
    expect(adaptationOffer([rec()], cur)).toBeNull();
    expect(adaptationOffer([rec({ inputSource: 'simulation', simulated: true }), rec({ inputSource: 'simulation', simulated: true })], cur)).toBeNull();
  });
  it('asks for a setup fix instead of lowering difficulty when coverage is low', () => {
    expect(adaptationOffer([rec({ acc: 0.2, cov: 0.3 }), rec({ acc: 0.2 })], cur)).toMatchObject({ kind: 'setup' });
  });
  it('offers slower tempo, then a smaller loop, after two weak phrases', () => {
    expect(adaptationOffer([rec({ acc: 0.4, rate: 0.75 }), rec({ acc: 0.5, rate: 0.75 })], { ...cur, rate: 0.75 })).toMatchObject({ kind: 'slower', rate: 0.5 });
    expect(adaptationOffer([rec({ acc: 0.4 }), rec({ acc: 0.5 })], cur)).toMatchObject({ kind: 'smaller-loop' });
  });
  it('offers fewer cues at full tempo', () => {
    expect(adaptationOffer([rec({ rate: 1 }), rec({ rate: 1 })], { ...cur, rate: 1 })).toMatchObject({ kind: 'fewer-cues' });
  });
});

describe('retention (§3.4)', () => {
  it('requires a cue-reduced microphone success on a later day', () => {
    const earlier = rec({ day: '2026-11-02' });
    const recall = rec({ cueLevel: 'none', day: '2026-11-03' });
    expect(retentionCheck(recall, [earlier])).toBe('retained');
    expect(retentionCheck(rec({ cueLevel: 'none' }), [rec()])).toBe('come-back-later');
    expect(retentionCheck(rec({ cueLevel: 'full', day: '2026-11-03' }), [earlier])).toBeNull();
    expect(retentionCheck(rec({ cueLevel: 'none', acc: 0.5 }), [earlier])).toBeNull();
    expect(retentionCheck(rec({ cueLevel: 'none', inputSource: 'simulation', simulated: true }), [earlier])).toBeNull();
  });
});

describe('pulse taps', () => {
  it('matches taps one-to-one and reports lean and steadiness', () => {
    const clicks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000];
    const r = scoreTaps(clicks, clicks.map((c, i) => c + 60 + (i % 2 ? 10 : -10)));
    expect(r).toMatchObject({ taps: 8, matched: 8, onBeat: 8, meanErrorMs: 60 });
    expect(pulseFeedback(r, 8).pass).toBe(true);
    expect(pulseFeedback(r, 8).text).toContain('after the click');
    const double = scoreTaps(clicks, [0, 5, 10, 1000]);
    expect(double.matched).toBe(2);
    expect(pulseFeedback(scoreTaps(clicks, []), 8).pass).toBe(false);
  });
});

describe('ear training', () => {
  it('generates deterministic rounds with a correct answer', () => {
    const r = higherLowerRounds([59, 60, 62, 64, 65, 67], 6, 42);
    expect(r).toEqual(higherLowerRounds([59, 60, 62, 64, 65, 67], 6, 42));
    r.forEach((x) => {
      expect(x.first).not.toBe(x.second);
      expect(x.answer).toBe(x.first > x.second ? 'first' : 'second');
    });
  });
});
describe('adaptation in wait mode', () => {
  it('suggests fixed tempo after two strong wait-mode phrases', () => {
    expect(adaptationOffer([rec({ mode: 'wait' }), rec({ mode: 'wait' })], { ...cur, mode: 'wait' })).toMatchObject({ kind: 'try-fixed' });
  });
});
