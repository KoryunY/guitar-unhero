/**
 * Shared helpers for the song importers: tuning names, note names, repeat expansion,
 * error plumbing and the final clean-up every importer runs.
 */
import { PPQ } from '../score';
import { mod12, noteNamePc, pcName } from '../chords';
import { openMidi, STRING_NUMBERS } from '../tuning';
import type {
  ImportedChord, ImportedNote, ImportedSong, ImportedTuning, ImportErrorCode, ImportFailure, ImportOutcome,
} from './types';

export { mod12, noteNamePc, pcName };

export const IMPORT_PPQ = PPQ as 960;
export const DEFAULT_BPM = 90;
export const MAX_TEXT_CHARS = 1_000_000;
export const MAX_NOTES = 100_000;
export const MAX_CHORDS = 20_000;
export const MAX_EXPANDED_BARS = 4_096;
export const MAX_REPEAT_TIMES = 16;

/** Standard tuning, index 0 = string 1 (high E, MIDI 64) … index 5 = string 6 (low E, 40). */
export const STANDARD_OPEN_BY_STRING: readonly number[] = STRING_NUMBERS.map((s) => openMidi(s));

const KNOWN_TUNINGS: { name: string; open: number[] }[] = [
  { name: 'Standard', open: [...STANDARD_OPEN_BY_STRING] },
  { name: 'Drop D', open: [64, 59, 55, 50, 45, 38] },
  { name: 'Half step down (E♭ standard)', open: [63, 58, 54, 49, 44, 39] },
  { name: 'Whole step down (D standard)', open: [62, 57, 53, 48, 43, 38] },
  { name: 'Drop C♯', open: [63, 58, 54, 49, 44, 37] },
  { name: 'Drop C', open: [62, 57, 53, 48, 43, 36] },
  { name: 'Open G', open: [62, 59, 55, 50, 43, 38] },
  { name: 'Open D', open: [62, 57, 54, 50, 45, 38] },
  { name: 'Open E', open: [64, 59, 56, 52, 47, 40] },
  { name: 'Open C', open: [64, 60, 55, 48, 43, 36] },
  { name: 'DADGAD', open: [62, 57, 55, 50, 45, 38] },
];

export function standardTuning(): ImportedTuning {
  return { name: 'Standard', openMidiByString: [...STANDARD_OPEN_BY_STRING], standard: true };
}

/** Name a tuning (index 0 = string 1). Unknown tunings are listed low → high. */
export function describeTuning(openMidiByString: readonly number[]): ImportedTuning {
  const open = [...openMidiByString];
  const known = open.length === 6 ? KNOWN_TUNINGS.find((t) => t.open.every((m, i) => m === open[i])) : undefined;
  const standard = known?.name === 'Standard';
  const lowToHigh = [...open].reverse().map((m) => pcName(m)).join(' ');
  return { name: known ? known.name : `Custom (${lowToHigh})`, openMidiByString: open, standard };
}

export function tuningWarning(t: ImportedTuning): string | null {
  if (t.standard) return null;
  const lowToHigh = [...t.openMidiByString].reverse().map((m) => pcName(m)).join(' ');
  if (t.openMidiByString.length !== 6) return `This part is for a ${t.openMidiByString.length}-string instrument. Only six-string guitar is supported, so some notes may not fit.`;
  return `This song uses ${t.name} tuning (low to high: ${lowToHigh}). Retune your guitar to match before you play.`;
}

export function capoWarning(capo: number): string | null {
  return capo > 0 ? `Put a capo on fret ${capo}. Fret numbers count from the capo.` : null;
}

/** Natural-harmonic pitch offset above the open string for a touched fret. */
export function naturalHarmonicOffset(fret: number): number | null {
  const table: Record<number, number> = { 12: 12, 24: 24, 7: 19, 19: 19, 5: 24, 4: 28, 9: 28, 16: 28, 3: 31 };
  return table[fret] ?? null;
}

export function ticksPerBar(beatsPerBar: number, beatUnit: number): number {
  return Math.round((beatsPerBar * IMPORT_PPQ * 4) / beatUnit);
}

export function isValidMeter(beatsPerBar: number, beatUnit: number): boolean {
  return Number.isInteger(beatsPerBar) && beatsPerBar >= 1 && beatsPerBar <= 32 && [1, 2, 4, 8, 16, 32].includes(beatUnit);
}

/** Thrown inside an importer and turned into a clean failure at its boundary. */
export class ImportAbort extends Error {
  constructor(public readonly code: ImportErrorCode, message: string) {
    super(message);
  }
}

export function failure(code: ImportErrorCode, message: string): ImportFailure {
  return { ok: false, error: { code, message } };
}

/** Run an importer body so nothing — not even an internal bug — escapes as a throw. */
export function guard<R>(body: () => R): R | ImportFailure {
  try {
    return body();
  } catch (e) {
    return abortToFailure(e);
  }
}

