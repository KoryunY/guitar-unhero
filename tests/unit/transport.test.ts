import { describe, expect, it } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import type { Score } from '../../src/domain/score';
import { Transport, type ScheduledItem } from '../../src/transport/transport';
import { Scheduler, type OutputSink } from '../../src/transport/scheduler';
import { contextAt, secToTicks, sourceAt, ticksToSec, SegmentHistory } from '../../src/transport/tempo';

const score = fixture as Score;

function setup(opts: { countIn?: number } = {}) {
  const clock = { t: 10 };
  const transport = new Transport(score, () => clock.t);
  transport.countInBeats = opts.countIn ?? 4;
  transport.startDelay = 0.1;
  const log: { item: ScheduledItem; stopped: boolean }[] = [];
  const sink: OutputSink = {
    schedule(item) {
      const rec = { item, stopped: false };
      log.push(rec);
      return { stop: () => { rec.stopped = true; } };
    },
  };
  // A source is live if it was scheduled, not stopped, and has not finished (1 s tail).
  const live = { get size() { return log.filter((r) => !r.stopped && r.item.contextTime + 1 > clock.t).length; } };
  const scheduler = new Scheduler(transport, sink, () => clock.t, { lookahead: 0.1 });
  const run = (until: number, step = 0.025) => {
    const out: ScheduledItem[] = [];
    while (clock.t < until - 1e-12) {
      out.push(...scheduler.tick());
      clock.t = Math.round((clock.t + step) * 1e9) / 1e9;
    }
    out.push(...scheduler.tick());
    return out;
  };
  return { clock, transport, scheduler, log, live, run };
}

describe('tempo mapping (AC-12)', () => {
  it('maps ticks exactly at 60 BPM and other tempos', () => {
    expect(ticksToSec(960, 60)).toBe(1);
    expect(ticksToSec(7680, 60)).toBe(8);
    expect(ticksToSec(960, 120)).toBe(0.5);
    expect(ticksToSec(480, 90)).toBeCloseTo(1 / 3, 12);
    expect(secToTicks(ticksToSec(1234, 77), 77)).toBeCloseTo(1234, 9);
  });
  it('segment mapping is invertible at several rates and seek points', () => {
    for (const rate of [0.5, 0.75, 1]) {
      for (const s0 of [0, 1.5, 3.25]) {
        const seg = { s0, c0: 100.123, rate };
        for (const s of [s0, s0 + 0.5, s0 + 4]) {
          expect(sourceAt(seg, contextAt(seg, s))).toBeCloseTo(s, 12);
        }
        expect(contextAt(seg, s0 + 1)).toBeCloseTo(100.123 + 1 / rate, 12);
      }
    }
  });
  it('segment history maps delayed observations with their own segment', () => {
    const h = new SegmentHistory();
    h.push({ epoch: 1, loopIteration: 0, s0: 0, c0: 0, rate: 1, endS: 4 });
    h.push({ epoch: 2, loopIteration: 0, s0: 4, c0: 10, rate: 0.5, endS: 8 });
    expect(sourceAt(h.at(3)!, 3)).toBe(3);
    expect(sourceAt(h.at(12)!, 12)).toBe(5);
  });
});

