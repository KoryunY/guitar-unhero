/**
 * Pure transport state machine (master spec §6.3). It owns musical position and
 * segment history; it never touches Web Audio. A clock function returning
 * AudioContext seconds is injected, so tests use a fake clock.
 *
 * idle → ready → countIn → playing ↔ paused → completed;
 * playing → waitingForTarget in wait mode; active → deviceLost / error.
 */
import type { ChordEvent, NoteEvent, Score } from '../domain/score';
import { scoreBpm, sortEvents, PPQ } from '../domain/score';
import { SegmentHistory, contextAt, sourceAt, type Segment } from './tempo';
import { ConstantTempoMap, type TimeMap } from './timemap';

export type TransportState =
  | 'idle'
  | 'ready'
  | 'countIn'
  | 'playing'
  | 'paused'
  | 'waitingForTarget'
  | 'completed'
  | 'deviceLost'
  | 'error';

/** listen = demonstration only (no assessment); fixed = music continues; wait = stop at each target. */
export type PracticeMode = 'listen' | 'fixed' | 'wait';

export const SUPPORTED_RATES = [0.5, 0.75, 1] as const;

export interface TransportSegment extends Segment {
  endKind: 'loop' | 'end' | 'wait';
  /** Index into `events` of the wait target that ends this segment (wait mode). */
  waitIndex: number | null;
  /** Skip a metronome beat exactly at s0 (continuation after a wait target). */
  skipStartBeat: boolean;
}

/** One strum of a chord-track shape (gu-score/2). Played by the app, never assessed. */
export interface StrumEvent {
  key: string;
  tick: number;
  /** Ticks until the next strum or the chord's end. */
  durationTicks: number;
  direction: 'down' | 'up';
  light: boolean;
  mute: boolean;
  chord: ChordEvent;
}

/** Expand a chord track into strums: patterns are an eighth-note grid that repeats each 4/4 bar. */
export function expandStrums(chords: readonly ChordEvent[] | undefined): StrumEvent[] {
  const out: StrumEvent[] = [];
  const bar = 4 * PPQ, slot = PPQ / 2;
  for (const c of chords ?? []) {
    const end = c.startTick + c.durationTicks;
    if (!c.pattern) {
      out.push({ key: `${c.id}:0`, tick: c.startTick, durationTicks: c.durationTicks, direction: 'down', light: false, mute: false, chord: c });
      continue;
    }
    const n = c.pattern.length;
    const first = Math.floor(c.startTick / slot) * slot;
    const hits: { tick: number; ch: string }[] = [];
    for (let t = first; t < end; t += slot) {
      if (t < c.startTick) continue;
      const ch = c.pattern[Math.floor((t % bar) / slot) % n]!;
      if (ch !== '-') hits.push({ tick: t, ch });
    }
    hits.forEach((h, i) => {
      const next = hits[i + 1]?.tick ?? end;
      out.push({ key: `${c.id}:${h.tick}`, tick: h.tick, durationTicks: next - h.tick, direction: h.ch === 'U' || h.ch === 'u' ? 'up' : 'down', light: h.ch === 'd' || h.ch === 'u', mute: h.ch === 'x', chord: c });
    });
  }
  return out;
}

export interface ScheduledItem {
  key: string;
  kind: 'note' | 'click' | 'countIn' | 'backing' | 'strum';
  strum?: StrumEvent;
  /** For 'backing': context time at which the recording must stop (segment end). */
  endContextTime?: number;
  contextTime: number;
  sourceSec: number;
  accent: boolean;
  attemptId: number;
  epoch: number;
  loopIteration: number;
  event?: NoteEvent;
}

export type TransportEvent =
  | { type: 'state'; state: TransportState }
  | { type: 'stopAll'; reason: string }
  | { type: 'attempt'; attemptId: number }
  | { type: 'loopWrap'; loopIteration: number; contextTime: number };

export interface LoopRange {
  aTick: number;
  bTick: number;
}

const RUNNING: ReadonlySet<TransportState> = new Set(['countIn', 'playing', 'waitingForTarget']);

