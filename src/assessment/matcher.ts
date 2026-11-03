/**
 * Deterministic monophonic matching (master spec §6.5).
 *
 * Fixed-tempo: each target gets a half-open window around cTarget + deltaIO,
 * bounded by half the gap to its neighbours so windows never overlap. A performed
 * attack can match at most one target, and a target at most one attack. Missing
 * or poor listening yields not_assessed / uncertain — never a wrong note.
 *
 * Timing convention: timingErrorSec = cObserved − cTarget − deltaIO (positive = late).
 */
import type { AttackObservation } from '../audio/observations';
import { combineStates, BEGINNER_POLICY, type AssessmentState, type Judgment, type MatchPolicy, type TargetInstance } from './types';
import type { SignalTimeline } from './timeline';

export interface MatchContext {
  /** Combined output→input offset in seconds (0 when uncalibrated). */
  deltaIO: number;
  calibrated: boolean;
  /** False in wait mode: rhythm is disabled, not failed. */
  rhythmEnabled: boolean;
  simulated: boolean;
}

/** Extra time after a window closes before judging, allowing attack stabilization to arrive. */
export const FINALIZE_DELAY_SEC = 0.45;

interface PendingTarget {
  t: TargetInstance;
  w0: number;
  w1: number;
  expected: number;
}

export function pitchJudgment(
  attack: AttackObservation,
  targetMidi: number,
  policy: MatchPolicy,
): { state: AssessmentState; cents: number | null; reason: string | null } {
  if (attack.quality !== 'good' || attack.pitchMidiFloat === null) {
    return { state: 'uncertain', cents: null, reason: attack.pitchMidiFloat === null ? 'no_stable_pitch' : attack.reasonCodes[0] ?? 'poor_pitch_evidence' };
  }
  const cents = (attack.pitchMidiFloat - targetMidi) * 100;
  if (Math.abs(cents) <= policy.pitchToleranceCents) return { state: 'correct', cents, reason: null };
  if (Math.abs(Math.abs(cents) - 1200) <= policy.octaveToleranceCents) return { state: 'uncertain', cents, reason: 'octave_ambiguous' };
  return { state: 'incorrect', cents, reason: 'wrong_pitch' };
}

export class FixedTempoMatcher {
  private pending: PendingTarget[] = [];
  private attacks: AttackObservation[] = [];
  private readonly used = new Set<string>();
  private readonly judgedKeys = new Set<string>();
  extras = 0;

  constructor(
    private ctx: MatchContext,
    private readonly timeline: SignalTimeline,
    private readonly policy: MatchPolicy = BEGINNER_POLICY,
  ) {}

  setContext(ctx: MatchContext): void {
    this.ctx = ctx;
  }

  addTarget(t: TargetInstance): void {
    if (this.judgedKeys.has(t.key) || this.pending.some((p) => p.t.key === t.key)) return;
    const expected = t.contextTime + this.ctx.deltaIO;
    const w = this.policy.searchWindowSec;
    const w0 = expected - Math.min(w, t.gapBeforeSec / 2);
    const w1 = expected + Math.min(w, t.gapAfterSec / 2);
    this.pending.push({ t, w0, w1, expected });
    this.pending.sort((a, b) => a.expected - b.expected);
  }

  addAttack(a: AttackObservation): void {
    this.attacks.push(a);
    if (this.attacks.length > 500) this.attacks.splice(0, 100);
  }

