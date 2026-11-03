/**
 * PracticeController glues the pure transport/matcher to the AudioEngine.
 * Score → transport → scheduler (audio + targets); mic → observations → matcher.
 * The two paths meet only in the matcher, never through UI render timing.
 * A 25 ms interval only refills the schedule; the AudioContext clock is the
 * music clock.
 */
import type { NoteEvent, Score } from '../../domain/score';
import { Transport, type PracticeMode, type ScheduledItem, type TransportState } from '../../transport/transport';
import { Scheduler, type OutputSink } from '../../transport/scheduler';
import { FixedTempoMatcher, WaitTargetJudge } from '../../assessment/matcher';
import type { Judgment, TargetInstance } from '../../assessment/types';
import { BEGINNER_POLICY } from '../../assessment/types';
import { computeStats, suggestNext, type InputSource, type PhraseStats } from '../../assessment/summary';
import { backingPolicy, guidePolicy } from '../../assessment/guidePolicy';
import { chordMidis } from '../../domain/tuning';
import type { TimeMap } from '../../transport/timemap';
import type { AudioEngine } from '../../audio/engine';
import type { AttackObservation } from '../../audio/observations';
import { midiName, pitchClassName } from '../../domain/tuning';
import type { OutputRoute, PracticeSummaryRecord } from '../../storage/types';

export type SimProfile = 'accurate' | 'mixed' | 'silent';
export type CueLevel = 'full' | 'reduced' | 'none';

export interface PracticeOptions {
  inputSource: InputSource;
  outputRoute: OutputRoute;
  guideOn: boolean;
  metronomeOn: boolean;
  /** Valid combined calibration offset in seconds, or null when uncalibrated. */
  deltaIO: number | null;
  simProfile: SimProfile;
  /** Recall: full cues, reduced (no fret/finger numbers) or none (play from memory). */
  cueLevel: CueLevel;
  /** Play the song's backing recording (only at 100 % speed). */
  backingOn?: boolean;
  /** When false (e.g. an unreviewed transcription candidate), nothing is assessed. */
  assessmentAllowed?: boolean;
}

export interface PhraseResult {
  stats: PhraseStats;
  suggestion: string;
  record: PracticeSummaryRecord;
}

export class PracticeController {
  readonly transport: Transport;
  readonly score: Score;
  private readonly scheduler: Scheduler;
  private readonly matcher: FixedTempoMatcher;
  private readonly waitJudge = new WaitTargetJudge();
  private timer: number | null = null;
  private unsubs: (() => void)[] = [];
  private opts: PracticeOptions;
  private simQueue: { at: number; onset: number; midi: number | null }[] = [];
  private attemptStartedAt = new Date();
  private summarized = false;

  readonly backing: AudioBuffer | null;
  /** Time-stretched copies of the backing (same pitch) by speed. */
  private readonly stretched = new Map<number, AudioBuffer>();
  judgments: Judgment[] = [];
  /** Latest judgment per `${loopIteration}:${eventId}` for drawing. */
  readonly judgmentByNote = new Map<string, Judgment>();
  feedback: string | null = null;
  result: PhraseResult | null = null;
  loopFeedback: string | null = null;
  private listeners = new Set<() => void>();

  constructor(
    score: Score,
    private readonly engine: AudioEngine,
    opts: PracticeOptions,
    initial: { mode: PracticeMode; rate: number },
    extra: { map?: TimeMap; backing?: AudioBuffer | null } = {},
  ) {
    this.score = score;
    this.opts = opts;
    this.backing = extra.backing ?? null;
    this.transport = new Transport(score, () => engine.now, extra.map);
    this.transport.backingEnabled = !!this.backing && !!opts.backingOn;
    this.transport.mode = initial.mode;
    if (initial.rate !== 1) this.transport.rate = initial.rate;
    this.waitJudge.setSimulated(opts.inputSource === 'simulation');
    const sink: OutputSink = { schedule: (item) => this.output(item) };
    this.scheduler = new Scheduler(this.transport, sink, () => engine.now);
    this.matcher = new FixedTempoMatcher(this.matchContext(), engine.timeline);
    // The transport and scheduler belong to this controller, so this subscription lives as long as it does.
    this.transport.subscribe((e) => {
      if (e.type === 'stopAll') {
        this.matcher.reset();
        this.waitJudge.clear();
        this.simQueue = [];
      } else if (e.type === 'attempt') {
        this.newAttempt();
      } else if (e.type === 'loopWrap') {
        this.onLoopWrap(e.loopIteration - 1);
      }
      this.notify();
    });
  }

