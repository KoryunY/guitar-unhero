import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import { PracticeController } from '../../src/ui/practice/controller';
import type { AudioEngine } from '../../src/audio/engine';
import { SignalTimeline } from '../../src/assessment/timeline';
import type { Score } from '../../src/domain/score';
import { AnchorTimeMap, ConstantTempoMap } from '../../src/transport/timemap';
import { Transport } from '../../src/transport/transport';
import { BEGINNER_PROFILE, FULL_NECK_PROFILE, planFingering, positionsFor } from '../../src/domain/fingering';
import { anchorsFromFit, checkAnchors, fitTaps } from '../../src/domain/alignment';
import { blankScore, commitVersion, deleteNote, History, placeNote, updateNote } from '../../src/domain/edit';
import { derive } from '../../src/domain/arrange';
import { validateScore } from '../../src/domain/validate';
import morning from '../../src/content/exercises/morning-steps.gu-score.json';

const rights = { status: 'user_declared' as const, author: 'me', license: null, allowedUses: ['local_practice' as const, 'modify' as const], sourceUri: null, evidence: 'Own composition.' };
const valid = (s: Score) => {
  const r = validateScore(JSON.parse(JSON.stringify(s)));
  expect(r.issues, JSON.stringify(r.issues)).toEqual([]);
};

describe('time maps (TIME-02)', () => {
  it('constant tempo is exact and invertible', () => {
    const m = new ConstantTempoMap(90);
    expect(m.tickToSec(960)).toBeCloseTo(2 / 3, 12);
    expect(m.secToTick(m.tickToSec(1234))).toBeCloseTo(1234, 9);
  });
  it('anchor map interpolates piecewise and extrapolates with edge slopes', () => {
    const m = new AnchorTimeMap([{ tick: 0, sourceSec: 1.5 }, { tick: 3840, sourceSec: 5.5 }, { tick: 7680, sourceSec: 9 }]);
    expect(m.tickToSec(0)).toBe(1.5);
    expect(m.tickToSec(1920)).toBeCloseTo(3.5, 12);
    expect(m.tickToSec(5760)).toBeCloseTo(7.25, 12);
    expect(m.tickToSec(-960)).toBeCloseTo(0.5, 12);
    expect(m.secToTick(m.tickToSec(5000))).toBeCloseTo(5000, 9);
    expect(m.bpmAt(2)).toBeCloseTo(60, 9);
    expect(m.bpmAt(8)).toBeCloseTo(68.57, 1);
    expect(() => new AnchorTimeMap([{ tick: 0, sourceSec: 2 }, { tick: 960, sourceSec: 1 }])).toThrow();
  });
  it('transport follows an anchor map: notes at recording times, backing per segment at rate 1 only', () => {
    const clock = { t: 10 };
    const map = new AnchorTimeMap([{ tick: 0, sourceSec: 2 }, { tick: 7680, sourceSec: 10 }]);
    const tr = new Transport(fixture as Score, () => clock.t, map);
    tr.countInBeats = 0;
    tr.startDelay = 0.1;
    tr.backingEnabled = true;
    expect(tr.positionSec).toBe(2);
    tr.play();
    const items = tr.scheduleWindow(10, 20);
    const backing = items.filter((i) => i.kind === 'backing');
    expect(backing).toHaveLength(1);
    expect(backing[0]!.sourceSec).toBe(2);
    expect(backing[0]!.endContextTime).toBeCloseTo(18.1, 9);
    const notes = items.filter((i) => i.kind === 'note');
    expect(notes[1]!.contextTime - notes[0]!.contextTime).toBeCloseTo(1, 9);
    tr.setRate(0.5);
    expect(tr.scheduleWindow(0, 100).some((i) => i.kind === 'backing')).toBe(false);
  });
});