  /** Drop unfinished state (pause/seek/rate/loop change). Judged history stays with the caller. */
  reset(): void {
    this.pending = [];
    this.attacks = [];
    this.used.clear();
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Judge every target whose window closed at least FINALIZE_DELAY_SEC before `now`. */
  finalize(now: number): Judgment[] {
    const out: Judgment[] = [];
    while (this.pending.length && this.pending[0]!.w1 + FINALIZE_DELAY_SEC <= now) {
      const p = this.pending.shift()!;
      out.push(this.judge(p));
      this.judgedKeys.add(p.t.key);
    }
    // Attacks before the earliest open window that matched nothing are extras.
    const horizon = this.pending.length ? this.pending[0]!.w0 : now - FINALIZE_DELAY_SEC;
    this.attacks = this.attacks.filter((a) => {
      if (a.onsetContextSec < horizon) {
        if (!this.used.has(a.id) && a.quality === 'good') this.extras++;
        return false;
      }
      return true;
    });
    return out;
  }

  private judge(p: PendingTarget): Judgment {
    const { t, w0, w1, expected } = p;
    const ev = t.event;
    const policy = this.policy;
    const reasons: string[] = [];
    const cov = this.timeline.coverage(w0, w1);
    const base = {
      attemptId: String(t.attemptId),
      targetKey: t.key,
      targetEventId: ev.id,
      loopIteration: t.loopIteration,
      targetMidi: ev.pitchMidi,
      policyVersion: policy.version,
      simulated: this.ctx.simulated,
    };
    const rhythmOn = this.ctx.rhythmEnabled && ev.assessment.attack;
    const pitchOn = ev.assessment.pitch;

    if (!pitchOn && !rhythmOn) {
      return { ...base, observationIds: [], state: 'not_assessed', pitchState: 'not_assessed', rhythmState: 'not_assessed', timingErrorMs: null, pitchErrorCents: null, observedMidi: null, reasonCodes: ['assessment_disabled_for_event'] };
    }
    if (cov.unavailable >= 0.5) {
      return {
        ...base,
        observationIds: [],
        state: 'not_assessed',
        pitchState: 'not_assessed',
        rhythmState: 'not_assessed',
        timingErrorMs: null,
        pitchErrorCents: null,
        observedMidi: null,
        reasonCodes: [cov.reason ?? 'listening_unavailable'],
      };
    }

    // Attacks with no pitch evidence at all (clicks, knocks, metronome leakage) are not
    // musical evidence: they can neither earn nor lose credit, and their timing is never graded.
    const candidates = this.attacks.filter((a) => a.pitchMidiFloat !== null && !this.used.has(a.id) && a.onsetContextSec >= w0 && a.onsetContextSec < w1);
    const scored = candidates
      .map((a) => {
        const pj = pitchJudgment(a, ev.pitchMidi, policy);
        const rank = pj.state === 'correct' ? 0 : 1;
        return { a, pj, rank, dt: Math.abs(a.onsetContextSec - expected) };
      })
      .sort((x, y) => x.rank - y.rank || x.dt - y.dt || (x.a.id < y.a.id ? -1 : 1));
    const best = scored[0];

    if (!best) {
      if (cov.poor >= 0.5) {
        return {
          ...base,
          observationIds: [],
          state: 'uncertain',
          pitchState: pitchOn ? 'uncertain' : 'not_assessed',
          rhythmState: rhythmOn ? 'uncertain' : 'not_assessed',
          timingErrorMs: null,
          pitchErrorCents: null,
          observedMidi: null,
          reasonCodes: [cov.reason ?? 'poor_signal'],
        };
      }
      const pitchState: AssessmentState = pitchOn ? 'incorrect' : 'not_assessed';
      const rhythmState: AssessmentState = rhythmOn ? 'incorrect' : 'not_assessed';
      if (!this.ctx.rhythmEnabled) reasons.push('rhythm_disabled');
      return {
        ...base,
        observationIds: [],
        state: combineStates([pitchState, rhythmState]),
        pitchState,
        rhythmState,
        timingErrorMs: null,
        pitchErrorCents: null,
        observedMidi: null,
        reasonCodes: ['no_attack_detected', ...reasons],
      };
    }

    this.used.add(best.a.id);
    const a = best.a;
    let pitchState: AssessmentState = 'not_assessed';
    if (pitchOn) {
      pitchState = best.pj.state;
      if (best.pj.reason) reasons.push(best.pj.reason);
    }
    let rhythmState: AssessmentState = 'not_assessed';
    const errSec = a.onsetContextSec - t.contextTime - this.ctx.deltaIO;
    if (rhythmOn) {
      const tol = this.ctx.calibrated ? policy.attackToleranceSec : policy.uncalibratedAttackToleranceSec;
      rhythmState = Math.abs(errSec) <= tol ? 'correct' : 'incorrect';
      if (rhythmState === 'incorrect') reasons.push(errSec > 0 ? 'late' : 'early');
      if (!this.ctx.calibrated) reasons.push('timing_uncalibrated');
    } else if (!this.ctx.rhythmEnabled) {
      reasons.push('rhythm_disabled');
    }
    if (a.simulated) reasons.push('simulated_input');
    return {
      ...base,
      observationIds: [a.id],
      state: combineStates([pitchState, rhythmState]),
      pitchState,
      rhythmState,
      timingErrorMs: rhythmOn ? Math.round(errSec * 1000) : null,
      pitchErrorCents: best.pj.cents === null ? null : Math.round(best.pj.cents),
      observedMidi: a.pitchMidiFloat,
      reasonCodes: reasons,
    };
  }
}

/**
 * Wait mode: transport is stopped at the target; any new deliberate attack is
 * compared directly with it, independent of its paused onset time. Rhythm is
 * disabled. The judgment records the first assessed attempt; the learner can
 * keep trying until the target is recognized or skipped.
 */
export class WaitTargetJudge {
  private target: TargetInstance | null = null;
  private minOnset = -Infinity;
  private lastAcceptedOnset = -Infinity;
  private firstAttempt: { state: AssessmentState; cents: number | null; obs: AttackObservation; reason: string | null } | null = null;
  private tries = 0;

