/**
 * Choose chord shapes for a whole progression at a difficulty level, using the
 * voicing library in chords.ts. Easy may add a capo so easier shapes sound the
 * same chords (the key never changes); medium keeps common open shapes;
 * full uses the exact chords (or the shapes a tab gave).
 */
import { easiestVoicing, parseChordName, suggestCapo, voicingsFor, type FingerMark, type ParsedChord, type Voicing } from './chords';
import type { ChordFrets, Finger } from './score';
import type { Level, SourceChord } from './songArrange';

export interface VoicedChord {
  shapeName: string | null;
  frets: ChordFrets;
  fingers?: Finger[];
}

export interface VoicedProgression {
  capo: number;
  /** Aligned with the input chords; undefined where no shape could be chosen. */
  voiced: (VoicedChord | undefined)[];
  notes: string[];
  /** Distinct chord names as they sound, in order of first use. */
  sounding: string[];
}

const toFinger = (f: FingerMark): Finger => (f === 1 || f === 2 || f === 3 || f === 4 ? f : null);

function fromVoicing(v: Voicing, name: string): VoicedChord {
  return { shapeName: name, frets: v.fretsByString.slice(0, 6) as ChordFrets, fingers: v.fingers.slice(0, 6).map(toFinger) };
}

function fromFrets(name: string | null, frets: readonly (number | null)[]): VoicedChord {
  const f = [0, 1, 2, 3, 4, 5].map((i) => frets[i] ?? null) as ChordFrets;
  return { shapeName: name, frets: f };
}

export function voiceProgression(chords: readonly SourceChord[], level: Level): VoicedProgression {
  const parsed: (ParsedChord | null)[] = chords.map((c) => (c.name ? parseChordName(c.name) : null));
  const notes = new Set<string>();
  const sounding: string[] = [];
  for (const p of parsed) if (p && !sounding.includes(p.display)) sounding.push(p.display);
  // Spelling differences (A# vs Bb) are the same chord.
  const allNamed = chords.length > 0 && parsed.every((p) => p !== null);

  if ((level === 'easy' || level === 'medium') && allNamed) {
    const maxDifficulty = level === 'easy' ? 2 : 3;
    const best = suggestCapo(parsed as ParsedChord[], { maxCapo: level === 'easy' ? 7 : 5, maxDifficulty });
    const plain = best.capo === 0 ? best : suggestCapo(parsed as ParsedChord[], { maxCapo: 0, maxDifficulty });
    // Only use a capo when it really helps.
    const pick = best.capo > 0 && best.totalDifficulty + 2 <= plain.totalDifficulty ? best : plain;
    // Shapes are listed per distinct chord: look them up by the sounding name.
    const keyOf = (c: Pick<ParsedChord, 'root' | 'quality' | 'bass'>) => `${c.root}|${c.quality}|${c.bass ?? ''}`;
    const byKey = new Map(pick.shapes.map((sh) => [keyOf(sh.original), sh]));
    const voiced = (parsed as ParsedChord[]).map((p) => {
      const sh = byKey.get(keyOf(p));
      return sh?.voicing ? fromVoicing(sh.voicing, sh.shapeName) : undefined;
    });
    pick.shapes.forEach((s) => s.simplified && notes.add(`${s.original.display} is played as an easier ${s.shapeName} shape (some notes left out).`));
    const missing = voiced.filter((v) => !v).length;
    if (missing) notes.add(`${missing} chord change(s) had no easy shape and are shown as a rest — keep strumming the previous chord or pause.`);
    return { capo: pick.capo, voiced, notes: [...notes], sounding };
  }

  const maxDifficulty = level === 'easy' ? 2 : level === 'medium' ? 3 : 5;
  // Prefer easy shapes low on the neck: difficulty first, then how high up the neck it sits.
  const cost = (v: Voicing) => v.difficulty + 0.25 * Math.max(0, ...v.fretsByString.map((f) => f ?? 0));
  const voiced = chords.map((c, i) => {
    const p = parsed[i];
    if (level === 'full' && c.fretsByString?.some((f) => f !== null)) return fromFrets(c.name, c.fretsByString);
    if (!p) return c.fretsByString?.some((f) => f !== null) ? fromFrets(c.name, c.fretsByString) : undefined;
    if (level === 'full') {
      const exact = [...voicingsFor(p)].sort((a, b) => cost(a) - cost(b))[0];
      if (exact) return fromVoicing(exact, p.display);
    }
    const easy = easiestVoicing(p, { maxDifficulty, maxFret: 9 }) ?? easiestVoicing(p);
    if (!easy) return undefined;
    easy.simplifications.forEach((n) => notes.add(n));
    if (easy.voicing.difficulty > maxDifficulty) notes.add(`${p.display} has no shape easier than level ${easy.voicing.difficulty} — take it slowly.`);
    return fromVoicing(easy.voicing, easy.played.display);
  });
  return { capo: 0, voiced, notes: [...notes], sounding };
}
