/**
 * Chord names, chord tones, a guitar voicing library and capo suggestions.
 *
 * Strings follow the app numbering everywhere: `fretsByString[0]` is string 1 (high E,
 * MIDI 64) … `fretsByString[5]` is string 6 (low E, MIDI 40); null = string not played.
 * Frets are counted from the capo. Simplifications only ever drop chord tones (maj7 → maj,
 * 9 → 7, add9 → maj …); they never move the root, so an easy version stays in the same key.
 */
import { fretToMidi, STRING_NUMBERS } from './tuning';

export type ChordQuality =
  | 'maj' | 'min' | '7' | 'maj7' | 'min7' | 'sus2' | 'sus4' | 'dim' | 'aug' | '5' | '6' | 'min6' | '9' | 'add9' | 'dim7' | 'm7b5' | '7sus4';

export interface ParsedChord {
  /** Pitch class 0..11 (0 = C). */
  root: number;
  quality: ChordQuality;
  /** Pitch class of a slash bass ("C/G" → 7), or null. */
  bass: number | null;
  /** Canonical name, e.g. "Bbm7", "F#m7b5", "C/G". Keeps the input's sharp/flat spelling. */
  display: string;
  /** Set when the written chord had extra/altered notes that were left out (e.g. "D7#9" → D7). */
  note?: string;
}

export const QUALITIES: readonly ChordQuality[] = ['maj', 'min', '7', 'maj7', 'min7', 'sus2', 'sus4', 'dim', 'aug', '5', '6', 'min6', '9', 'add9', 'dim7', 'm7b5', '7sus4'];

/** Display suffix for each quality. */
export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: 'm', '7': '7', maj7: 'maj7', min7: 'm7', sus2: 'sus2', sus4: 'sus4', dim: 'dim', aug: 'aug', '5': '5',
  '6': '6', min6: 'm6', '9': '9', add9: 'add9', dim7: 'dim7', m7b5: 'm7b5', '7sus4': '7sus4',
};

/** Semitones above the root. */
export const QUALITY_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7],
  dim: [0, 3, 6], aug: [0, 4, 8], '5': [0, 7], '6': [0, 4, 7, 9], min6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 2], add9: [0, 4, 7, 2],
  dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], '7sus4': [0, 5, 7, 10],
};

/** The chord's third (semitones), or null for power and suspended chords. */
export function thirdInterval(q: ChordQuality): number | null {
  if (q === '5' || q === 'sus2' || q === 'sus4' || q === '7sus4') return null;
  return QUALITY_INTERVALS[q].includes(3) ? 3 : 4;
}

// ---------------------------------------------------------------------------------------
// Note names

const SHARP_PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
/** Spelling guitarists usually see: sharps except B♭, E♭, A♭. */
const GUITAR_PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function pcName(pc: number, spelling: 'sharp' | 'guitar' = 'guitar'): string {
  return (spelling === 'sharp' ? SHARP_PC : GUITAR_PC)[mod12(pc)]!;
}

/** "C", "c#", "Db", "E♭", "Bb" → pitch class; null when not a note name. */
export function noteNamePc(text: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]?)$/.exec(text.trim());
  if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]!.toLowerCase() as 'c'];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return mod12(base + acc);
}

// ---------------------------------------------------------------------------------------
// Parsing

type SuffixEntry = [ChordQuality, string?];