export class Transport {
  readonly score: Score;
  readonly events: readonly NoteEvent[];
  readonly strums: readonly StrumEvent[];
  readonly bpm: number;
  /** Nominal beat length at the start of the score (local beats come from the time map). */
  readonly beatSec: number;
  readonly durationSec: number;
  /** Source second of tick 0 (0 for authored scores; the first downbeat in a recording). */
  readonly startSec: number;
  readonly map: TimeMap;

  state: TransportState = 'ready';
  mode: PracticeMode = 'fixed';
  rate = 1;
  loop: LoopRange | null = null;
  countInBeats = 4;
  /** Schedule a backing recording (source seconds = recording seconds) per segment; only at rate 1. */
  backingEnabled = false;
  /** Speeds at which a (time-stretched) backing recording is available. */
  backingRates: ReadonlySet<number> = new Set([1]);
  /** Lead time before the first count-in click, allowing the scheduler to fill. */
  startDelay = 0.12;
  /** Delay before continuing after a recognized wait-mode target. */
  continueDelay = 0.05;
  positionSec = 0;
  attemptId = 1;
  waitingTarget: NoteEvent | null = null;
  readonly history = new SegmentHistory();

  private epoch = 0;
  private seg: TransportSegment | null = null;
  private countIn: { epoch: number; startC: number; beats: number; beatC: number } | null = null;
  private readonly listeners = new Set<(e: TransportEvent) => void>();
  private readonly now: () => number;

  constructor(score: Score, now: () => number, map?: TimeMap) {
    this.score = score;
    this.events = sortEvents(score.events);
    this.strums = expandStrums(score.chords);
    this.map = map ?? new ConstantTempoMap(scoreBpm(score));
    this.eventSecList = this.events.map((e) => this.map.tickToSec(e.startTick));
    this.events.forEach((e, i) => this.secByEventId.set(e.id, this.eventSecList[i]!));
    this.strumSecList = this.strums.map((st) => this.map.tickToSec(st.tick));
    this.startSec = this.map.tickToSec(0);
    this.bpm = this.map.bpmAt(this.startSec);
    this.beatSec = this.map.beatSecAt(this.startSec);
    this.durationSec = this.map.tickToSec(score.durationTicks);
    this.positionSec = this.startSec;
    this.now = now;
  }

