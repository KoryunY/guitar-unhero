/**
 * Chord-shape dictionary used by the lessons (standard tuning, low→high = string 6 → 1).
 * Every shape's sounding pitches are checked against its named chord in
 * tests/unit/curriculum.test.ts. Finger numbers are common teaching defaults, not rules;
 * `null` on a fretted string means "thumb" in the thumb-over shapes (see their captions).
 */
import type { ChordShape } from './core';

const shape = (name: string, lowToHigh: ChordShape['lowToHigh'], fingersLowToHigh: ChordShape['fingersLowToHigh']): ChordShape => ({ name, lowToHigh, fingersLowToHigh });

// Reviewed chord facts from the master specification §3.3.
export const EM: ChordShape = { name: 'E minor (Em)', lowToHigh: [0, 2, 2, 0, 0, 0], fingersLowToHigh: [null, 2, 3, null, null, null] };
export const AM: ChordShape = { name: 'A minor (Am)', lowToHigh: ['x', 0, 2, 2, 1, 0], fingersLowToHigh: [null, null, 2, 3, 1, null] };

// Open major chords.
export const E_MAJOR = shape('E major (E)', [0, 2, 2, 1, 0, 0], [null, 2, 3, 1, null, null]);
export const A_MAJOR = shape('A major (A)', ['x', 0, 2, 2, 2, 0], [null, null, 1, 2, 3, null]);
export const D_MAJOR = shape('D major (D)', ['x', 'x', 0, 2, 3, 2], [null, null, null, 1, 3, 2]);
export const G_MAJOR = shape('G major (G)', [3, 2, 0, 0, 0, 3], [2, 1, null, null, null, 3]);
export const C_MAJOR = shape('C major (C)', ['x', 3, 2, 0, 1, 0], [null, 3, 2, null, 1, null]);
export const D_MINOR = shape('D minor (Dm)', ['x', 'x', 0, 2, 3, 1], [null, null, null, 2, 3, 1]);
/** A common easy stand-in for F before barre chords. */
export const FMAJ7 = shape('F major 7 (Fmaj7)', ['x', 'x', 3, 2, 1, 0], [null, null, 3, 2, 1, null]);

// Dominant sevenths.
export const E7 = shape('E dominant 7 (E7)', [0, 2, 0, 1, 0, 0], [null, 2, null, 1, null, null]);
export const A7 = shape('A dominant 7 (A7)', ['x', 0, 2, 0, 2, 0], [null, null, 1, null, 3, null]);
export const D7 = shape('D dominant 7 (D7)', ['x', 'x', 0, 2, 1, 2], [null, null, null, 2, 1, 3]);
export const B7 = shape('B dominant 7 (B7)', ['x', 2, 1, 2, 0, 2], [null, 2, 1, 3, null, 4]);

// Suspended chords.
export const DSUS2 = shape('D suspended 2 (Dsus2)', ['x', 'x', 0, 2, 3, 0], [null, null, null, 1, 3, null]);
export const DSUS4 = shape('D suspended 4 (Dsus4)', ['x', 'x', 0, 2, 3, 3], [null, null, null, 1, 3, 4]);
export const ASUS2 = shape('A suspended 2 (Asus2)', ['x', 0, 2, 2, 0, 0], [null, null, 1, 2, null, null]);
export const ASUS4 = shape('A suspended 4 (Asus4)', ['x', 0, 2, 2, 3, 0], [null, null, 1, 2, 4, null]);

// Power chords (root + fifth) and the rock-and-roll "6" move.
export const E5 = shape('E5 power chord (E5)', [0, 2, 'x', 'x', 'x', 'x'], [null, 1, null, null, null, null]);
export const A5 = shape('A5 power chord (A5)', ['x', 0, 2, 'x', 'x', 'x'], [null, null, 1, null, null, null]);
export const D5 = shape('D5 power chord (D5)', ['x', 'x', 0, 2, 'x', 'x'], [null, null, null, 1, null, null]);
export const G5 = shape('G5 power chord (G5)', [3, 5, 'x', 'x', 'x', 'x'], [1, 3, null, null, null, null]);
export const C5 = shape('C5 power chord (C5)', ['x', 3, 5, 'x', 'x', 'x'], [null, 1, 3, null, null, null]);
export const B5 = shape('B5 power chord (B5)', ['x', 2, 4, 'x', 'x', 'x'], [null, 1, 3, null, null, null]);
export const F5 = shape('F5 power chord (F5)', [1, 3, 'x', 'x', 'x', 'x'], [1, 3, null, null, null, null]);
export const E6 = shape('E6, the boogie reach (E6)', [0, 4, 'x', 'x', 'x', 'x'], [null, 3, null, null, null, null]);

// Barre chords.
export const F_SMALL = shape('F major, small barre (F)', ['x', 'x', 3, 2, 1, 1], [null, null, 3, 2, 1, 1]);
export const F_BARRE = shape('F major, full barre (F)', [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1]);
export const G_BARRE = shape('G major, E-shape barre at fret 3 (G)', [3, 5, 5, 4, 3, 3], [1, 3, 4, 2, 1, 1]);
export const A_BARRE = shape('A major, E-shape barre at fret 5 (A)', [5, 7, 7, 6, 5, 5], [1, 3, 4, 2, 1, 1]);
export const GM_BARRE = shape('G minor, Em-shape barre at fret 3 (Gm)', [3, 5, 5, 3, 3, 3], [1, 3, 4, 1, 1, 1]);
export const AM_BARRE = shape('A minor, Em-shape barre at fret 5 (Am)', [5, 7, 7, 5, 5, 5], [1, 3, 4, 1, 1, 1]);
export const B_BARRE = shape('B major, A-shape barre at fret 2 (B)', ['x', 2, 4, 4, 4, 2], [null, 1, 2, 3, 4, 1]);
export const C_BARRE = shape('C major, A-shape barre at fret 3 (C)', ['x', 3, 5, 5, 5, 3], [null, 1, 2, 3, 4, 1]);
export const BM = shape('B minor (Bm)', ['x', 2, 4, 4, 3, 2], [null, 1, 3, 4, 2, 1]);

// Knockoff Hero colours.
/** Thumb frets string 6 (finger shown as none); the thumb's tip lightly touches string 5 to mute it. */
export const G_THUMB = shape('G major, thumb-over bass (G)', [3, 'x', 0, 0, 0, 3], [null, null, null, null, null, 3]);
/** D shape on top, thumb frets F# on string 6. */
export const D_OVER_FS = shape('D with F♯ in the bass, thumb-over (D/F#)', [2, 'x', 0, 2, 3, 2], [null, null, null, 1, 3, 2]);
/** The dominant 7♯9, nicknamed "the Hendrix chord". */
export const E7_SHARP9 = shape('E7♯9, "the Hendrix chord" (E7#9)', ['x', 7, 6, 7, 8, 'x'], [null, 2, 1, 3, 4, null]);

/** Every shape above, for tests and chord pickers. */
export const CHORD_SHAPES: readonly ChordShape[] = [
  EM, AM, E_MAJOR, A_MAJOR, D_MAJOR, G_MAJOR, C_MAJOR, D_MINOR, FMAJ7,
  E7, A7, D7, B7, DSUS2, DSUS4, ASUS2, ASUS4,
  E5, A5, D5, G5, C5, B5, F5, E6,
  F_SMALL, F_BARRE, G_BARRE, A_BARRE, GM_BARRE, AM_BARRE, B_BARRE, C_BARRE, BM,
  G_THUMB, D_OVER_FS, E7_SHARP9,
];
