/**
 * Tuner state from pitch frames (master spec §5.2). Pure and deterministic.
 * Lock only after ≥300 ms of stable usable evidence within ±5 cents; exit lock
 * beyond ±8 cents. Silence, clipping, unstable/polyphonic input and suspected
 * harmonics never lock and never produce a "tighten" instruction.
 */
import { midiName, STRING_LABELS } from '../domain/tuning';
import type { StringNumber } from '../domain/score';
import type { PitchFrame } from './observations';

export type TunerStatus = 'silent' | 'uncertain' | 'tuning' | 'inTune' | 'farOff' | 'harmonic';

export interface TunerReading {
  status: TunerStatus;
  hz: number | null;
  midiFloat: number | null;
  noteName: string | null;
  /** Cents from the target (string mode) or nearest note (chromatic). */
  cents: number | null;
  targetMidi: number | null;
  direction: 'up' | 'down' | null;
  message: string;
  reasonCodes: string[];
}

export interface TunerOptions {
  mode: 'chromatic' | 'string';
  targetMidi?: number;
  targetString?: StringNumber;
  lockCents?: number;
  unlockCents?: number;
  lockHoldSec?: number;
}

const HISTORY_SEC = 0.15;
const STALE_SEC = 0.25;
const STABLE_SPREAD_CENTS = 12;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : 0.5 * (s[m - 1]! + s[m]!);
}

export class TunerTracker {
  private opts: Required<Omit<TunerOptions, 'targetMidi' | 'targetString'>> & Pick<TunerOptions, 'targetMidi' | 'targetString'>;
  private history: { t: number; m: number }[] = [];
  private lastGoodT = -Infinity;
  private lastAboveGateT = -Infinity;
  private candidateSince: number | null = null;
  private locked = false;
  /** Raw midi samples kept in memory for diagnostics only (bounded, never saved). */
  readonly rawDiagnostics: number[] = [];

  constructor(opts: TunerOptions) {
    this.opts = { lockCents: 5, unlockCents: 8, lockHoldSec: 0.3, ...opts };
  }

  setOptions(opts: TunerOptions): void {
    this.opts = { lockCents: 5, unlockCents: 8, lockHoldSec: 0.3, ...opts };
    this.reset();
  }

  reset(): void {
    this.history = [];
    this.candidateSince = null;
    this.locked = false;
    this.lastGoodT = -Infinity;
  }

  private reading(partial: Partial<TunerReading> & Pick<TunerReading, 'status' | 'message'>): TunerReading {
    return {
      hz: null,
      midiFloat: null,
      noteName: null,
      cents: null,
      targetMidi: this.opts.mode === 'string' ? this.opts.targetMidi ?? null : null,
      direction: null,
      reasonCodes: [],
      ...partial,
    };
  }