  // ---------- observers ----------
  subscribe(fn: (e: TransportEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: TransportEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }

  private setState(state: TransportState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: 'state', state });
  }

  private newAttempt(): void {
    this.attemptId += 1;
    this.history.clear();
    this.emit({ type: 'attempt', attemptId: this.attemptId });
  }

  get running(): boolean {
    return RUNNING.has(this.state);
  }

  get segment(): TransportSegment | null {
    return this.seg;
  }

  get loopIteration(): number {
    return this.seg?.loopIteration ?? 0;
  }

  /** Seconds of each event / strum start, computed once (long songs have thousands). */
  private readonly secByEventId = new Map<string, number>();
  private eventSecList: number[] = [];
  private strumSecList: number[] = [];

  eventSec(ev: NoteEvent): number {
    const cached = this.secByEventId.get(ev.id);
    return cached ?? this.map.tickToSec(ev.startTick);
  }

  /** First index with list[i] >= v (lists are ascending). */
  private static lowerBound(list: readonly number[], v: number): number {
    let lo = 0, hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]! < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  tickToSec(tick: number): number {
    return this.map.tickToSec(tick);
  }

  secToTick(sec: number): number {
    return this.map.secToTick(sec);
  }

  private boundS(): number {
    return this.loop ? this.tickToSec(this.loop.bTick) : this.durationSec;
  }

  private loopStartS(): number {
    return this.loop ? this.tickToSec(this.loop.aTick) : this.startSec;
  }

  private nextWaitIndex(s0: number, inclusive: boolean, bound: number): number | null {
    const eps = 1e-9;
    for (let i = 0; i < this.events.length; i++) {
      const ts = this.eventSec(this.events[i]!);
      if (ts >= bound - eps) return null;
      if (inclusive ? ts >= s0 - eps : ts > s0 + eps) return i;
    }
    return null;
  }

  private makeSegment(s0: number, c0: number, loopIteration: number, inclusiveWait: boolean, skipStartBeat: boolean): TransportSegment {
    const bound = this.boundS();
    let endS = bound;
    let endKind: TransportSegment['endKind'] = this.loop ? 'loop' : 'end';
    let waitIndex: number | null = null;
    if (this.mode === 'wait') {
      const idx = this.nextWaitIndex(s0, inclusiveWait, bound);
      if (idx !== null) {
        endS = this.eventSec(this.events[idx]!);
        endKind = 'wait';
        waitIndex = idx;
      }
    }
    return { epoch: this.epoch, loopIteration, s0, c0, rate: this.rate, endS, endKind, waitIndex, skipStartBeat };
  }

  private nextLoopSegment(seg: TransportSegment): TransportSegment {
    const c = contextAt(seg, seg.endS);
    return this.makeSegment(this.loopStartS(), c, seg.loopIteration + 1, true, false);
  }

  // ---------- commands ----------
  play(): void {
    if (this.running) return;
    if (this.state === 'completed') this.positionSec = this.loopStartS();
    if (this.loop) {
      const a = this.loopStartS();
      const b = this.boundS();
      if (this.positionSec < a || this.positionSec >= b) this.positionSec = a;
    }
    this.epoch += 1;
    const now = this.now();
    const localBeat = this.map.beatSecAt(this.positionSec);
    const countInC = (this.countInBeats * localBeat) / this.rate;
    const c0 = now + this.startDelay + countInC;
    this.seg = this.makeSegment(this.positionSec, c0, this.seg?.loopIteration ?? 0, true, false);
    this.history.push(this.seg);
    this.countIn = { epoch: this.epoch, startC: c0 - countInC, beats: this.countInBeats, beatC: localBeat / this.rate };
    this.waitingTarget = null;
    this.setState(this.countInBeats > 0 ? 'countIn' : 'playing');
  }

  pause(reason = 'pause'): void {
    if (!this.running) return;
    this.positionSec = this.positionAt(this.now());
    this.stopAll(reason);
    this.setState('paused');
  }

  /** Context/device lost: pause and require user action (play → count-in) to resume. */
  deviceLost(): void {
    if (this.running) {
      this.positionSec = this.positionAt(this.now());
      this.stopAll('deviceLost');
    }
    this.setState('deviceLost');
  }

  private stopAll(reason: string): void {
    this.seg = null;
    this.countIn = null;
    this.waitingTarget = null;
    this.emit({ type: 'stopAll', reason });
  }

  seek(tick: number): void {
    const wasRunning = this.running;
    if (wasRunning) this.stopAll('seek');
    let s = Math.min(Math.max(this.tickToSec(tick), Math.min(0, this.startSec)), this.durationSec);
    if (this.loop) s = Math.min(Math.max(s, this.loopStartS()), this.boundS() - 1e-6);
    this.positionSec = s;
    this.newAttempt();
    if (wasRunning) {
      this.state = 'paused';
      this.play();
    } else if (this.state !== 'deviceLost') {
      this.setState('paused');
    }
  }

  restart(): void {
    this.seek(this.loop ? this.loop.aTick : 0);
    if (!this.running) this.play();
  }

  /** Rate changes pause, change and restart the segment with a count-in. */
  setRate(rate: number): void {
    if (!SUPPORTED_RATES.includes(rate as (typeof SUPPORTED_RATES)[number])) throw new RangeError(`Unsupported rate ${rate}`);
    if (rate === this.rate) return;
    const wasRunning = this.running;
    if (wasRunning) this.pause('rate');
    this.rate = rate;
    this.newAttempt();
    if (wasRunning) this.play();
  }

  setMode(mode: PracticeMode): void {
    if (mode === this.mode) return;
    const wasRunning = this.running;
    if (wasRunning) this.pause('mode');
    this.mode = mode;
    this.newAttempt();
    if (wasRunning) this.play();
  }

  /** Half-open [A,B) loop in ticks; at least one beat. null clears. */
  setLoop(loop: LoopRange | null): void {
    if (loop) {
      if (!(Number.isInteger(loop.aTick) && Number.isInteger(loop.bTick))) throw new RangeError('Loop bounds must be integer ticks');
      if (loop.aTick < 0 || loop.bTick > this.score.durationTicks) throw new RangeError('Loop is outside the score');
      if (loop.bTick - loop.aTick < PPQ) throw new RangeError('Loop must be at least one beat long');
    }
    const wasRunning = this.running;
    if (wasRunning) this.pause('loop');
    this.loop = loop;
    this.newAttempt();
    if (loop) {
      const a = this.loopStartS();
      if (this.positionSec < a || this.positionSec >= this.boundS()) this.positionSec = a;
    }
    if (wasRunning) this.play();
  }

  /** Wait mode: the target was recognized or explicitly skipped. */
  continueAfterTarget(): void {
    if (this.state !== 'waitingForTarget') return;
    this.epoch += 1;
    const loopIteration = this.seg?.loopIteration ?? 0;
    this.seg = this.makeSegment(this.positionSec, this.now() + this.continueDelay, loopIteration, false, true);
    this.history.push(this.seg);
    this.waitingTarget = null;
    this.setState('playing');
    this.update();
  }

  /** Advance state from the clock. Call from the scheduler tick and before drawing. */
  update(now = this.now()): void {
    if (this.state === 'countIn' && this.seg && now >= this.seg.c0) this.setState('playing');
    if (this.state !== 'playing' || !this.seg) return;
    // Bounded: a loop is at least one beat long.
    for (let guard = 0; guard < 10000 && this.seg; guard++) {
      const seg: TransportSegment = this.seg;
      const endC = contextAt(seg, seg.endS);
      if (now < endC) break;
      if (seg.endKind === 'loop') {
        const next = this.nextLoopSegment(seg);
        this.seg = next;
        this.history.push(next);
        this.emit({ type: 'loopWrap', loopIteration: next.loopIteration, contextTime: next.c0 });
      } else if (seg.endKind === 'wait') {
        this.positionSec = seg.endS;
        this.waitingTarget = seg.waitIndex === null ? null : this.events[seg.waitIndex] ?? null;
        this.setState('waitingForTarget');
        break;
      } else {
        this.positionSec = this.durationSec;
        this.seg = null;
        this.setState('completed');
        break;
      }
    }
  }

  // ---------- queries ----------
  /** 1-based count-in beat at context time c, or null outside the count-in. */
  countInBeatAt(c: number): number | null {
    if (this.state !== 'countIn' || !this.countIn || !this.seg) return null;
    if (c < this.countIn.startC) return null;
    const k = Math.floor((c - this.countIn.startC) / this.countIn.beatC) + 1;
    return k >= 1 && k <= this.countIn.beats ? k : null;
  }

  /** Source position (seconds at 100% tempo) at context time c. Negative-relative during count-in. */
  positionAt(c: number): number {
    if (this.state === 'waitingForTarget' || !this.seg || !(this.state === 'countIn' || this.state === 'playing')) {
      return this.positionSec;
    }
    let seg: Segment | undefined = this.history.at(c);
    if (!seg || seg.epoch !== this.seg.epoch) seg = this.seg;
    const s = sourceAt(seg, c);
    return Math.min(s, seg.endS);
  }

  /** Projected segments covering context time up to `untilC` (deterministic loop wraps). */
  private projectedSegments(untilC: number): TransportSegment[] {
    if (!this.seg) return [];
    const out: TransportSegment[] = [this.seg];
    let cur = this.seg;
    while (cur.endKind === 'loop' && contextAt(cur, cur.endS) < untilC && out.length < 64) {
      cur = this.nextLoopSegment(cur);
      out.push(cur);
    }
    return out;
  }

  /** Everything audible or assessable whose context time lies in [c1, c2). */
  scheduleWindow(c1: number, c2: number): ScheduledItem[] {
    if (!(this.state === 'countIn' || this.state === 'playing') || !this.seg) return [];
    const items: ScheduledItem[] = [];
    const ci = this.countIn;
    if (ci && ci.epoch === this.seg.epoch) {
      for (let k = 0; k < ci.beats; k++) {
        const t = ci.startC + k * ci.beatC;
        if (t >= c1 && t < c2) {
          items.push({
            key: `${this.attemptId}:${ci.epoch}:ci:${k}`,
            kind: 'countIn',
            contextTime: t,
            sourceSec: this.seg.s0 - (ci.beats - k) * ci.beatC * this.rate,
            accent: k === 0,
            attemptId: this.attemptId,
            epoch: ci.epoch,
            loopIteration: this.seg.loopIteration,
          });
        }
      }
    }
    for (const seg of this.projectedSegments(c2)) {
      const segStartC = seg.c0;
      const segEndC = contextAt(seg, seg.endS);
      if (segEndC < c1 || segStartC >= c2) continue;
      if (this.backingEnabled && this.backingRates.has(this.rate) && seg.c0 >= c1 && seg.c0 < c2 && seg.endS > seg.s0) {
        items.push({
          key: `${this.attemptId}:${seg.epoch}:${seg.loopIteration}:backing`,
          kind: 'backing',
          contextTime: seg.c0,
          endContextTime: segEndC,
          sourceSec: seg.s0,
          accent: false,
          attemptId: this.attemptId,
          epoch: seg.epoch,
          loopIteration: seg.loopIteration,
        });
      }
      // Only look at events whose source time falls in this segment and window.
      const sLo = Math.max(seg.s0, sourceAt(seg, c1)) - 1e-6;
      const sHi = Math.min(seg.endS, sourceAt(seg, c2)) + 1e-6;
      if (this.mode !== 'wait') {
        for (let i = Transport.lowerBound(this.eventSecList, sLo); i < this.events.length && this.eventSecList[i]! <= sHi; i++) {
          const ev = this.events[i]!;
          const s = this.eventSecList[i]!;
          if (s < seg.s0 - 1e-9 || s >= seg.endS - 1e-9) continue;
          const t = contextAt(seg, s);
          if (t >= c1 && t < c2) {
            items.push({
              key: `${this.attemptId}:${seg.epoch}:${seg.loopIteration}:${ev.id}`,
              kind: 'note',
              contextTime: t,
              sourceSec: s,
              accent: false,
              attemptId: this.attemptId,
              epoch: seg.epoch,
              loopIteration: seg.loopIteration,
              event: ev,
            });
          }
        }
      }
      for (let i = Transport.lowerBound(this.strumSecList, sLo); i < this.strums.length && this.strumSecList[i]! <= sHi; i++) {
        const st = this.strums[i]!;
        const s = this.strumSecList[i]!;
        if (s < seg.s0 - 1e-9 || s >= seg.endS - 1e-9) continue;
        const t = contextAt(seg, s);
        if (t >= c1 && t < c2) {
          items.push({
            key: `${this.attemptId}:${seg.epoch}:${seg.loopIteration}:s${st.key}`,
            kind: 'strum',
            contextTime: t,
            sourceSec: s,
            accent: false,
            attemptId: this.attemptId,
            epoch: seg.epoch,
            loopIteration: seg.loopIteration,
            strum: st,
          });
        }
      }
      const firstBeat = Math.max(0, Math.ceil(this.map.secToTick(seg.s0) / PPQ - 1e-9));
      for (let k = firstBeat; this.map.tickToSec(k * PPQ) < seg.endS - 1e-9; k++) {
        const s = this.map.tickToSec(k * PPQ);
        if (seg.skipStartBeat && Math.abs(s - seg.s0) < 1e-9) continue;
        const t = contextAt(seg, s);
        if (t >= c2) break;
        if (t < c1) continue;
        items.push({
          key: `${this.attemptId}:${seg.epoch}:${seg.loopIteration}:b${k}`,
          kind: 'click',
          contextTime: t,
          sourceSec: s,
          accent: k % 4 === 0,
          attemptId: this.attemptId,
          epoch: seg.epoch,
          loopIteration: seg.loopIteration,
        });
      }
    }
    items.sort((a, b) => a.contextTime - b.contextTime);
    return items;
  }
}