describe('song backing playback', () => {
  /** A controller driven by a fake engine and fake timers; returns the backing handles it created. */
  function rig() {
    const clock = { t: 10 };
    let tickFn: (() => void) | null = null;
    vi.stubGlobal('window', { setInterval: (fn: () => void) => { tickFn = fn; return 1; }, clearInterval: () => { tickFn = null; }, setTimeout: () => 0 });
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} });
    const backings: { stopped: boolean }[] = [];
    const engine = {
      get now() { return clock.t; },
      timeline: new SignalTimeline(),
      analyzedUntil: 0,
      on: () => () => {},
      estimatedDeltaIO: () => 0,
      ensureContext: async () => ({}),
      playBacking: () => { const h = { stopped: false, stop: () => { h.stopped = true; } }; backings.push(h); return h; },
      playClick: () => ({ stop: () => {} }),
    } as unknown as AudioEngine;
    const opts = { inputSource: 'none', outputRoute: 'speakers', guideOn: false, metronomeOn: false, deltaIO: null, simProfile: 'accurate', cueLevel: 'full', backingOn: true } as const;
    const c = new PracticeController(fixture as Score, engine, opts, { mode: 'listen', rate: 1 }, { backing: { duration: 30 } as AudioBuffer });
    c.transport.countInBeats = 0;
    const run = (until: number) => {
      while (clock.t < until) { tickFn?.(); clock.t = Math.round((clock.t + 0.025) * 1e9) / 1e9; }
    };
    return { c, run, backings };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('pause stops the recording even after React disposed and restarted the controller', async () => {
    const { c, run, backings } = rig();
    c.start();
    c.dispose(); // React development mode runs every effect twice
    c.start();
    await c.play();
    run(17); // well past the scheduler's 5 s memory of old items
    expect(backings).toHaveLength(1);
    c.pause();
    expect(backings[0]!.stopped).toBe(true);
    await c.play();
    run(18);
    expect(backings.filter((b) => !b.stopped)).toHaveLength(1);
  });

  it('leaving the screen while playing stops the recording', async () => {
    const { c, run, backings } = rig();
    c.start();
    await c.play();
    run(17);
    c.dispose();
    expect(backings.every((b) => b.stopped)).toBe(true);
    expect(c.transport.running).toBe(false);
  });
});

describe('fingering planner (§7.5)', () => {
  it('uses only pitch-compatible positions within the profile', () => {
    expect(positionsFor(64, BEGINNER_PROFILE).map((p) => [p.string, p.fret])).toEqual([[1, 0]]);
    expect(positionsFor(62, BEGINNER_PROFILE).map((p) => [p.string, p.fret])).toEqual([[2, 3]]);
    expect(positionsFor(70, BEGINNER_PROFILE)).toEqual([]);
  });
  it('returns no playable version instead of an impossible tab', () => {
    expect(planFingering([64, 72], BEGINNER_PROFILE)).toMatchObject({ ok: false, reason: 'no_playable_fingering', impossibleIndexes: [1] });
  });
  it('reproduces the fixture fingering and stays in open position', () => {
    const f = fixture as Score;
    const r = planFingering(f.events.map((e) => e.pitchMidi), BEGINNER_PROFILE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.positions.map((p) => [p.string, p.fret, p.finger])).toEqual(f.events.map((e) => [e.string, e.fret, e.finger]));
  });
  it('prefers fewer hand shifts on the full neck', () => {
    const r = planFingering([67, 69, 71, 72], FULL_NECK_PROFILE);
    expect(r.ok).toBe(true);
    if (r.ok) r.positions.forEach((p, i) => expect(p.fret + [64, 59, 55, 50, 45, 40][p.string - 1]!).toBe([67, 69, 71, 72][i]));
  });
});

describe('alignment (§7.4)', () => {
  it('fits tapped beats, tolerating jitter and one missed tap', () => {
    const taps = [1.0, 1.52, 1.99, 2.51, 3.0, 4.01, 4.49, 5.0].map((t) => t + 0.2);
    const fit = fitTaps(taps);
    expect(fit.ok).toBe(true);
    expect(fit.bpm!).toBeCloseTo(120, 0);
    expect(fit.firstBeatSec!).toBeCloseTo(1.2, 1);
    expect(fit.residualMs!).toBeLessThan(15);
    const anchors = anchorsFromFit(fit, 3840);
    expect(anchors[1]!.sourceSec - anchors[0]!.sourceSec).toBeCloseTo(2, 1);
  });
  it('rejects too few or doubled taps and warns about drift', () => {
    expect(fitTaps([1, 2, 3]).ok).toBe(false);
    expect(fitTaps([1, 1.01, 2, 3, 4]).ok).toBe(false);
    // Gradual slowdown from 120 to ~104 BPM.
    const drifting: number[] = [0];
    for (let i = 1; i < 12; i++) drifting.push(drifting[i - 1]! + 0.5 + 0.007 * i);
    expect(fitTaps(drifting).warnings.length).toBeGreaterThan(0);
  });
  it('checks anchor order, bounds and implausible speed changes', () => {
    expect(checkAnchors([{ tick: 0, sourceSec: 1 }], 10).ok).toBe(false);
    expect(checkAnchors([{ tick: 0, sourceSec: 1 }, { tick: 960, sourceSec: 0.5 }], 10).ok).toBe(false);
    expect(checkAnchors([{ tick: 0, sourceSec: 1 }, { tick: 3840, sourceSec: 3 }, { tick: 7680, sourceSec: 8 }], 10).warnings.length).toBeGreaterThan(0);
    expect(checkAnchors([{ tick: 0, sourceSec: 1 }, { tick: 3840, sourceSec: 3 }], 2).ok).toBe(false);
  });
});

