import { describe, expect, it } from 'vitest';
import { TUNINGS, presetOpenMidi } from '../../src/domain/tunings';
import { openMidi } from '../../src/domain/tuning';
import type { StringNumber } from '../../src/domain/score';

describe('tuner presets', () => {
  it('standard matches the app-wide string numbering (string 1 = E4 = 64, string 6 = E2 = 40)', () => {
    for (const s of [1, 2, 3, 4, 5, 6] as StringNumber[]) expect(presetOpenMidi('standard', s)).toBe(openMidi(s));
  });
  it('drop D only lowers string 6 by a whole step', () => {
    expect(presetOpenMidi('drop_d', 6)).toBe(38);
    for (const s of [1, 2, 3, 4, 5] as StringNumber[]) expect(presetOpenMidi('drop_d', s)).toBe(openMidi(s));
  });
  it('half-step down lowers every string by one semitone', () => {
    for (const s of [1, 2, 3, 4, 5, 6] as StringNumber[]) expect(presetOpenMidi('half_step_down', s)).toBe(openMidi(s) - 1);
  });
  it('open tunings spell their chords and keep strings descending', () => {
    const pcs = (id: (typeof TUNINGS)[number]['id']) => new Set(TUNINGS.find((t) => t.id === id)!.openMidi.map((m) => m % 12));
    expect(pcs('open_g')).toEqual(new Set([7, 11, 2])); // G B D
    expect(pcs('open_d')).toEqual(new Set([2, 6, 9])); // D F# A
    for (const t of TUNINGS) for (let i = 1; i < 6; i++) expect(t.openMidi[i - 1]!).toBeGreaterThan(t.openMidi[i]!);
  });
});
