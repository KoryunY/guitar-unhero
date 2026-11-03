import { describe, expect, it } from 'vitest';
import { expandStrums } from '../../src/transport/transport';
import { chordMidis } from '../../src/domain/tuning';
import type { ChordEvent } from '../../src/domain/score';

const em: ChordEvent = { id: 'c1', startTick: 0, durationTicks: 3840, name: 'Em', frets: [0, 0, 0, 2, 2, 0], pattern: 'D-DU-UDU' };

describe('chord track strums', () => {
  it('expands an eighth-note pattern per bar', () => {
    const s = expandStrums([em]);
    expect(s.map((x) => x.tick)).toEqual([0, 960, 1440, 2400, 2880, 3360]);
    expect(s.map((x) => x.direction)).toEqual(['down', 'down', 'up', 'up', 'down', 'up']);
    expect(s.at(-1)!.durationTicks).toBe(480);
  });
  it('a null pattern is one strum held for the whole chord', () => {
    const s = expandStrums([{ ...em, pattern: null }]);
    expect(s).toHaveLength(1);
    expect(s[0]!.durationTicks).toBe(3840);
  });
  it('patterns restart on bar lines even when a chord starts mid-bar', () => {
    const s = expandStrums([{ ...em, startTick: 1920, durationTicks: 1920, pattern: 'DUDUDUDU' }]);
    expect(s[0]!.tick).toBe(1920);
    expect(s[0]!.direction).toBe('down'); // slot 4 of the bar = beat 3 = D
    expect(s).toHaveLength(4);
  });
  it('light strokes and chucks are flagged', () => {
    const s = expandStrums([{ ...em, pattern: 'dxu-----' }]);
    expect(s.map((x) => [x.light, x.mute])).toEqual([[true, false], [false, true], [true, false]]);
  });
  it('chord pitches come out low to high and respect the capo', () => {
    expect(chordMidis(em.frets)).toEqual([40, 47, 52, 55, 59, 64]);
    expect(chordMidis([0, 1, 0, 2, 3, null], 2)).toEqual([50, 54, 57, 62, 66]);
  });
});

import { Transport } from '../../src/transport/transport';
import { AnchorTimeMap } from '../../src/transport/timemap';
import { blankScore } from '../../src/domain/edit';
import type { NoteEvent, Score } from '../../src/domain/score';

describe('long analysed songs stay cheap to schedule', () => {
  it('a 15-minute song (1 800 anchors, 3 600 notes, 2 700 strums) schedules a window in well under 2 ms', () => {
    const beats = 1800;
    const anchors = Array.from({ length: beats }, (_, i) => ({ tick: i * 960, sourceSec: 0.3 + i * 0.5 + Math.sin(i / 50) * 0.01 }));
    const map = new AnchorTimeMap(anchors);
    const rights = { status: 'user_declared' as const, author: null, license: null, allowedUses: ['local_practice' as const], sourceUri: null, evidence: 't' };
    const base = blankScore({ arrangementId: 'perf', title: 'perf', bpm: 120, bars: beats / 4, rights });
    const events: NoteEvent[] = Array.from({ length: 3600 }, (_, i) => ({ id: `e${i}`, kind: 'note', startTick: i * 480, durationTicks: 480, pitchMidi: 64, string: 1, fret: 0, finger: null, sourceEventIds: [], assessment: { pitch: true, attack: true, sustain: false } }));
    const chords = Array.from({ length: beats / 4 }, (_, i) => ({ id: `c${i}`, startTick: i * 3840, durationTicks: 3840, name: 'Em', frets: [0, 0, 0, 2, 2, 0] as [number, number, number, number, number, number], pattern: 'D-DU-UDU' }));
    const score: Score = { ...base, schemaVersion: 'gu-score/2', events, chords };
    let now = 0;
    const t = new Transport(score, () => now, map);
    t.mode = 'fixed';
    t.seek(900 * 960); // deep into the song
    t.play();
    now = 5;
    const t0 = performance.now();
    let n = 0;
    for (let k = 0; k < 200; k++) n += t.scheduleWindow(now + k * 0.025, now + k * 0.025 + 0.1).length;
    const per = (performance.now() - t0) / 200;
    expect(n).toBeGreaterThan(0);
    expect(per).toBeLessThan(2);
  });
});