const SUFFIXES: Record<string, SuffixEntry> = {};
function suffix(quality: ChordQuality, names: string[], note?: string): void {
  for (const n of names) SUFFIXES[n] = note ? [quality, note] : [quality];
}
suffix('maj', ['', 'M', 'maj', 'Maj', 'major', 'Major']);
suffix('min', ['m', 'min', 'mi', '-', 'minor', 'Min']);
suffix('7', ['7', 'dom7', 'dom']);
suffix('maj7', ['maj7', 'M7', 'Maj7', 'ma7', 'Ma7', 'j7', 'Δ', 'Δ7', 'major7']);
suffix('min7', ['m7', 'min7', 'mi7', '-7', 'Min7']);
suffix('sus2', ['sus2', '2'], undefined);
suffix('sus4', ['sus4', 'sus', '4']);
suffix('dim', ['dim', '°', 'o', 'dim5', 'mb5', 'm(b5)', 'mb5']);
suffix('aug', ['aug', '+', '+5', '#5', 'aug5', '(#5)']);
suffix('5', ['5', 'no3', '(no3)']);
suffix('6', ['6', 'maj6', 'M6', 'add6']);
suffix('min6', ['m6', 'min6', '-6', 'mi6']);
suffix('9', ['9', 'dom9']);
suffix('add9', ['add9', 'add2', '(add9)', '(add2)']);
suffix('dim7', ['dim7', '°7', 'o7']);
suffix('m7b5', ['m7b5', 'm7-5', 'ø', 'ø7', 'min7b5', '-7b5', 'mi7b5', 'm7(b5)', 'm7(-5)']);
suffix('7sus4', ['7sus4', '7sus', 'sus7', '7(sus4)']);
// Close relatives: played as the nearest supported quality, with a note.
suffix('7', ['7#9', '7b9', '7(#9)', '7(b9)', '7#5', '7b5', '7(#5)', '7(b5)', '7#11', '7(#11)', '7b13', '7alt', 'alt', '7#9#5', '7b9b13', '7#9b13', '13', 'dom13', '7(13)', '+7', '7+', 'aug7'], 'Extra or altered notes were left out.');
suffix('7sus4', ['11', '9sus4', '9sus', '7sus2'], 'Played as a 7sus4 chord.');
suffix('maj7', ['maj9', 'M9', 'Δ9', 'maj11', 'maj13', 'maj7#11', 'M7#11', 'maj7(#11)'], 'Extra notes were left out.');
suffix('min7', ['m9', 'min9', 'mi9', '-9', 'm11', 'min11', '-11', 'm13', 'm7b9', 'm7(9)', 'm7add11'], 'Extra notes were left out.');
suffix('min', ['madd9', 'm(add9)', 'madd2', 'm(add2)', 'madd11', 'm(maj7)', 'mmaj7', 'mMaj7', 'mM7', 'minmaj7', 'm(M7)', '-Δ7', 'mΔ7'], 'Extra notes were left out.');
suffix('maj', ['add11', 'add4', '(add11)', '(add4)'], 'The added note was left out.');
suffix('6', ['6/9', '69', '6add9', '6(add9)'], 'The added 9th was left out.');
suffix('sus4', ['sus2sus4', 'sus24', 'sus42'], 'Played as a sus4 chord.');

/**
 * Parse a chord symbol. Strict about the root (capital A–G) so ordinary words don't read
 * as chords. Handles sharps/flats (#, b, ♯, ♭), `Cmaj7`, `CΔ7`, `Am7`, `C/G`, `Bb`,
 * `F#m7b5`, `E5`, `Asus4`, and treats `D7#9` as D7 with a note.
 */
