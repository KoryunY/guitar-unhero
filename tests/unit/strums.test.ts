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