describe('transport and scheduler', () => {
  it('counts in four beats, then schedules all fixture notes at exact times', () => {
    const { transport, run } = setup();
    transport.play();
    expect(transport.state).toBe('countIn');
    const items = run(30);
    const countIns = items.filter((i) => i.kind === 'countIn');
    expect(countIns.map((i) => i.contextTime)).toEqual([10.1, 11.1, 12.1, 13.1]);
    const notes = items.filter((i) => i.kind === 'note');
    expect(notes.map((n) => n.event!.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']);
    notes.forEach((n, i) => expect(n.contextTime).toBeCloseTo(14.1 + i, 9));
    expect(transport.state).toBe('completed');
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('50% and 75% tempo reschedule notes (pitch is not changed by playbackRate)', () => {
    for (const rate of [0.5, 0.75]) {
      const { transport, run } = setup({ countIn: 0 });
      transport.setRate(rate);
      transport.play();
      const notes = run(40).filter((i) => i.kind === 'note');
      expect(notes).toHaveLength(8);
      notes.forEach((n, i) => expect(n.contextTime).toBeCloseTo(10.1 + i / rate, 9));
    }
  });

  it('pause captures position, stops sources, and resume uses a new count-in segment', () => {
    const { clock, transport, run, live, log } = setup();
    transport.play();
    run(15.6);
    expect(transport.state).toBe('playing');
    expect(live.size).toBeGreaterThan(0);
    transport.pause();
    expect(transport.state).toBe('paused');
    expect(transport.positionSec).toBeCloseTo(1.5, 6);
    expect(live.size).toBe(0);
    expect(log.some((r) => r.stopped)).toBe(true);
    // Paused time does not advance music.
    clock.t += 5;
    expect(transport.positionAt(clock.t)).toBeCloseTo(1.5, 6);
    transport.play();
    const resumed = run(clock.t + 8).filter((i) => i.kind === 'note');
    expect(resumed[0]!.event!.id).toBe('n3');
    // 4-beat count-in + 0.1 s lead + (2 - 1.5) s.
    expect(resumed[0]!.contextTime).toBeCloseTo(20.6 + 0.1 + 4 + 0.5, 6);
  });

  it('seek invalidates prior scheduling, starts a new attempt and recreates sources', () => {
    const { transport, run, live } = setup({ countIn: 0 });
    transport.play();
    run(12);
    const attempt = transport.attemptId;
    transport.seek(5760);
    expect(transport.attemptId).toBe(attempt + 1);
    expect(transport.state).toBe('playing'); // count-in disabled in this test
    expect(live.size).toBe(0);
    const notes = run(20).filter((i) => i.kind === 'note');
    expect(notes.map((n) => n.event!.id)).toEqual(['n7', 'n8']);
    expect(notes.every((n) => n.attemptId === attempt + 1)).toBe(true);
  });

  it('A/B loop is half-open, wraps exactly and increments the loop iteration', () => {
    const { transport, run } = setup({ countIn: 0 });
    transport.setLoop({ aTick: 960, bTick: 2880 });
    expect(() => transport.setLoop({ aTick: 0, bTick: 480 })).toThrow();
    transport.play();
    const notes = run(10.1 + 6.5).filter((i) => i.kind === 'note');
    expect(notes.map((n) => `${n.event!.id}@${n.loopIteration}`)).toEqual(['n2@0', 'n3@0', 'n2@1', 'n3@1', 'n2@2', 'n3@2', 'n2@3']);
    notes.forEach((n, i) => expect(n.contextTime).toBeCloseTo(10.1 + i, 9));
    // n4 (tick 2880 = B) is never inside [A,B).
    expect(notes.some((n) => n.event!.id === 'n4')).toBe(false);
    expect(new Set(notes.map((n) => n.key)).size).toBe(notes.length);
    expect(transport.state).toBe('playing');
  });

  it('rate change pauses, clears sources and restarts with a count-in', () => {
    const { transport, run, live } = setup();
    transport.play();
    run(16.05);
    transport.setRate(0.5);
    expect(live.size).toBe(0);
    expect(transport.state).toBe('countIn');
    expect(transport.rate).toBe(0.5);
    const notes = run(40).filter((i) => i.kind === 'note');
    expect(notes[0]!.event!.id).toBe('n3'); // paused at 1.95 s
    const gap = notes[1]!.contextTime - notes[0]!.contextTime;
    expect(gap).toBeCloseTo(2, 9);
  });

  it('wait mode stops at each target, schedules no guide notes, and continues on recognition', () => {
    const { clock, transport, run } = setup({ countIn: 0 });
    transport.setMode('wait');
    transport.play();
    run(10.2);
    expect(transport.state).toBe('waitingForTarget');
    expect(transport.waitingTarget!.id).toBe('n1');
    clock.t += 3; // waiting does not advance
    run(clock.t + 0.2);
    expect(transport.waitingTarget!.id).toBe('n1');
    expect(transport.positionAt(clock.t)).toBe(0);
    transport.continueAfterTarget();
    const items = run(clock.t + 1.2);
    expect(items.filter((i) => i.kind === 'note')).toHaveLength(0);
    expect(transport.state).toBe('waitingForTarget');
    expect(transport.waitingTarget!.id).toBe('n2');
  });

  it('device loss pauses and requires an explicit play with count-in', () => {
    const { transport, run, live } = setup();
    transport.play();
    run(15);
    transport.deviceLost();
    expect(transport.state).toBe('deviceLost');
    expect(live.size).toBe(0);
    transport.play();
    expect(transport.state).toBe('countIn');
  });

  it('draws count-in approach positions before s0 and clamps at segment end', () => {
    const { transport, clock, run } = setup();
    transport.play();
    expect(transport.positionAt(clock.t)).toBeCloseTo(-4.1, 6);
    run(30);
    expect(transport.positionAt(clock.t)).toBe(8);
  });
});

import { estimateLoopback, calibrationValid } from '../../src/audio/calibration';
describe('latency calibration', () => {
  it('estimates one combined offset and rejects inconsistent loopback', () => {
    const sched = [1, 1.6, 2.2, 2.8, 3.4, 4.0, 4.6, 5.2];
    const ok = estimateLoopback(sched, sched.map((s, i) => s + 0.082 + (i % 2 ? 0.002 : -0.001)));
    expect(ok.ok).toBe(true);
    expect(ok.offsetMs).toBeGreaterThanOrEqual(81);
    expect(ok.offsetMs).toBeLessThanOrEqual(84);
    const noisy = estimateLoopback(sched, sched.map((s, i) => s + 0.05 + (i % 2 ? 0.1 : 0)));
    expect(noisy.ok).toBe(false);
    const missing = estimateLoopback(sched, [1.08, 1.68]);
    expect(missing).toMatchObject({ ok: false, reason: 'too_few_pulses_heard' });
  });
  it('invalidates on device, sample-rate or route change', () => {
    const cal = { method: 'loopback' as const, offsetMs: 80, spreadMs: 2, samples: 8, deviceId: 'd1', sampleRate: 48000, outputRoute: 'speakers' as const, createdAt: '' };
    expect(calibrationValid(cal, { deviceId: 'd1', sampleRate: 48000, outputRoute: 'speakers' })).toBe(true);
    expect(calibrationValid(cal, { deviceId: 'd2', sampleRate: 48000, outputRoute: 'speakers' })).toBe(false);
    expect(calibrationValid(cal, { deviceId: 'd1', sampleRate: 44100, outputRoute: 'speakers' })).toBe(false);
    expect(calibrationValid(cal, { deviceId: 'd1', sampleRate: 48000, outputRoute: 'headphones' })).toBe(false);
  });
});