  /**
   * Engine and page listeners. start() attaches them and dispose() removes them, so a
   * disposed controller can start again (React runs effects twice in development).
   */
  private attach(): void {
    if (this.unsubs.length) return;
    const engine = this.engine;
    const onVis = () => {
      if (document.visibilityState === 'hidden' && this.transport.running) {
        this.transport.pause('hidden');
        this.feedback = 'Paused while the tab was in the background.';
        this.notify();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    this.unsubs.push(
      engine.on('attack', (a) => this.onAttack(a)),
      engine.on('deviceLost', () => {
        if (this.opts.inputSource === 'microphone') {
          this.transport.deviceLost();
          this.feedback = 'The microphone disconnected. Practice paused — nothing was marked wrong. Reconnect it in Setup, then press Play.';
          this.notify();
        }
      }),
      engine.on('context', (state) => {
        if (state !== 'running' && this.transport.running) {
          this.transport.pause('context');
          this.feedback = 'Audio was interrupted, so practice paused. Press Play to continue with a count-in.';
          this.notify();
        }
      }),
      () => document.removeEventListener('visibilitychange', onVis),
    );
  }

  // ---------------- observers ----------------
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  get assessing(): boolean {
    return this.transport.mode !== 'listen' && this.opts.inputSource !== 'none' && this.opts.assessmentAllowed !== false;
  }

  get backingState() {
    return backingPolicy({ backingOn: !!this.backing && !!this.opts.backingOn, route: this.opts.outputRoute, assessing: this.assessing });
  }

  get guide() {
    return guidePolicy({ guideOn: this.opts.guideOn, route: this.opts.outputRoute, assessing: this.assessing });
  }

  get options(): PracticeOptions {
    return this.opts;
  }

  get calibrated(): boolean {
    return this.opts.deltaIO !== null;
  }

  setOptions(patch: Partial<PracticeOptions>): void {
    this.opts = { ...this.opts, ...patch };
    this.transport.backingEnabled = !!this.backing && !!this.opts.backingOn;
    this.waitJudge.setSimulated(this.opts.inputSource === 'simulation');
    this.matcher.setContext(this.matchContext());
    this.notify();
  }

  private matchContext() {
    return {
      // Uncalibrated: use the browser's own output-latency estimate (still labeled approximate).
      deltaIO: this.opts.deltaIO ?? this.engine.estimatedDeltaIO(),
      calibrated: this.opts.deltaIO !== null,
      rhythmEnabled: this.transport.mode === 'fixed',
      simulated: this.opts.inputSource === 'simulation',
    };
  }

  // ---------------- lifecycle ----------------
  start(): void {
    this.attach();
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  /** Leaving the screen: pause, and silence everything still sounding (backing recording, guide, clicks). */
  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.transport.pause('dispose');
    this.scheduler.stopAll();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners.clear();
  }

  // ---------------- commands ----------------
  async play(): Promise<void> {
    await this.engine.ensureContext();
    if (this.transport.state === 'completed') this.newAttempt();
    this.feedback = null;
    this.transport.play();
    this.start();
    this.tick();
  }

  pause(): void {
    this.transport.pause();
  }

  togglePlay(): void {
    if (this.transport.running) this.pause();
    else void this.play();
  }

  async restart(): Promise<void> {
    await this.engine.ensureContext();
    this.feedback = null;
    this.transport.restart();
    this.start();
  }

  seekTick(tick: number): void {
    this.transport.seek(Math.round(tick));
  }

  seekBeats(delta: number): void {
    const beatTick = 960;
    const cur = Math.round(this.transport.secToTick(this.transport.positionAt(this.engine.now)));
    const target = Math.max(0, Math.min(this.score.durationTicks - beatTick, Math.round(cur / beatTick) * beatTick + delta * beatTick));
    this.transport.seek(target);
  }

  /** Provide a slowed-down (pitch-preserving) copy of the backing for `rate`. */
  setStretchedBacking(rate: number, buffer: AudioBuffer): void {
    this.stretched.set(rate, buffer);
    this.transport.backingRates = new Set([1, ...this.stretched.keys()]);
    this.notify();
  }

  hasBackingAt(rate: number): boolean {
    return rate === 1 || this.stretched.has(rate);
  }

  setRate(rate: number): void {
    this.transport.setRate(rate);
  }

  setMode(mode: PracticeMode): void {
    this.transport.setMode(mode);
    this.matcher.setContext(this.matchContext());
  }

  setLoop(loop: { aTick: number; bTick: number } | null): void {
    this.transport.setLoop(loop);
  }

  /** Wait mode: explicit skip. Records not_assessed (or the first attempt) and continues. */
  skipTarget(): void {
    const j = this.waitJudge.skip();
    if (j) this.addJudgment(j);
    this.feedback = 'Skipped. Moving on.';
    this.transport.continueAfterTarget();
    this.notify();
  }

  /** Simulation only: play the waiting/next target (or a wrong note). */
  simulatePluck(correct: boolean): void {
    if (this.opts.inputSource !== 'simulation') return;
    const target = this.transport.waitingTarget ?? this.nextEventAfter(this.transport.positionAt(this.engine.now));
    if (!target) return;
    const midi = correct ? target.pitchMidi : target.pitchMidi + (target.fret >= 2 ? -2 : 1);
    const onset = this.engine.now;
    this.simQueue.push({ at: onset + 0.14, onset, midi });
  }

  private nextEventAfter(s: number): NoteEvent | null {
    return this.transport.events.find((e) => this.transport.eventSec(e) >= s - 0.3) ?? null;
  }

  // ---------------- internals ----------------
  private newAttempt(): void {
    this.judgments = [];
    this.judgmentByNote.clear();
    this.result = null;
    this.loopFeedback = null;
    this.summarized = false;
    this.attemptStartedAt = new Date();
    this.matcher.reset();
    this.matcher.setContext(this.matchContext());
  }

  private output(item: ScheduledItem) {
    if (item.kind === 'backing') {
      if (!this.backing || item.endContextTime === undefined) return null;
      const bp = this.backingState;
      if (!bp.audible) return null;
      const rate = this.transport.rate;
      const buf = rate === 1 ? this.backing : this.stretched.get(rate);
      if (!buf) return null;
      if (bp.blocksAssessment) this.engine.blockAssessment(item.contextTime, item.endContextTime + 0.35, 'backing_audible_on_speakers');
      // A stretched copy runs 1/rate times longer: recording second s sits at s / rate.
      return this.engine.playBacking(buf, item.contextTime, item.sourceSec / rate, item.endContextTime);
    }
    if (item.kind === 'note') {
      if (!this.guide.guideAudible || !item.event) return null;
      const ev = item.event;
      const dur = (this.transport.tickToSec(ev.startTick + ev.durationTicks) - this.transport.tickToSec(ev.startTick)) / this.transport.rate + 0.6;
      const h = this.engine.playNote(item.event.pitchMidi, item.contextTime, 'guide', dur);
      // Guide audible while assessing (headphones): nothing to block. Listen mode: not assessed anyway.
      return h;
    }
    if (item.kind === 'strum') {
      // Chord accompaniment follows the guide policy: never audible to the mic while it is checking notes.
      if (!this.guide.guideAudible || !item.strum) return null;
      const st = item.strum;
      const midis = chordMidis(st.chord.frets, this.transport.score.instrument.capo);
      const dur = (this.transport.tickToSec(st.tick + st.durationTicks) - this.transport.tickToSec(st.tick)) / this.transport.rate + 0.25;
      return this.engine.strum(midis, item.contextTime, { direction: st.direction, light: st.light, mute: st.mute, maxDur: dur });
    }
    if (item.kind === 'click' && !this.opts.metronomeOn) return null;
    return this.engine.playClick(item.contextTime, item.accent || item.kind === 'countIn');
  }

  private target(ev: NoteEvent, contextTime: number, loopIteration: number, key: string): TargetInstance {
    const t = this.transport;
    const rate = t.rate;
    // Neighbours as actually played: inside an A–B loop the last note is followed by the
    // first note of the next pass, so windows must not overlap across the wrap.
    const loop = t.loop;
    const inLoop = loop ? t.events.filter((e) => e.startTick >= loop.aTick && e.startTick < loop.bTick) : t.events;
    const idx = inLoop.indexOf(ev);
    const s = t.eventSec(ev);
    let gapBefore = Infinity;
    let gapAfter = Infinity;
    if (idx >= 0) {
      const prev = inLoop[idx - 1];
      const next = inLoop[idx + 1];
      gapBefore = prev ? s - t.eventSec(prev) : Infinity;
      gapAfter = next ? t.eventSec(next) - s : Infinity;
      if (loop && inLoop.length) {
        const a = t.tickToSec(loop.aTick);
        const b = t.tickToSec(loop.bTick);
        if (!next) gapAfter = b - s + (t.eventSec(inLoop[0]!) - a);
        if (!prev) gapBefore = s - a + (b - t.eventSec(inLoop[inLoop.length - 1]!));
      }
    }
    return { key, attemptId: t.attemptId, loopIteration, event: ev, contextTime, gapBeforeSec: gapBefore / rate, gapAfterSec: gapAfter / rate };
  }

  /** Recent attacks while playing in wait mode, replayed when waiting begins (early-play grace). */
  private recentAttacks: AttackObservation[] = [];

  private tick(): void {
    const now = this.engine.now;
    const before: TransportState = this.transport.state;
    const fresh = this.scheduler.tick();
    if (this.transport.mode === 'fixed' && this.opts.inputSource !== 'none') {
      for (const item of fresh) {
        if (item.kind !== 'note' || !item.event) continue;
        this.matcher.addTarget(this.target(item.event, item.contextTime, item.loopIteration, item.key));
        if (this.opts.inputSource === 'simulation') this.queueAutoSim(item);
      }
    } else if (this.transport.mode === 'fixed' && this.opts.inputSource === 'none') {
      // Listening off: register targets so the summary truthfully shows "not assessed".
      for (const item of fresh) {
        if (item.kind === 'note' && item.event) this.matcher.addTarget(this.target(item.event, item.contextTime, item.loopIteration, item.key));
      }
    }
    if (this.transport.state === 'waitingForTarget' && !this.waitJudge.active && this.transport.waitingTarget) {
      const ev = this.transport.waitingTarget;
      const key = `${this.transport.attemptId}:w:${this.transport.loopIteration}:${ev.id}`;
      this.waitJudge.begin(this.target(ev, now, this.transport.loopIteration, key), now);
      // A note played slightly before the transport reached the target still counts once.
      const early = this.recentAttacks.filter((a) => a.onsetContextSec >= now - 0.35);
      this.recentAttacks = [];
      for (const a of early) {
        if (!this.waitJudge.active) break;
        this.handleWaitAttack(a);
      }
      this.feedback =
        this.opts.inputSource === 'none'
          ? `Waiting: play ${midiName(ev.pitchMidi)} (string ${ev.string}, ${ev.fret === 0 ? 'open' : `fret ${ev.fret}`}), then press Continue. Listening is off.`
          : this.opts.cueLevel === 'none'
            ? 'Waiting for the next note — from memory.'
            : this.opts.cueLevel === 'reduced'
              ? `Waiting for the next note on string ${ev.string}.`
              : `Waiting for ${midiName(ev.pitchMidi)} — string ${ev.string}, ${ev.fret === 0 ? 'open' : `fret ${ev.fret}`}${ev.finger ? `, finger ${ev.finger}` : ''}.`;
      if (this.opts.inputSource === 'simulation' && this.opts.simProfile !== 'silent') {
        const idx = this.transport.events.indexOf(ev);
        const wrongFirst = this.opts.simProfile === 'mixed' && idx % 3 === 2;
        if (wrongFirst) this.simQueue.push({ at: now + 0.8, onset: now + 0.66, midi: ev.pitchMidi + 1 });
        this.simQueue.push({ at: now + (wrongFirst ? 1.8 : 0.9), onset: now + (wrongFirst ? 1.66 : 0.76), midi: ev.pitchMidi });
      }
      this.notify();
    }
    // Deliver simulated attacks once their (simulated) analysis delay has passed.
    if (this.simQueue.length) {
      const due = this.simQueue.filter((q) => q.at <= now);
      this.simQueue = this.simQueue.filter((q) => q.at > now);
      due.forEach((q) => this.engine.simulateAttack(q.midi, q.onset));
    }
    // Judge only what the analyser has had time to hear: if the worker lags, wait for it
    // (unless it has stopped delivering entirely, e.g. device lost → not assessed).
    let judgeAt = now;
    if (this.opts.inputSource === 'microphone') {
      const until = this.engine.analyzedUntil;
      if (now - until < 1) judgeAt = Math.min(now, until + 0.25);
    }
    const js = this.matcher.finalize(judgeAt);
    if (js.length) {
      js.forEach((j) => this.addJudgment(j));
      const last = js[js.length - 1]!;
      this.feedback = this.describe(last);
      this.notify();
    }
    if (this.transport.state === 'completed' && !this.summarized && this.matcher.pendingCount === 0) {
      this.summarize();
    }
    if (before !== this.transport.state) this.notify();
  }

  private queueAutoSim(item: ScheduledItem): void {
    const ev = item.event!;
    const idx = this.transport.events.indexOf(ev);
    const p = this.opts.simProfile;
    if (p === 'silent') return;
    let midi: number | null = ev.pitchMidi;
    let offset = ((idx * 37) % 41) / 1000 - 0.02; // deterministic ±20 ms
    if (p === 'mixed') {
      if (idx % 3 === 2) midi = ev.pitchMidi + (ev.fret >= 2 ? -2 : 1);
      if (idx % 4 === 3) offset = 0.26;
      if (idx % 5 === 4) return; // a missed note
    }
    const onset = item.contextTime + (this.opts.deltaIO ?? 0) + offset;
    this.simQueue.push({ at: onset + 0.14, onset, midi });
  }

  private onAttack(a: AttackObservation): void {
    const sim = this.opts.inputSource === 'simulation';
    if (this.opts.inputSource === 'none') return;
    // Only accept evidence from the configured source: simulated attacks never mix with real ones.
    if (a.simulated !== sim) return;
    if (!this.transport.running && this.transport.state !== 'waitingForTarget') return;
    if (this.transport.mode === 'fixed') {
      this.matcher.addAttack(a);
      return;
    }
    if (this.transport.mode === 'wait' && this.transport.state !== 'waitingForTarget') {
      this.recentAttacks = [...this.recentAttacks.filter((x) => x.onsetContextSec > a.onsetContextSec - 2), a];
      return;
    }
    if (this.transport.mode === 'wait' && this.transport.state === 'waitingForTarget') this.handleWaitAttack(a);
  }

  private handleWaitAttack(a: AttackObservation): void {
    const sim = this.opts.inputSource === 'simulation';
    {
      const r = this.waitJudge.addAttack(a);
      const ev = this.transport.waitingTarget!;
      if (r.outcome === 'accepted' && r.judgment) {
        this.addJudgment(r.judgment);
        this.feedback = `${sim ? 'Simulated: ' : ''}I heard ${pitchClassName(ev.pitchMidi)}. Moving on.`;
        this.transport.continueAfterTarget();
      } else if (r.outcome === 'wrong' && a.pitchMidiFloat !== null) {
        this.feedback = `${sim ? 'Simulated: ' : ''}That sounded like ${pitchClassName(Math.round(a.pitchMidiFloat))}. The target is ${pitchClassName(ev.pitchMidi)} — string ${ev.string}, ${ev.fret === 0 ? 'open' : `fret ${ev.fret}`}.`;
      } else if (r.outcome === 'unclear') {
        this.feedback = a.reasonCodes.includes('clipping')
          ? 'That was too loud for the microphone (clipping). Pluck a little softer or move the mic back.'
          : 'I heard something, but not one clear note. If it sounded dull or buzzy to you, move your fingertip closer to the fret and check no other finger touches the string.';
      }
      this.notify();
    }
  }

  private addJudgment(j: Judgment): void {
    this.judgments.push(j);
    this.judgmentByNote.set(`${j.loopIteration}:${j.targetEventId}`, j);
  }

  private describe(j: Judgment): string {
    const prefix = j.simulated ? 'Simulated: ' : '';
    const target = pitchClassName(j.targetMidi);
    if (j.state === 'not_assessed') {
      if (j.reasonCodes.includes('listening_unavailable')) return 'Not assessed — no usable listening for that note.';
      return 'Not assessed.';
    }
    if (j.reasonCodes.includes('no_attack_detected')) return `${prefix}I didn't hear ${target} there.`;
    if (j.reasonCodes.includes('clipping')) return `${prefix}Too loud for the mic (clipping) — pitch not judged.`;
    if (j.pitchState === 'incorrect' && j.observedMidi !== null) return `${prefix}That sounded like ${pitchClassName(Math.round(j.observedMidi))}. The target was ${target}.`;
    if (j.pitchState === 'uncertain') return `${prefix}I couldn't hear a clear pitch for ${target}.`;
    if (j.rhythmState === 'incorrect' && j.timingErrorMs !== null) {
      return `${prefix}${target}: right note, ${j.timingErrorMs > 0 ? 'late' : 'early'} by about ${Math.abs(j.timingErrorMs)} ms${this.calibrated ? '' : ' (approximate)'}.`;
    }
    return `${prefix}${target} — good.`;
  }

  private onLoopWrap(finishedIteration: number): void {
    // Give a short phrase observation for the loop that just ended, once judged.
    window.setTimeout(() => {
      const js = this.judgments.filter((j) => j.loopIteration === finishedIteration);
      if (!js.length) return;
      const stats = computeStats(js, { rhythmEnabled: this.transport.mode === 'fixed', calibrated: this.calibrated });
      const sug = suggestNext(js, stats, { inputSource: this.opts.inputSource, rate: this.transport.rate, events: this.transport.events, mode: this.transport.mode });
      const acc = stats.pitch.accuracy === null ? 'pitch not assessed' : `${stats.pitch.correct}/${stats.pitch.assessed} notes on pitch`;
      this.loopFeedback = `Loop ${finishedIteration + 1}: ${acc}; coverage ${stats.assessable}/${stats.eligible}. ${sug.text}`;
      this.notify();
    }, 900);
  }

  /** Build the phrase result from the current attempt (on completion or on request). */
  summarize(): PhraseResult | null {
    this.summarized = true;
    const mode = this.transport.mode;
    const stats = computeStats(this.judgments, { rhythmEnabled: mode === 'fixed', calibrated: this.calibrated });
    const sug = suggestNext(this.judgments, stats, { inputSource: this.opts.inputSource, rate: this.transport.rate, events: this.transport.events, mode });
    const record: PracticeSummaryRecord = {
      id: `${this.score.arrangementId}:${Date.now()}`,
      arrangementId: this.score.arrangementId,
      arrangementVersion: this.score.version,
      title: this.score.title,
      mode,
      rate: this.transport.rate,
      loop: this.transport.loop,
      inputSource: this.opts.inputSource,
      simulated: this.opts.inputSource === 'simulation',
      calibrated: this.calibrated,
      policyVersion: BEGINNER_POLICY.version,
      cueLevel: this.opts.cueLevel,
      stats,
      suggestion: sug.text,
      startedAt: this.attemptStartedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
    this.result = { stats, suggestion: sug.text, record };
    this.notify();
    return this.result;
  }
}