  /** Grace before waiting began, so a slightly early note still counts once. */
  static readonly EARLY_GRACE_SEC = 0.3;

  constructor(
    private readonly policy: MatchPolicy = BEGINNER_POLICY,
    private simulated = false,
  ) {}

  setSimulated(sim: boolean): void {
    this.simulated = sim;
  }

  get active(): TargetInstance | null {
    return this.target;
  }

  begin(target: TargetInstance, waitStartC: number): void {
    this.target = target;
    this.minOnset = Math.max(waitStartC - WaitTargetJudge.EARLY_GRACE_SEC, this.lastAcceptedOnset + 1e-6);
    this.firstAttempt = null;
    this.tries = 0;
  }

  clear(): void {
    this.target = null;
    this.firstAttempt = null;
  }

  /** Returns a final judgment when the target is recognized; otherwise feedback only. */
  addAttack(a: AttackObservation): { outcome: 'accepted' | 'wrong' | 'unclear' | 'ignored'; judgment: Judgment | null; cents: number | null } {
    const t = this.target;
    if (!t || a.onsetContextSec < this.minOnset) return { outcome: 'ignored', judgment: null, cents: null };
    if (a.pitchMidiFloat === null && !a.reasonCodes.includes('clipping')) return { outcome: 'ignored', judgment: null, cents: null };
    const pj = pitchJudgment(a, t.event.pitchMidi, this.policy);
    if (pj.state === 'uncertain') return { outcome: 'unclear', judgment: null, cents: pj.cents };
    this.tries++;
    if (!this.firstAttempt) this.firstAttempt = { state: pj.state, cents: pj.cents, obs: a, reason: pj.reason };
    if (pj.state !== 'correct') {
      this.minOnset = a.onsetContextSec + 1e-6;
      return { outcome: 'wrong', judgment: null, cents: pj.cents };
    }
    this.lastAcceptedOnset = a.onsetContextSec;
    const first = this.firstAttempt;
    const reasons = ['rhythm_disabled', 'wait_mode'];
    if (first.state !== 'correct') reasons.push('recovered_after_retry', first.reason ?? 'wrong_pitch');
    if (a.simulated) reasons.push('simulated_input');
    const j: Judgment = {
      attemptId: String(t.attemptId),
      targetKey: t.key,
      targetEventId: t.event.id,
      loopIteration: t.loopIteration,
      observationIds: [first.obs.id, ...(first.obs.id === a.id ? [] : [a.id])],
      state: first.state,
      pitchState: first.state,
      rhythmState: 'not_assessed',
      timingErrorMs: null,
      pitchErrorCents: first.cents === null ? null : Math.round(first.cents),
      observedMidi: first.obs.pitchMidiFloat,
      targetMidi: t.event.pitchMidi,
      reasonCodes: reasons,
      policyVersion: this.policy.version,
      simulated: this.simulated,
    };
    this.target = null;
    return { outcome: 'accepted', judgment: j, cents: pj.cents };
  }

  skip(): Judgment | null {
    const t = this.target;
    if (!t) return null;
    this.target = null;
    const first = this.firstAttempt;
    const pitchState: AssessmentState = first ? first.state : 'not_assessed';
    return {
      attemptId: String(t.attemptId),
      targetKey: t.key,
      targetEventId: t.event.id,
      loopIteration: t.loopIteration,
      observationIds: first ? [first.obs.id] : [],
      state: pitchState,
      pitchState,
      rhythmState: 'not_assessed',
      timingErrorMs: null,
      pitchErrorCents: first?.cents == null ? null : Math.round(first.cents),
      observedMidi: first?.obs.pitchMidiFloat ?? null,
      targetMidi: t.event.pitchMidi,
      reasonCodes: ['skipped', 'rhythm_disabled', 'wait_mode'],
      policyVersion: this.policy.version,
      simulated: this.simulated,
    };
  }
}