export function parseChordName(text: string): ParsedChord | null {
  if (typeof text !== 'string') return null;
  let t = text.trim();
  if (!t || t.length > 24) return null;
  if (t.startsWith('(') && t.endsWith(')') && t.length > 2) t = t.slice(1, -1).trim();
  t = t.replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = /^([A-G])([#b]?)(.*)$/.exec(t);
  if (!m) return null;
  const rootName = m[1]! + m[2]!;
  const root = noteNamePc(rootName);
  if (root === null) return null;
  let rest = m[3]!;
  let bass: number | null = null;
  let bassName: string | null = null;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0) {
    const b = /^([A-G])([#b]?)$/.exec(rest.slice(slash + 1));
    if (b) {
      bassName = b[1]! + b[2]!;
      bass = noteNamePc(bassName);
      rest = rest.slice(0, slash);
    } else if (!SUFFIXES[rest.replace(/\s+/g, '')]) {
      return null;
    }
  }
  const key = rest.replace(/\s+/g, '');
  const entry = SUFFIXES[key] ?? SUFFIXES[key.replace(/[()]/g, '')];
  if (!entry) return null;
  const [quality, note] = entry;
  if (bass === root) {
    bass = null;
    bassName = null;
  }
  const display = `${rootName}${QUALITY_SUFFIX[quality]}${bassName ? `/${bassName}` : ''}`;
  return note ? { root, quality, bass, display, note } : { root, quality, bass, display };
}

/** Name for a root/quality/bass using guitar spelling (C C# D Eb E F F# G Ab A Bb B). */
export function chordDisplay(root: number, quality: ChordQuality, bass: number | null = null): string {
  return `${pcName(root)}${QUALITY_SUFFIX[quality]}${bass !== null && mod12(bass) !== mod12(root) ? `/${pcName(bass)}` : ''}`;
}

/** Chord tones as pitch classes, root first; a slash bass is included. */
export function chordTones(chord: Pick<ParsedChord, 'root' | 'quality' | 'bass'>): number[] {
  const pcs = QUALITY_INTERVALS[chord.quality].map((i) => mod12(chord.root + i));
  if (chord.bass !== null && !pcs.includes(mod12(chord.bass))) pcs.push(mod12(chord.bass));
  return pcs;
}

/** Move a chord by semitones (root and bass together). The note, if any, is kept. */
export function transposeChord(chord: ParsedChord, semitones: number): ParsedChord {
  const root = mod12(chord.root + semitones);
  const bass = chord.bass === null ? null : mod12(chord.bass + semitones);
  const out: ParsedChord = { root, quality: chord.quality, bass, display: chordDisplay(root, chord.quality, bass) };
  if (chord.note) out.note = chord.note;
  return out;
}

// ---------------------------------------------------------------------------------------
// Voicing library

export type FingerMark = null | 0 | 1 | 2 | 3 | 4 | 'T';

export interface Voicing {
  id: string;
  /** Chord name this voicing plays, e.g. "C", "Bbm", "D/F#". */
  name: string;
  root: number;
  quality: ChordQuality;
  bass: number | null;
  /** index 0 = string 1 (high E) … 5 = string 6; null = not played. */
  fretsByString: (number | null)[];
  /** index 0 = string 1; null = not played, 0 = open, 1–4 = index…little finger, 'T' = thumb. */
  fingers: FingerMark[];
  /** 1 = Em / E5 easy … 5 = hard barre or stretch. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  shape: 'open' | 'e_shape' | 'a_shape' | 'power' | 'movable' | 'slash';
  barre?: { fret: number; fromString: number; toString: number };
  description: string;
}

type Diff = Voicing['difficulty'];

/** Parse "x32010" (low E → high E, as chord charts are written) into fretsByString (index 0 = string 1). */
function lowToHigh(frets: string): (number | null)[] {
  return [...frets].reverse().map((c) => (c === 'x' ? null : Number(c)));
}
function fingersLowToHigh(f: string): FingerMark[] {
  return [...f].reverse().map((c) => (c === 'x' ? null : c === 'T' ? 'T' : (Number(c) as FingerMark)));
}

function detectBarre(frets: (number | null)[], fingers: FingerMark[]): Voicing['barre'] {
  const byFinger = new Map<FingerMark, number[]>();
  fingers.forEach((f, i) => {
    if (typeof f === 'number' && f > 0) byFinger.set(f, [...(byFinger.get(f) ?? []), i]);
  });
  for (const [, idx] of byFinger) {
    if (idx.length < 2) continue;
    const fret = frets[idx[0]!];
    if (fret == null || !idx.every((i) => frets[i] === fret)) continue;
    return { fret, fromString: Math.max(...idx) + 1, toString: Math.min(...idx) + 1 };
  }
  return undefined;
}

function makeVoicing(
  name: string, frets: (number | null)[], fingers: FingerMark[], difficulty: Diff, shape: Voicing['shape'], description: string, id?: string,
): Voicing | null {
  const parsed = parseChordName(name);
  if (!parsed) return null;
  const barre = detectBarre(frets, fingers);
  const v: Voicing = {
    id: id ?? `${parsed.display}:${frets.map((f) => (f === null ? 'x' : f)).reverse().join('.')}`,
    name: chordDisplay(parsed.root, parsed.quality, parsed.bass),
    root: parsed.root,
    quality: parsed.quality,
    bass: parsed.bass,
    fretsByString: frets,
    fingers,
    difficulty,
    shape,
    description,
  };
  if (barre) v.barre = barre;
  return v;
}

/** [name, frets low→high, fingers low→high, difficulty] */
const OPEN_SHAPES: [string, string, string, Diff][] = [
  ['C', 'x32010', 'x32010', 2], ['A', 'x02220', 'x01230', 2], ['G', '320003', '210003', 2], ['G', '320033', '210034', 3],
  ['E', '022100', '023100', 2], ['D', 'xx0232', 'xx0132', 2], ['F', 'xx3211', 'xx3211', 3], ['F', '133211', '134211', 5],
  ['Am', 'x02210', 'x02310', 2], ['Em', '022000', '023000', 1], ['Dm', 'xx0231', 'xx0231', 2],
  ['E7', '020100', '020100', 1], ['A7', 'x02020', 'x02030', 1], ['D7', 'xx0212', 'xx0213', 2], ['G7', '320001', '320001', 2],
  ['C7', 'x32310', 'x32410', 3], ['B7', 'x21202', 'x21304', 3],
  ['Am7', 'x02010', 'x02010', 1], ['Em7', '020000', '020000', 1], ['Dm7', 'xx0211', 'xx0211', 2],
  ['Cmaj7', 'x32000', 'x32000', 1], ['Fmaj7', 'xx3210', 'xx3210', 2], ['Amaj7', 'x02120', 'x02130', 2], ['Dmaj7', 'xx0222', 'xx0111', 2],
  ['Gmaj7', '320002', '320001', 2],
  ['Asus2', 'x02200', 'x01200', 1], ['Asus4', 'x02230', 'x01230', 2], ['Dsus2', 'xx0230', 'xx0130', 1], ['Dsus4', 'xx0233', 'xx0134', 2],
  ['Esus4', '022200', '023400', 2], ['Cadd9', 'x32030', 'x21030', 2], ['Eadd9', '024100', '024100', 2], ['Aadd9', 'x02420', 'x01420', 3],
  ['E5', '022xxx', '012xxx', 1], ['A5', 'x022xx', 'x012xx', 1], ['D5', 'xx023x', 'xx013x', 1],
  ['Bdim', 'x2343x', 'x1243x', 3], ['Ddim7', 'xx0101', 'xx0102', 2], ['Caug', 'x32110', 'x43120', 3], ['Eaug', '032110', '043120', 3],
  ['C6', 'x32210', 'x42310', 3], ['A6', 'x02222', 'x01111', 2], ['D6', 'xx0202', 'xx0203', 2], ['E6', '022120', '023140', 3], ['G6', '320000', '320000', 1],
  ['Am6', 'x02212', 'x02314', 3], ['Dm6', 'xx0201', 'xx0201', 2], ['Em6', '022020', '012030', 2],
  ['E9', '020102', '020103', 2], ['A7sus4', 'x02030', 'x02030', 1], ['D7sus4', 'xx0213', 'xx0213', 2], ['E7sus4', '020200', '020300', 1],
];

/** Common slash-chord voicings: [name, frets low→high, fingers low→high, difficulty]. */
const SLASH_SHAPES: [string, string, string, Diff][] = [
  ['C/G', '332010', '342010', 3], ['C/E', '032010', '032010', 2], ['D/F#', '2x0232', 'Tx0132', 4], ['G/B', 'x20003', 'x10003', 2],
  ['Am/G', '3x2210', '4x2310', 3], ['F/C', 'x33211', 'x34211', 4], ['D/A', 'x00232', 'x00132', 2], ['A/E', '002220', '001230', 2],
  ['C/B', 'x22010', 'x23010', 2], ['G/F#', '2x0003', '1x0003', 3], ['Am/F#', '2x2210', '1x3420', 3], ['Em/D', 'xx0000', 'xx0000', 1],
];

interface MovableShape {
  quality: ChordQuality;
  /** Root string (6 = E shape, 5 = A shape, 4 = D shape). */
  rootString: 4 | 5 | 6;
  /** Offsets from the root fret, low E → high E; null = not played. */
  offsets: (number | null)[];
  /** Fingers low E → high E. */
  fingers: FingerMark[];
  difficulty: Diff;
  shape: Voicing['shape'];
  label: string;
  minRootFret?: number;
  /** Harder at fret 1 (full barre right by the nut). */
  hardAtFirstFret?: boolean;
}

const MOVABLE: MovableShape[] = [
  { quality: 'maj', rootString: 6, offsets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], difficulty: 4, shape: 'e_shape', label: 'E-shape barre', hardAtFirstFret: true },
  { quality: 'min', rootString: 6, offsets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], difficulty: 4, shape: 'e_shape', label: 'E-shape barre', hardAtFirstFret: true },
  { quality: '7', rootString: 6, offsets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], difficulty: 4, shape: 'e_shape', label: 'E-shape barre', hardAtFirstFret: true },
  { quality: 'min7', rootString: 6, offsets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], difficulty: 4, shape: 'e_shape', label: 'E-shape barre', hardAtFirstFret: true },
  { quality: 'maj7', rootString: 6, offsets: [0, null, 1, 1, 0, null], fingers: [1, null, 3, 4, 2, null], difficulty: 3, shape: 'movable', label: 'four-string shape, root on string 6' },
  { quality: '5', rootString: 6, offsets: [0, 2, 2, null, null, null], fingers: [1, 3, 4, null, null, null], difficulty: 2, shape: 'power', label: 'power chord, root on string 6' },
  { quality: 'maj', rootString: 5, offsets: [null, 0, 2, 2, 2, 0], fingers: [null, 1, 2, 3, 4, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'min', rootString: 5, offsets: [null, 0, 2, 2, 1, 0], fingers: [null, 1, 3, 4, 2, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: '7', rootString: 5, offsets: [null, 0, 2, 0, 2, 0], fingers: [null, 1, 3, 1, 4, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'min7', rootString: 5, offsets: [null, 0, 2, 0, 1, 0], fingers: [null, 1, 3, 1, 2, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'maj7', rootString: 5, offsets: [null, 0, 2, 1, 2, 0], fingers: [null, 1, 3, 2, 4, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'sus2', rootString: 5, offsets: [null, 0, 2, 2, 0, 0], fingers: [null, 1, 3, 4, 1, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'sus4', rootString: 5, offsets: [null, 0, 2, 2, 3, 0], fingers: [null, 1, 2, 3, 4, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: '7sus4', rootString: 5, offsets: [null, 0, 2, 0, 3, 0], fingers: [null, 1, 3, 1, 4, 1], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: '6', rootString: 5, offsets: [null, 0, 2, 2, 2, 2], fingers: [null, 1, 3, 3, 3, 3], difficulty: 4, shape: 'a_shape', label: 'A-shape barre', hardAtFirstFret: true },
  { quality: 'min6', rootString: 5, offsets: [null, 0, 2, 2, 1, 2], fingers: [null, 1, 3, 3, 2, 4], difficulty: 4, shape: 'a_shape', label: 'root on string 5' },
  { quality: 'add9', rootString: 5, offsets: [null, 0, 2, 4, 2, null], fingers: [null, 1, 2, 4, 3, null], difficulty: 4, shape: 'movable', label: 'stretch shape, root on string 5' },
  { quality: '9', rootString: 5, offsets: [null, 0, -1, 0, 0, 0], fingers: [null, 2, 1, 3, 3, 3], difficulty: 4, shape: 'movable', label: 'root on string 5', minRootFret: 2 },
  { quality: '5', rootString: 5, offsets: [null, 0, 2, 2, null, null], fingers: [null, 1, 3, 4, null, null], difficulty: 2, shape: 'power', label: 'power chord, root on string 5' },
  { quality: 'dim', rootString: 5, offsets: [null, 0, 1, 2, 1, null], fingers: [null, 1, 2, 4, 3, null], difficulty: 3, shape: 'movable', label: 'root on string 5' },
  { quality: 'm7b5', rootString: 5, offsets: [null, 0, 1, 0, 1, null], fingers: [null, 1, 3, 2, 4, null], difficulty: 3, shape: 'movable', label: 'root on string 5' },
  { quality: 'dim7', rootString: 5, offsets: [null, 0, 1, -1, 1, null], fingers: [null, 2, 3, 1, 4, null], difficulty: 3, shape: 'movable', label: 'root on string 5', minRootFret: 2 },
  { quality: 'aug', rootString: 5, offsets: [null, 0, -1, -2, -2, null], fingers: [null, 4, 3, 1, 2, null], difficulty: 3, shape: 'movable', label: 'root on string 5', minRootFret: 3 },
  { quality: 'aug', rootString: 4, offsets: [null, null, 0, -1, -1, -2], fingers: [null, null, 4, 2, 3, 1], difficulty: 3, shape: 'movable', label: 'root on string 4', minRootFret: 3 },
];

export const MAX_VOICING_FRET = 15;
const OPEN_BY_STRING_LOW_TO_HIGH: Record<4 | 5 | 6, number> = { 6: 40, 5: 45, 4: 50 };

function buildLibrary(): Voicing[] {
  const out: Voicing[] = [];
  const seen = new Set<string>();
  const add = (v: Voicing | null) => {
    if (!v) return;
    const key = `${v.root}|${v.quality}|${v.bass}|${v.fretsByString.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  };
  for (const [name, frets, fingers, d] of OPEN_SHAPES) {
    const fr = lowToHigh(frets);
    const label = d === 5 ? `Full barre ${name}` : fr.some((f) => f === 0) ? `Open ${name}` : `${name}`;
    add(makeVoicing(name, fr, fingersLowToHigh(fingers), d, name.endsWith('5') && !name.endsWith('b5') ? 'power' : 'open', label));
  }
  for (const [name, frets, fingers, d] of SLASH_SHAPES) add(makeVoicing(name, lowToHigh(frets), fingersLowToHigh(fingers), d, 'slash', `${name} (bass note first)`));
  for (const shape of MOVABLE) {
    for (let r = shape.minRootFret ?? 1; r <= 13; r++) {
      const fretsLowHigh = shape.offsets.map((o) => (o === null ? null : r + o));
      if (fretsLowHigh.some((f) => f !== null && (f < 0 || f > MAX_VOICING_FRET))) continue;
      const root = mod12(OPEN_BY_STRING_LOW_TO_HIGH[shape.rootString] + r);
      const name = chordDisplay(root, shape.quality);
      const d: Diff = shape.hardAtFirstFret && r === 1 ? 5 : shape.difficulty;
      add(makeVoicing(name, [...fretsLowHigh].reverse(), [...shape.fingers].reverse(), d, shape.shape, `${name} ${shape.label} at fret ${r}`));
    }
  }
  return out;
}

/** Every voicing in the library (open, slash and movable shapes up to fret 15). */
export const VOICINGS: readonly Voicing[] = buildLibrary();

/** Sounding MIDI per string (index 0 = string 1) in standard tuning, null = not played. */
export function voicingMidi(v: Pick<Voicing, 'fretsByString'>, capo = 0): (number | null)[] {
  return v.fretsByString.map((f, i) => (f === null ? null : fretToMidi(STRING_NUMBERS[i]!, f + capo)));
}

/** Lowest sounding MIDI note of a voicing. */
export function voicingBassMidi(v: Pick<Voicing, 'fretsByString'>, capo = 0): number | null {
  const ms = voicingMidi(v, capo).filter((m): m is number => m !== null);
  return ms.length ? Math.min(...ms) : null;
}

export interface VoicingQuery {
  /** Highest difficulty to return (default 5). */
  maxDifficulty?: number;
  /** Highest fret allowed (default 15). */
  maxFret?: number;
}

/** Slash variants of a root-position voicing: mute strings below the bass, or add the bass underneath. */
function deriveSlash(base: Voicing, bass: number): Voicing[] {
  const out: Voicing[] = [];
  const midi = voicingMidi(base);
  const third = thirdInterval(base.quality);
  const keeps = (frets: (number | null)[]) => {
    const pcs = new Set(frets.map((f, i) => (f === null ? null : mod12(fretToMidi(STRING_NUMBERS[i]!, f)))).filter((p): p is number => p !== null));
    const sounding = frets.filter((f) => f !== null).length;
    return sounding >= 3 && pcs.has(base.root) && (third === null || pcs.has(mod12(base.root + third)));
  };
  const name = chordDisplay(base.root, base.quality, bass);
  // (a) The bass is already in the voicing: mute every string below it.
  for (let i = 5; i >= 0; i--) {
    const m = midi[i];
    if (m == null || mod12(m) !== bass) continue;
    const frets = base.fretsByString.map((f, j) => (j > i ? null : f));
    const fingers = base.fingers.map((f, j) => (j > i ? null : f));
    if (frets.every((f, j) => f === base.fretsByString[j])) break;
    if (keeps(frets)) {
      const v = makeVoicing(name, frets, fingers, Math.min(5, base.difficulty) as Diff, 'slash', `${name} (${base.description}, lower strings muted)`, `${base.id}/mute${i + 1}`);
      if (v) out.push(v);
    }
    break;
  }
  // (b) Add the bass on a lower string with a free finger.
  const lowest = base.fretsByString.reduce<number>((acc, f, i) => (f !== null ? i : acc), -1);
  const fretted = base.fretsByString.filter((f): f is number => f !== null && f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 0;
  const used = new Set(base.fingers.filter((f) => typeof f === 'number' && f > 0));
  const sounding = midi.filter((m): m is number => m !== null);
  for (let s = lowest + 1; s <= 5; s++) {
    for (let f = 0; f <= MAX_VOICING_FRET; f++) {
      const m = fretToMidi(STRING_NUMBERS[s]!, f);
      if (mod12(m) !== bass || m >= Math.min(...sounding)) continue;
      if (f > 0 && fretted.length && (f < lo - 1 || f > lo + 3)) continue;
      if (f > 0 && !fretted.length && f > 4) continue;
      const free = ([1, 2, 3, 4] as const).find((k) => !used.has(k));
      if (f > 0 && free === undefined) continue;
      const frets = base.fretsByString.map((x, j) => (j === s ? f : j > lowest ? null : x));
      const fingers = base.fingers.map((x, j) => (j === s ? (f === 0 ? 0 : free!) : j > lowest ? null : x));
      const v = makeVoicing(name, frets, fingers, Math.min(5, base.difficulty + 1) as Diff, 'slash', `${name} (${base.description}, bass note added on string ${s + 1})`, `${base.id}/add${s + 1}@${f}`);
      if (v) out.push(v);
      break;
    }
  }
  // (c) Replace the lowest note with the bass on the same string (e.g. Bm x24432 → Bm/A x04432).
  if (lowest >= 0) {
    const others = midi.filter((m, j): m is number => m !== null && j !== lowest);
    for (let f = 0; f <= MAX_VOICING_FRET && others.length; f++) {
      const m = fretToMidi(STRING_NUMBERS[lowest]!, f);
      if (mod12(m) !== bass || m >= Math.min(...others)) continue;
      if (f > 0 && fretted.length && (f < lo - 1 || f > lo + 3)) continue;
      const frets = base.fretsByString.map((x, j) => (j === lowest ? f : x));
      if (!keeps(frets)) continue;
      const orig = base.fingers[lowest];
      const sharedElsewhere = base.fingers.some((x, j) => j !== lowest && x === orig);
      const free = ([1, 2, 3, 4] as const).find((k) => !used.has(k));
      const finger: FingerMark | undefined = f === 0 ? 0 : typeof orig === 'number' && orig > 0 && !sharedElsewhere ? orig : free;
      if (finger === undefined) continue;
      const fingers = base.fingers.map((x, j) => (j === lowest ? finger : x));
      const v = makeVoicing(name, frets, fingers, base.difficulty, 'slash', `${name} (${base.description}, bass note on string ${lowest + 1})`, `${base.id}/swap${lowest + 1}@${f}`);
      if (v) out.push(v);
      break;
    }
  }
  return out;
}

/**
 * Voicings for a chord, easiest first (then fuller, then lower on the neck). A slash chord only gets
 * voicings whose lowest sounding note is the requested bass; a plain chord only gets
 * root-position voicings from the library.
 */
export function voicingsFor(chord: Pick<ParsedChord, 'root' | 'quality' | 'bass'>, query: VoicingQuery = {}): Voicing[] {
  const maxDifficulty = query.maxDifficulty ?? 5;
  const maxFret = Math.min(query.maxFret ?? MAX_VOICING_FRET, MAX_VOICING_FRET);
  const root = mod12(chord.root);
  const bass = chord.bass === null || mod12(chord.bass) === root ? null : mod12(chord.bass);
  const base = VOICINGS.filter((v) => v.root === root && v.quality === chord.quality && v.bass === null);
  let list: Voicing[];
  if (bass === null) {
    list = base;
  } else {
    const exact = VOICINGS.filter((v) => v.root === root && v.quality === chord.quality && v.bass === bass);
    const derived = base.flatMap((v) => deriveSlash(v, bass));
    const ids = new Set<string>();
    list = [...exact, ...derived].filter((v) => {
      const key = v.fretsByString.join(',');
      if (ids.has(key)) return false;
      ids.add(key);
      const low = voicingBassMidi(v);
      return low !== null && mod12(low) === bass;
    });
  }
  return list
    .filter((v) => v.difficulty <= maxDifficulty && v.fretsByString.every((f) => f === null || f <= maxFret))
    .sort((a, b) => a.difficulty - b.difficulty || stringsOf(b) - stringsOf(a) || maxFretOf(a) - maxFretOf(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function stringsOf(v: Voicing): number {
  return v.fretsByString.filter((f) => f !== null).length;
}

function maxFretOf(v: Voicing): number {
  return Math.max(0, ...v.fretsByString.filter((f): f is number => f !== null));
}

/** Qualities to fall back to, each containing only notes of the original (nothing wrong is added). */
const SIMPLER: Record<ChordQuality, ChordQuality[]> = {
  maj: ['5'], min: ['5'], '7': ['maj', '5'], maj7: ['maj', '5'], min7: ['min', '5'], sus2: ['5'], sus4: ['5'], dim: [], aug: [],
  '5': [], '6': ['maj', '5'], min6: ['min', '5'], '9': ['7', 'maj', '5'], add9: ['maj', '5'], dim7: ['dim'], m7b5: ['dim'],
  '7sus4': ['sus4', '5'],
};

export interface EasiestVoicing {
  voicing: Voicing;
  /** The chord actually played (same root; maybe a simpler quality or no slash bass). */
  played: ParsedChord;
  simplified: boolean;
  /** Plain-English notes about each simplification, empty when none. */
  simplifications: string[];
}

/**
 * The easiest voicing of a chord within the limits. Exact voicings win; otherwise the
 * quality is simplified by dropping notes (maj7 → maj, 9 → 7, add9 → maj …), keeping
 * the slash bass if any voicing can; as a last resort the slash bass is left out. The
 * root never changes, so the key never changes.
 */
export function easiestVoicing(chord: ParsedChord, query: VoicingQuery = {}): EasiestVoicing | null {
  const qualities = [chord.quality, ...SIMPLER[chord.quality]];
  const basses = chord.bass === null ? [null] : [chord.bass, null];
  for (const bass of basses) {
    for (const quality of qualities) {
      const v = voicingsFor({ root: chord.root, quality, bass }, query)[0];
      if (!v) continue;
      const notes: string[] = [];
      if (quality !== chord.quality) notes.push(`${chord.display} is played as ${chordDisplay(chord.root, quality, bass)} (some notes left out).`);
      if (bass === null && chord.bass !== null) notes.push(`The bass note ${pcName(chord.bass)} is left out.`);
      const played: ParsedChord = { root: chord.root, quality, bass, display: quality === chord.quality && bass === chord.bass ? chord.display : chordDisplay(chord.root, quality, bass) };
      return { voicing: v, played, simplified: notes.length > 0, simplifications: notes };
    }
  }
  return null;
}

export interface CapoShape {
  /** The chord as it sounds (unchanged by the capo). */
  original: ParsedChord;
  /** The shape to finger with the capo on, e.g. capo 2 + "G" shape sounds A. */
  shapeName: string;
  voicing: Voicing | null;
  simplified: boolean;
}

export interface CapoSuggestion {
  capo: number;
  shapes: CapoShape[];
  /** Sum of shape difficulties over every chord given (repeats count), +1 per simplified shape, +10 per unplayable one. */
  totalDifficulty: number;
}

const UNPLAYABLE_COST = 10;

/** Every capo position from 0 to maxCapo, best (lowest total difficulty, then lowest capo) first. */
export function rankCapoOptions(chords: readonly ParsedChord[], options: { maxCapo?: number; maxDifficulty?: number } = {}): CapoSuggestion[] {
  const maxCapo = Math.max(0, Math.min(11, Math.floor(options.maxCapo ?? 7)));
  const results: CapoSuggestion[] = [];
  for (let capo = 0; capo <= maxCapo; capo++) {
    const cache = new Map<string, CapoShape & { cost: number }>();
    let total = 0;
    for (const c of chords) {
      const key = `${c.root}|${c.quality}|${c.bass}`;
      let entry = cache.get(key);
      if (!entry) {
        const shape = transposeChord(c, -capo);
        const ev = easiestVoicing(shape, { maxFret: MAX_VOICING_FRET - capo, maxDifficulty: options.maxDifficulty });
        entry = {
          original: c,
          shapeName: ev ? ev.played.display : shape.display,
          voicing: ev?.voicing ?? null,
          simplified: ev?.simplified ?? false,
          cost: ev ? ev.voicing.difficulty + (ev.simplified ? 1 : 0) : UNPLAYABLE_COST,
        };
        cache.set(key, entry);
      }
      total += entry.cost;
    }
    results.push({ capo, shapes: [...cache.values()].map(({ cost: _cost, ...s }) => s), totalDifficulty: total });
  }
  return results.sort((a, b) => a.totalDifficulty - b.totalDifficulty || a.capo - b.capo);
}

/**
 * Best capo for a chord list: shapes are fingered `original − capo` semitones lower, so the
 * sounding key is unchanged. Prefers capo 0 when totals are equal.
 */
export function suggestCapo(chords: readonly ParsedChord[], options: { maxCapo?: number; maxDifficulty?: number } = {}): CapoSuggestion {
  return rankCapoOptions(chords, options)[0]!;
}
