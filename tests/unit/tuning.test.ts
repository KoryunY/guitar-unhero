import { describe, expect, it } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import {
  STANDARD_TUNING_LOW_TO_HIGH, centsFrom, fretToMidi, hzToMidiFloat, midiName, midiToHz, midiToPositions, nearestNote, openMidi,
} from '../../src/domain/tuning';
import type { StringNumber } from '../../src/domain/score';

describe('tuning and string numbering', () => {
  it('string 1 is high E (64) and string 6 is low E (40)', () => {
    expect(openMidi(1)).toBe(64);
    expect(openMidi(6)).toBe(40);
    expect([6, 5, 4, 3, 2, 1].map((s) => openMidi(s as StringNumber))).toEqual([...STANDARD_TUNING_LOW_TO_HIGH]);
  });
  it('matches the schema instrument definition', () => {
    for (const s of fixture.instrument.strings) expect(openMidi(s.number as StringNumber)).toBe(s.openMidi);
  });
  it('converts every fixture event string/fret to its pitch', () => {
    for (const e of fixture.events) expect(fretToMidi(e.string as StringNumber, e.fret)).toBe(e.pitchMidi);
  });
  it('names sounding pitches', () => {
    expect(midiName(64)).toBe('E4');
    expect(midiName(40)).toBe('E2');
    expect(midiName(65)).toBe('F4');
    expect(midiName(67)).toBe('G4');
    expect(midiName(59)).toBe('B3');
    expect(midiName(60)).toBe('C4');
  });
  it('uses the specified frequency formulas', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(40)).toBeCloseTo(82.407, 3);
    expect(midiToHz(45)).toBeCloseTo(110, 6);
    expect(midiToHz(50)).toBeCloseTo(146.832, 3);
    expect(midiToHz(55)).toBeCloseTo(195.998, 3);
    expect(midiToHz(59)).toBeCloseTo(246.942, 3);
    expect(midiToHz(64)).toBeCloseTo(329.628, 3);
    expect(hzToMidiFloat(440)).toBe(69);
    expect(centsFrom(440 * 2 ** (10 / 1200), 69)).toBeCloseTo(10, 9);
    const n = nearestNote(331);
    expect(n.name).toBe('E4');
    expect(n.cents).toBeCloseTo(7.19, 1);
  });
  it('lists all positions for a pitch (pitch alone is ambiguous)', () => {
    expect(midiToPositions(64)).toEqual([
      { string: 1, fret: 0 },
      { string: 2, fret: 5 },
      { string: 3, fret: 9 },
      { string: 4, fret: 14 },
      { string: 5, fret: 19 },
    ]);
  });
});