export function abortToFailure(e: unknown): ImportFailure {
  if (e instanceof ImportAbort) return failure(e.code, e.message);
  if (e instanceof RangeError && /call stack|Maximum/i.test(e.message)) return failure('too_complex', 'This file is too complex to import.');
  return failure('malformed', 'This file looks damaged or uses a layout the importer does not understand.');
}

export function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/** Decode text with BOM detection; invalid bytes become U+FFFD rather than throwing. */
export function decodeText(bytes: Uint8Array): string {
  try {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    const start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    return new TextDecoder('utf-8').decode(bytes.subarray(start));
  } catch {
    return '';
  }
}

/** Trim, drop control characters, collapse spaces and cap the length of a label/title. */
export function cleanLabel(text: string | null | undefined, max = 120): string | null {
  if (text == null) return null;
  // eslint-disable-next-line no-control-regex
  const t = text.replace(/[\u0000-\u001f\u007f�]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

export function checkTextInput(text: unknown): string {
  if (typeof text !== 'string') throw new ImportAbort('empty', 'There is no text to import.');
  if (text.length > MAX_TEXT_CHARS) throw new ImportAbort('too_large', 'This text is too long to import (limit about 1 MB).');
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!t.trim()) throw new ImportAbort('empty', 'There is no text to import.');
  return t;
}

/** Most notes sounding at once. */
export function maxPolyphony(notes: readonly { startTick: number; durationTicks: number }[]): number {
  const ev: [number, number][] = [];
  for (const n of notes) {
    ev.push([n.startTick, 1], [n.startTick + Math.max(1, n.durationTicks), -1]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let best = 0;
  for (const [, d] of ev) {
    cur += d;
    if (cur > best) best = cur;
  }
  return best;
}

export interface RepeatInfo {
  repeatStart?: boolean;
  /** Total number of times the section ending here is played (2 = once more). 0/undefined = no repeat sign. */
  repeatEndTimes?: number;
  /** Passes on which this bar is played (volta / alternate ending). Empty = every pass. */
  endings?: number[];
}

/**
 * Play order of bar indexes with repeats and alternate endings expanded.
 * A repeat end without a start goes back to the song start or the bar after the previous
 * completed repeat. Output is capped at `maxBars` (the second value reports truncation).
 */
export function expandRepeats(bars: readonly RepeatInfo[], maxBars = MAX_EXPANDED_BARS): { order: number[]; truncated: boolean } {
  const order: number[] = [];
  let startIdx = 0;
  let pass = 1;
  let i = 0;
  let jumped = false;
  let guardSteps = 0;
  while (i < bars.length) {
    if (++guardSteps > maxBars * 4) return { order, truncated: true };
    const bar = bars[i]!;
    if (bar.repeatStart && !jumped) {
      startIdx = i;
      pass = 1;
    }
    jumped = false;
    const endings = bar.endings ?? [];
    if (endings.length && !endings.includes(pass)) {
      i++;
      continue;
    }
    if (order.length >= maxBars) return { order, truncated: true };
    order.push(i);
    const times = Math.min(MAX_REPEAT_TIMES, Math.max(0, Math.floor(bar.repeatEndTimes ?? 0)));
    if (times > 1 && pass < times) {
      pass++;
      i = startIdx;
      jumped = true;
      continue;
    }
    if (times > 1) {
      pass = 1;
      startIdx = i + 1;
    } else if (endings.length) {
      const next = bars[i + 1];
      if (!next || !(next.endings ?? []).length) {
        if (pass >= Math.max(...endings)) {
          pass = 1;
          startIdx = i + 1;
        }
      }
    }
    i++;
  }
  return { order, truncated: false };
}

export interface SongDraft {
  source: ImportedSong['source'];
  title: string | null;
  artist: string | null;
  bpm: number;
  beatsPerBar: number;
  beatUnit: number;
  notes: ImportedNote[];
  chords: ImportedChord[];
  sections: { startTick: number; name: string }[];
  tuning: ImportedTuning;
  capo: number;
  warnings: string[];
  /** Minimum length (e.g. trailing rests); the result is rounded up to whole bars. */
  minDurationTicks?: number;
}

/**
 * Sort, clamp and tidy a draft into an ImportedSong. Chords with no duration last until
 * the next chord (or the song end). Duplicate warnings are removed.
 */
export function finalizeSong(d: SongDraft): ImportOutcome {
  if (d.notes.length > MAX_NOTES) return failure('too_complex', `This song has more than ${MAX_NOTES.toLocaleString('en')} notes, which is too many to import.`);
  const beatsPerBar = isValidMeter(d.beatsPerBar, d.beatUnit) ? d.beatsPerBar : 4;
  const beatUnit = isValidMeter(d.beatsPerBar, d.beatUnit) ? d.beatUnit : 4;
  const bpm = Number.isFinite(d.bpm) && d.bpm >= 20 && d.bpm <= 400 ? Math.round(d.bpm * 100) / 100 : DEFAULT_BPM;
  const warnings = [...d.warnings];
  if (bpm !== d.bpm && !(Math.abs(bpm - d.bpm) < 0.01)) warnings.push(`The tempo in the file (${Math.round(d.bpm)} BPM) is unusual, so ${bpm} BPM is used instead.`);
  const notes = d.notes
    .filter((n) => Number.isFinite(n.startTick) && Number.isFinite(n.midi) && n.startTick >= 0 && n.midi >= 0 && n.midi <= 127)
    .map((n) => ({ ...n, startTick: Math.round(n.startTick), durationTicks: Math.max(1, Math.round(n.durationTicks)) }))
    .sort((a, b) => a.startTick - b.startTick || a.midi - b.midi || (a.string ?? 0) - (b.string ?? 0));
  for (const n of notes) {
    if (n.techniques && n.techniques.length === 0) delete n.techniques;
  }
  const sections = d.sections
    .map((s) => ({ startTick: Math.max(0, Math.round(s.startTick)), name: cleanLabel(s.name, 60) ?? '' }))
    .filter((s) => s.name)
    .sort((a, b) => a.startTick - b.startTick)
    .filter((s, i, arr) => i === 0 || !(arr[i - 1]!.startTick === s.startTick && arr[i - 1]!.name === s.name));
  const chordsSorted = d.chords
    .filter((c) => Number.isFinite(c.startTick) && c.startTick >= 0 && c.name)
    .map((c) => ({ ...c, startTick: Math.round(c.startTick), durationTicks: Math.round(c.durationTicks) }))
    .sort((a, b) => a.startTick - b.startTick);
  if (chordsSorted.length > MAX_CHORDS) return failure('too_complex', 'This song has too many chords to import.');
  let end = Math.max(0, d.minDurationTicks ?? 0);
  for (const n of notes) end = Math.max(end, n.startTick + n.durationTicks);
  for (const c of chordsSorted) end = Math.max(end, c.startTick + Math.max(0, c.durationTicks));
  const bar = ticksPerBar(beatsPerBar, beatUnit);
  const chordFloor = chordsSorted.length ? chordsSorted[chordsSorted.length - 1]!.startTick + bar : 0;
  end = Math.max(end, chordFloor);
  const durationTicks = Math.max(bar, Math.ceil(end / bar) * bar);
  const chords = chordsSorted.map((c, i) => {
    const next = chordsSorted[i + 1];
    const limit = (next ? next.startTick : durationTicks) - c.startTick;
    const dur = c.durationTicks > 0 ? Math.min(c.durationTicks, Math.max(1, limit)) : Math.max(1, limit);
    return { ...c, durationTicks: dur };
  });
  const tuningNote = tuningWarning(d.tuning);
  if (tuningNote) warnings.unshift(tuningNote);
  const capoNote = capoWarning(d.capo);
  if (capoNote) warnings.unshift(capoNote);
  return {
    ok: true,
    song: {
      source: d.source,
      title: cleanLabel(d.title, 200),
      artist: cleanLabel(d.artist, 200),
      ppq: IMPORT_PPQ,
      bpm,
      beatsPerBar,
      beatUnit,
      durationTicks,
      notes,
      chords,
      sections,
      tuning: d.tuning,
      capo: Math.max(0, Math.min(24, Math.round(d.capo))),
      warnings: [...new Set(warnings)].slice(0, 40),
    },
  };
}

/** "bar 17" for a tick (1-based) in a constant meter. */
export function barLabel(tick: number, beatsPerBar: number, beatUnit: number): string {
  return `bar ${Math.floor(tick / ticksPerBar(beatsPerBar, beatUnit)) + 1}`;
}

/** Plain-English list for warnings: "a, b and c". */
export function listText(items: readonly string[], max = 4): string {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const parts = extra > 0 ? [...shown, `${extra} more`] : shown;
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Warn about notes no six-string guitar in this tuning/capo can reach (frets 0–24). */
export function rangeWarnings(notes: readonly ImportedNote[], tuning: ImportedTuning, capo: number): string[] {
  const low = Math.min(...tuning.openMidiByString) + capo;
  const high = Math.max(...tuning.openMidiByString) + 24;
  let below = 0;
  let above = 0;
  for (const n of notes) {
    if (n.techniques?.some((t) => t.kind === 'harmonic' || t.kind === 'dead_note')) continue;
    if (n.midi < low) below++;
    else if (n.midi > high) above++;
  }
  const out: string[] = [];
  if (below) out.push(`${below} note${below === 1 ? ' is' : 's are'} lower than the lowest open string, so they can't be played as written.`);
  if (above) out.push(`${above} note${above === 1 ? ' is' : 's are'} higher than fret 24, so they can't be played as written.`);
  return out;
}
