/**
 * Standard six-string tuning and pitch conversions.
 *
 * String 1 = highest-pitched / thinnest E (E4, MIDI 64).
 * String 6 = lowest-pitched / thickest E (E2, MIDI 40).
 * Handedness is a display preference only; it never renumbers strings.
 */
import type { StringNumber } from './score';

/** Low-to-high open-string MIDI pitches, as in the master specification. */
export const STANDARD_TUNING_LOW_TO_HIGH = [40, 45, 50, 55, 59, 64] as const;

/** Open MIDI by string number (index 0 unused). String 1 is high E. */
const OPEN_MIDI_BY_STRING: Record<StringNumber, number> = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40,
};

export const STRING_NUMBERS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];

export const A4_HZ = 440;

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function openMidi(stringNumber: StringNumber): number {
  return OPEN_MIDI_BY_STRING[stringNumber];
}

export function isStringNumber(n: number): n is StringNumber {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}

/** Sounding MIDI pitch for a string/fret with capo 0. */
export function fretToMidi(stringNumber: StringNumber, fret: number): number {
  if (!Number.isInteger(fret) || fret < 0) throw new RangeError(`Invalid fret ${fret}`);
  return OPEN_MIDI_BY_STRING[stringNumber] + fret;
}

/**
 * All playable positions for a pitch. Pitch alone does not identify which of
 * these the learner used.
 */
export function midiToPositions(midi: number, maxFret = 22): { string: StringNumber; fret: number }[] {
  const out: { string: StringNumber; fret: number }[] = [];
  for (const s of STRING_NUMBERS) {
    const fret = midi - OPEN_MIDI_BY_STRING[s];
    if (fret >= 0 && fret <= maxFret) out.push({ string: s, fret });
  }
  return out;
}

export function midiToHz(midi: number, a4 = A4_HZ): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** Fractional MIDI: m = 69 + 12 * log2(f / 440). */
export function hzToMidiFloat(hz: number, a4 = A4_HZ): number {
  return 69 + 12 * Math.log2(hz / a4);
}

/** Cents of `hz` relative to the equal-tempered pitch of `midi`. */
export function centsFrom(hz: number, midi: number, a4 = A4_HZ): number {
  return 1200 * Math.log2(hz / midiToHz(midi, a4));
}

export interface NearestNote {
  midi: number;
  cents: number;
  name: string;
}

export function nearestNote(hz: number, a4 = A4_HZ): NearestNote {
  const midi = Math.round(hzToMidiFloat(hz, a4));
  return { midi, cents: centsFrom(hz, midi, a4), name: midiName(midi) };
}

/** Pitch class name with sharps, e.g. 64 → "E". */
export function pitchClassName(midi: number): string {
  return SHARP_NAMES[((Math.round(midi) % 12) + 12) % 12] ?? '?';
}

/** Scientific pitch name, sounding octave: 64 → "E4", 40 → "E2". */
export function midiName(midi: number): string {
  const m = Math.round(midi);
  return `${pitchClassName(m)}${Math.floor(m / 12) - 1}`;
}

export const STRING_LABELS: Record<StringNumber, { name: string; nickname: string }> = {
  1: { name: 'E4', nickname: 'high E (thinnest)' },
  2: { name: 'B3', nickname: 'B' },
  3: { name: 'G3', nickname: 'G' },
  4: { name: 'D3', nickname: 'D' },
  5: { name: 'A2', nickname: 'A' },
  6: { name: 'E2', nickname: 'low E (thickest)' },
};
