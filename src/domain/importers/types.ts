/**
 * Output of every song importer (MIDI, ASCII tab, chord sheet, MusicXML, Guitar Pro).
 *
 * This is an intermediate, source-faithful form — not a `gu-score/1` Score. Notes may
 * overlap (polyphony is allowed here); a later step picks a part, plans fingerings and
 * builds the canonical score.
 *
 * Conventions
 * - Time is in ticks at 960 per quarter note (`ppq`), starting at 0.
 * - `midi` is the SOUNDING pitch, including the capo and any harmonic.
 * - `string` uses the app numbering: 1 = high E (thinnest) … 6 = low E (thickest).
 * - `fret` is counted from the capo (what the player reads in a tab): with `capo: 2`,
 *   fret 0 is the string stopped by the capo. Sounding pitch = open string + capo + fret.
 * - `tuning.openMidiByString[0]` is string 1 (high E) and excludes the capo.
 *
 * Technique semantics (`techniques` on a note)
 * - `hammer_on` / `pull_off`: this note is sounded by hammering on / pulling off from the
 *   previous note on the same string — it is not picked.
 * - `slide_up` / `slide_down`: this note is reached by sliding from the previous note on the
 *   same string — it is not picked.
 * - `slide_into`: this note is slid into from an unspecified fret (no origin note).
 * - `bend` (with `semitones` when known) and `release`: this note is bent up / released.
 * - `vibrato`, `palm_mute`, `harmonic`, `let_ring`, `tap`: apply to this note.
 * - `dead_note`: a muted, percussive "x" — it has no real pitch. `midi` is only nominal
 *   (open string or the written fret); never assess pitch for a dead note.
 */

export type TechniqueKind =
  | 'bend'
  | 'release'
  | 'slide_up'
  | 'slide_down'
  | 'slide_into'
  | 'hammer_on'
  | 'pull_off'
  | 'vibrato'
  | 'palm_mute'
  | 'harmonic'
  | 'dead_note'
  | 'let_ring'
  | 'tap';

export type Technique = { kind: TechniqueKind; semitones?: number };

export type ImportStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface ImportedNote {
  startTick: number;
  durationTicks: number;
  midi: number;
  string?: ImportStringNumber;
  fret?: number;
  velocity?: number;
  techniques?: Technique[];
}

export interface ImportedChord {
  startTick: number;
  durationTicks: number;
  name: string;
  /** index 0 = string 1 (high E) … index 5 = string 6; null = not played. Frets count from the capo. */
  fretsByString?: (number | null)[];
}

export type ImportSource = 'midi' | 'tab' | 'chord_sheet' | 'musicxml' | 'guitar_pro';

export interface ImportedTuning {
  name: string;
  /** index 0 = string 1 (high E). Capo not included. */
  openMidiByString: number[];
  standard: boolean;
}

export interface ImportedSong {
  source: ImportSource;
  title: string | null;
  artist: string | null;
  ppq: 960;
  bpm: number;
  beatsPerBar: number;
  beatUnit: number;
  durationTicks: number;
  /** May overlap (polyphony allowed here). Sorted by startTick, then pitch. */
  notes: ImportedNote[];
  /** Chord symbols / shapes over time, sorted by startTick. */
  chords: ImportedChord[];
  sections: { startTick: number; name: string }[];
  tuning: ImportedTuning;
  capo: number;
  /** Plain English for a beginner. */
  warnings: string[];
}

export type ImportErrorCode =
  | 'empty'
  | 'too_large'
  | 'too_complex'
  | 'not_midi'
  | 'not_musicxml'
  | 'not_guitar_pro'
  | 'compressed_musicxml'
  | 'unsupported_format'
  | 'malformed'
  | 'no_notes'
  | 'no_tab'
  | 'no_chords'
  | 'bad_selection'
  | 'importer_unavailable';

export interface ImportError {
  code: ImportErrorCode;
  /** Plain English, safe to show to the learner. */
  message: string;
}

export type ImportFailure = { ok: false; error: ImportError };
export type ImportOutcome = { ok: true; song: ImportedSong } | ImportFailure;

/** One selectable part (track/channel/instrument) inside a multi-part file. */
export interface ImportPartInfo {
  /** Pass this to the importer's `trackIndexes` / `partIndexes`. */
  index: number;
  name: string;
  noteCount: number;
  lowMidi: number | null;
  highMidi: number | null;
  /** Most notes sounding at the same moment. */
  maxPolyphony: number;
  guitarLikely: boolean;
}