  push(f: PitchFrame): TunerReading {
    const t = f.centerSec;
    const aboveGate = !f.reasonCodes.includes('below_gate');
    if (aboveGate) this.lastAboveGateT = t;

    if (f.clipped) {
      this.unlock();
      return this.reading({ status: 'uncertain', message: 'The input is clipping. Move the microphone back or lower the input level, then pluck again.', reasonCodes: ['clipping'] });
    }

    if (f.midiFloat !== null && f.pitchQuality === 'good') {
      this.lastGoodT = t;
      this.history.push({ t, m: f.midiFloat });
      this.rawDiagnostics.push(f.midiFloat);
      if (this.rawDiagnostics.length > 2000) this.rawDiagnostics.shift();
    }
    this.history = this.history.filter((h) => t - h.t <= HISTORY_SEC);

    if (t - this.lastGoodT > STALE_SEC || this.history.length === 0) {
      this.unlock();
      this.history = [];
      if (t - this.lastAboveGateT > STALE_SEC) {
        return this.reading({ status: 'silent', message: 'Listening… pluck one string and let it ring.', reasonCodes: ['silence'] });
      }
      return this.reading({
        status: 'uncertain',
        message: 'I can hear sound but not one clear pitch. Pluck one string and let it ring.',
        reasonCodes: ['unstable_or_polyphonic'],
      });
    }

    const ms = this.history.map((h) => h.m);
    const m = median(ms);
    const spread = (Math.max(...ms) - Math.min(...ms)) * 100;
    const stable = this.history.length >= 3 && spread <= STABLE_SPREAD_CENTS;
    const hz = 440 * 2 ** ((m - 69) / 12);
    const nearest = Math.round(m);
    const base = { hz, midiFloat: m, noteName: midiName(nearest) };

    if (this.opts.mode === 'chromatic') {
      const cents = (m - nearest) * 100;
      return this.lockLogic(t, cents, stable, { ...base, cents });
    }

    const target = this.opts.targetMidi!;
    const diff = (m - target) * 100;
    const strNo = this.opts.targetString;
    const strText = strNo ? `string ${strNo} (${STRING_LABELS[strNo].name})` : midiName(target);
    for (const h of [1200, 1902, 2400]) {
      if (Math.abs(diff - h) < 80) {
        this.unlock();
        return this.reading({
          ...base,
          status: 'harmonic',
          cents: null,
          message: `That sounds like ${midiName(nearest)}, an overtone above ${strText}. I won't suggest tuning from this. Pluck the string once near the middle and let it ring.`,
          reasonCodes: ['harmonic_suspected'],
        });
      }
    }
    if (Math.abs(diff + 1200) < 80) {
      this.unlock();
      return this.reading({
        ...base,
        status: 'farOff',
        message: `That sounds an octave below ${strText}. Check that you are plucking the selected string.`,
        reasonCodes: ['octave_below'],
      });
    }
    if (Math.abs(diff) > 300) {
      this.unlock();
      return this.reading({
        ...base,
        status: 'farOff',
        message: `That sounds like ${midiName(nearest)}, which is far from ${strText}. Check which string you plucked. If it is the right string, turn its peg in small steps and check again — avoid big turns.`,
        reasonCodes: ['far_from_target'],
      });
    }
    return this.lockLogic(t, diff, stable, { ...base, cents: diff });
  }

  private unlock(): void {
    this.locked = false;
    this.candidateSince = null;
  }

  private lockLogic(t: number, cents: number, stable: boolean, base: Partial<TunerReading>): TunerReading {
    const abs = Math.abs(cents);
    if (this.locked) {
      if (abs > this.opts.unlockCents) this.locked = false;
    } else if (abs <= this.opts.lockCents && stable) {
      if (this.candidateSince === null) this.candidateSince = t;
      if (t - this.candidateSince >= this.opts.lockHoldSec) this.locked = true;
    } else {
      this.candidateSince = null;
    }
    const dir: 'up' | 'down' = cents < 0 ? 'up' : 'down';
    if (this.locked) {
      return this.reading({ ...base, status: 'inTune', direction: null, message: 'In tune. Nice and steady.' });
    }
    if (!stable) {
      return this.reading({ ...base, status: 'tuning', direction: null, message: 'Hold on… let the string ring so the pitch can settle.', reasonCodes: ['settling'] });
    }
    const amount = `${Math.round(abs)} cent${Math.round(abs) === 1 ? '' : 's'}`;
    const message =
      abs <= this.opts.lockCents
        ? 'Almost there — let it ring.'
        : this.opts.mode === 'string'
          ? dir === 'up'
            ? `${amount} flat (too low). Tune up slightly, then pluck again.`
            : `${amount} sharp (too high). Tune down slightly, then pluck again.`
          : dir === 'up'
            ? `${amount} flat of ${base.noteName}.`
            : `${amount} sharp of ${base.noteName}.`;
    return this.reading({ ...base, status: 'tuning', direction: abs <= this.opts.lockCents ? null : dir, message });
  }
}