describe('score editor operations', () => {
  it('places notes monophonically, edits, deletes, and validates', () => {
    let s = blankScore({ arrangementId: 'user.song-1', title: 'My tune', bpm: 80, bars: 2, rights });
    s = placeNote(s, { startTick: 0, durationTicks: 1920, string: 1, fret: 0 }).score;
    const p = placeNote(s, { startTick: 960, durationTicks: 960, string: 1, fret: 3 });
    expect(p.trimmed).toEqual(['e1']);
    s = p.score;
    expect(s.events.map((e) => [e.startTick, e.durationTicks, e.pitchMidi])).toEqual([[0, 960, 64], [960, 960, 67]]);
    s = updateNote(s, 'e2', { fret: 1 });
    expect(s.events[1]).toMatchObject({ id: 'e2', pitchMidi: 65, finger: 1 });
    s = placeNote(s, { startTick: 7680, durationTicks: 960, string: 2, fret: 0 }).score;
    expect(s.durationTicks).toBe(11520); // grows by whole bars
    valid(s);
    s = deleteNote(s, 'e1');
    expect(s.events).toHaveLength(2);
    expect(() => placeNote(s, { startTick: 0, durationTicks: 960, string: 1, fret: 30 })).toThrow();
  });
  it('commits immutable versions with parent links and logs', () => {
    const v1 = placeNote(blankScore({ arrangementId: 'user.s', title: 't', bpm: 60, bars: 1, rights }), { startTick: 0, durationTicks: 960, string: 1, fret: 0 }).score;
    const v2 = commitVersion(v1, updateNote(v1, 'e1', { fret: 1 }), { kind: 'manual_edit', description: 'Changed E to F', sourceEventIds: ['e1'] });
    expect(v2).toMatchObject({ version: 2, parent: { arrangementId: 'user.s', version: 1 } });
    expect(v2.transformations.at(-1)).toMatchObject({ kind: 'manual_edit', resultEventIds: ['e1'] });
    valid(v2);
  });
  it('undo/redo history', () => {
    const h = new History(1);
    h.push(2);
    h.push(3);
    expect(h.undo()).toBe(2);
    expect(h.redo()).toBe(3);
    h.undo();
    h.push(4);
    expect(h.canRedo).toBe(false);
  });
});

describe('simplified arrangements (§7.5)', () => {
  const src = morning as Score;
  it('derives pulse, strong-beats and easy-melody versions with logs and disclosures, all valid', () => {
    for (const level of ['pulse', 'strong-beats', 'easy-melody'] as const) {
      const d = derive(src, level);
      expect(d.ok).toBe(true);
      expect(d.score!.role).toBe('simplified_arrangement');
      expect(d.score!.parent).toEqual({ arrangementId: src.arrangementId, version: 1 });
      expect(d.disclosures.length).toBeGreaterThan(0);
      valid(d.score!);
    }
    const strong = derive(src, 'strong-beats').score!;
    expect(strong.events.every((e) => e.startTick % 1920 === 0)).toBe(true);
    expect(strong.transformations.some((t) => t.kind === 'omit')).toBe(true);
  });
  it('octave-shifts high notes into open position without changing pitch classes', () => {
    let s = blankScore({ arrangementId: 'user.high', title: 'High', bpm: 80, bars: 1, rights });
    s = placeNote(s, { startTick: 0, durationTicks: 960, string: 1, fret: 12 }).score; // E5
    s = placeNote(s, { startTick: 960, durationTicks: 960, string: 1, fret: 13 }).score; // F5
    const d = derive(s, 'easy-melody');
    expect(d.ok).toBe(true);
    expect(d.score!.events.map((e) => e.pitchMidi)).toEqual([64, 65]);
    expect(d.score!.transformations.map((t) => t.kind)).toContain('octave_shift');
    expect(d.disclosures.join(' ')).toContain('key is unchanged');
  });
});
