/**
 * Song import entry point: sniff the format and run the matching importer.
 * Every function here resolves to a result object; none of them throws or rejects.
 */
import { asciiTabToSong, countTabStaves, type TabOptions } from './asciiTab';
import { chordSheetToSong, isChordLine, looksLikeChordPro } from './chordSheet';
import { abortToFailure, decodeText, failure, toBytes } from './common';
import { detectGuitarPro, guitarProToSong } from './guitarPro';
import { midiToSong } from './midi';
import { musicXmlToSong } from './musicxml';
import type { ImportOutcome, ImportSource } from './types';

export * from './types';
export { asciiTabToSong, countTabStaves, parseStringLine, type TabOptions } from './asciiTab';
export { chordSheetToSong, isChordLine, looksLikeChordPro, type ChordSheetOptions } from './chordSheet';
export { describeTuning, expandRepeats, STANDARD_OPEN_BY_STRING } from './common';
export { detectGuitarPro, guitarProToSong, inspectGuitarPro, type GuitarProInspection, type GuitarProTrackInfo } from './guitarPro';
export { defaultMidiSelection, GM_PROGRAMS, inspectMidi, midiToSong, type MidiInspection, type MidiTrackInfo } from './midi';
export { inspectMusicXml, musicXmlToSong, type MusicXmlInspection, type MusicXmlPartInfo } from './musicxml';

export type DetectedFormat = ImportSource | 'mxl' | 'unknown';

const EXT: Record<string, DetectedFormat> = {
  mid: 'midi', midi: 'midi', kar: 'midi', rmi: 'midi', smf: 'midi',
  xml: 'musicxml', musicxml: 'musicxml', mxl: 'mxl',
  gp3: 'guitar_pro', gp4: 'guitar_pro', gp5: 'guitar_pro', gpx: 'guitar_pro', gp: 'guitar_pro',
  cho: 'chord_sheet', chopro: 'chord_sheet', chordpro: 'chord_sheet', crd: 'chord_sheet', pro: 'chord_sheet',
};

function extOf(fileName: string | undefined): DetectedFormat | null {
  const m = fileName ? /\.([a-z0-9]{1,10})$/i.exec(fileName.trim()) : null;
  return m ? EXT[m[1]!.toLowerCase()] ?? null : null;
}

function textFormat(text: string): DetectedFormat {
  const head = text.replace(/^﻿/, '').trimStart();
  if (head.startsWith('<') && /<score-(partwise|timewise)[\s>]/.test(head.slice(0, 4096))) return 'musicxml';
  if (countTabStaves(text) > 0) return 'tab';
  if (looksLikeChordPro(text)) return 'chord_sheet';
  const lines = text.split(/\r?\n/);
  if (lines.some((l) => isChordLine(l))) return 'chord_sheet';
  return 'unknown';
}

/** Guess the format from content first, then from the file name. */
export function detectImportFormat(input: string | Uint8Array | ArrayBuffer, fileName?: string): DetectedFormat {
  try {
    if (typeof input === 'string') return textFormat(input);
    const b = toBytes(input);
    if (b.length >= 4) {
      const magic = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!);
      if (magic === 'MThd' || (magic === 'RIFF' && b.length >= 12 && String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === 'RMID')) return 'midi';
      if (detectGuitarPro(b)) return 'guitar_pro';
      if (magic === 'PK\u0003\u0004') return extOf(fileName) === 'guitar_pro' ? 'guitar_pro' : 'mxl';
    }
    const byName = extOf(fileName);
    if (byName === 'midi' || byName === 'guitar_pro') return byName;
    if (b.length > 0 && b.subarray(0, Math.min(b.length, 2048)).filter((x) => x === 0).length > 2) return 'unknown';
    const t = textFormat(decodeText(b.length > 2_000_000 ? b.subarray(0, 2_000_000) : b));
    return t === 'unknown' && byName ? byName : t;
  } catch {
    return 'unknown';
  }
}

export interface ImportOptions extends TabOptions {
  /** Original file name, used as a hint (e.g. ".gp5"). */
  fileName?: string;
  /** Skip detection and use this importer. */
  format?: ImportSource;
  /** MIDI tracks / MusicXML parts / Guitar Pro tracks to import (default: the suggested one). */
  trackIndexes?: number[];
}

/**
 * Import any supported song file or pasted text. Resolves to `{ ok: true, song }` or
 * `{ ok: false, error }` with a plain-English message; never rejects.
 */
export async function importSong(input: string | Uint8Array | ArrayBuffer, options: ImportOptions = {}): Promise<ImportOutcome> {
  try {
    const format = options.format ?? detectImportFormat(input, options.fileName);
    const asText = () => (typeof input === 'string' ? input : decodeText(toBytes(input)));
    const asBytes = () => (typeof input === 'string' ? new TextEncoder().encode(input) : toBytes(input));
    const { bpm, beatsPerBar, beatUnit } = options;
    switch (format) {
      case 'midi':
        return midiToSong(asBytes(), options.trackIndexes);
      case 'guitar_pro':
        return await guitarProToSong(asBytes(), options.trackIndexes);
      case 'musicxml':
        return musicXmlToSong(typeof input === 'string' ? input : toBytes(input), options.trackIndexes);
      case 'mxl':
        return failure('compressed_musicxml', 'This is a compressed MusicXML file (.mxl). Export it again as uncompressed MusicXML (.musicxml or .xml) and import that.');
      case 'tab':
        return asciiTabToSong(asText(), { bpm, beatsPerBar, beatUnit });
      case 'chord_sheet':
        return chordSheetToSong(asText(), { bpm, beatsPerBar, beatUnit });
      default:
        return failure(
          'unsupported_format',
          "This file type isn't supported. You can import MIDI (.mid), Guitar Pro (.gp3 to .gp), MusicXML (.musicxml), or paste guitar tab or a chord sheet.",
        );
    }
  } catch (e) {
    return abortToFailure(e);
  }
}
