/**
 * "Any song → three levels". Turns a song source (notes and/or chord names from
 * an imported tab, MIDI file, chord sheet or audio analysis) into gu-score/2
 * arrangements at three difficulty levels:
 *
 *   easy   — easiest chord shapes (capo if it helps), one strum per chord;
 *            melody on strong beats only, frets 0–3.
 *   medium — common open shapes, four down-strums a bar;
 *            melody without very short off-beat notes, frets 0–5.
 *   full   — the shapes/notes as given, a down-up pattern; whole melody line.
 *
 * Easy versions never change the key: notes move only by octaves and a capo
 * keeps the sounding chords identical. Chords are shown and played by the app,
 * never assessed. Candidate material (audio analysis) stays a candidate at every
 * level until the learner reviews it.
 */
import { PPQ, sortEvents, withSchemaVersion, type ChordEvent, type ChordFrets, type NoteEvent, type Rights, type Score, type SourceAudio, type Technique, type Transformation } from './score';
import { blankScore, BAR_TICKS } from './edit';
import { BEGINNER_PROFILE, FULL_NECK_PROFILE, OPEN_POSITION_PROFILE, planFingering, positionsFor, type FingeringProfile } from './fingering';
import { fretToMidi } from './tuning';
import { voiceProgression, type VoicedChord } from './voicing';

export type Level = 'easy' | 'medium' | 'full';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'full'];

export const LEVEL_TEXT: Record<Level, { title: string; sub: string; pattern: string | null }> = {
  easy: { title: 'Easy', sub: 'Easiest shapes, one strum per chord, main notes only', pattern: null },
  medium: { title: 'Medium', sub: 'Common shapes, four strums a bar, most of the tune', pattern: 'D-D-D-D-' },
  full: { title: 'Full', sub: 'All the notes, real shapes, down-up strumming', pattern: 'D-DU-UDU' },
};

export interface SourceNote {
  startTick: number;
  durationTicks: number;
  midi: number;
  string?: 1 | 2 | 3 | 4 | 5 | 6;
  fret?: number;
  techniques?: Technique[];
}

export interface SourceChord {
  startTick: number;
  durationTicks: number;
  /** Chord symbol (e.g. "F#m7"); null when only a shape is known. */
  name: string | null;
  /** Shape from a tab (index 0 = string 1); optional. */
  fretsByString?: (number | null)[];
}

export interface SongSource {
  arrangementId: string;
  title: string;
  bpm: number;
  durationTicks: number;
  notes: SourceNote[];
  chords: SourceChord[];
  sections: { startTick: number; name: string }[];
  rights: Rights;
  /** 'model_candidate' for audio analysis (needs review before assessment); 'imported' for files. */
  method: 'imported' | 'model_candidate' | 'authored';
  createdBy: string;
  providerId?: string | null;
  providerVersion?: string | null;
  sourceAudio?: SourceAudio;
  now?: Date;
}

export interface LevelResult {
  level: Level;
  score: Score;
  /** Plain-language notes on what was simplified. */
  notes: string[];
  capo: number;
  /** Chord names as they sound (same in every level). */
  chordNames: string[];
}

/** Highest note at each onset, overlaps trimmed: a single playable melody line. */
export function skyline(notes: readonly SourceNote[]): SourceNote[] {
  const byStart = new Map<number, SourceNote>();
  for (const n of notes) {
    const cur = byStart.get(n.startTick);
    if (!cur || n.midi > cur.midi) byStart.set(n.startTick, n);
  }
  const line = [...byStart.values()].sort((a, b) => a.startTick - b.startTick);
  return line.map((n, i) => {
    const next = line[i + 1];
    const end = next ? Math.min(n.startTick + n.durationTicks, next.startTick) : n.startTick + n.durationTicks;
    return { ...n, durationTicks: Math.max(1, end - n.startTick) };
  });
}

const PROFILE: Record<Level, FingeringProfile> = { easy: BEGINNER_PROFILE, medium: OPEN_POSITION_PROFILE, full: FULL_NECK_PROFILE };

function melodyFor(level: Level, line: SourceNote[], capo: number, log: Transformation[], notes: string[]): NoteEvent[] {
  if (!line.length) return [];
  let kept = line;
  if (level === 'easy') {
    kept = line.filter((n) => n.startTick % (2 * PPQ) === 0 || (n.startTick % PPQ === 0 && n.durationTicks >= PPQ));
    if (kept.length < line.length) notes.push(`Kept ${kept.length} of ${line.length} melody notes (the ones on strong beats).`);
  } else if (level === 'medium') {
    kept = line.filter((n) => !(n.durationTicks < PPQ / 2 && n.startTick % PPQ !== 0));
    if (kept.length < line.length) notes.push(`Left out ${line.length - kept.length} very short off-beat notes.`);
  }
  if (kept.length < line.length) {
    const dropped = line.filter((n) => !kept.includes(n));
    log.push({ kind: 'omit', description: `Omitted ${dropped.length} melody note(s) for the ${level} level.`, sourceEventIds: [], resultEventIds: [] });
  }
  // Hold kept notes until the next kept note (max two beats) so the line breathes.
  const held = kept.map((n, i) => {
    const next = kept[i + 1];
    if (level === 'full') return n;
    const maxEnd = Math.min(next ? next.startTick : n.startTick + n.durationTicks, n.startTick + 2 * PPQ);
    return { ...n, durationTicks: Math.max(n.durationTicks, maxEnd - n.startTick) };
  });
  // Octave-shift into the level's frets (key unchanged).
  const profile = { ...PROFILE[level], capo };
  let shifted = 0, dropped = 0;
  const fit = held.flatMap((n) => {
    if (positionsFor(n.midi, profile).length) return [n];
    for (const d of [12, -12, 24, -24]) {
      if (positionsFor(n.midi + d, profile).length) {
        shifted++;
        return [{ ...n, midi: n.midi + d, string: undefined, fret: undefined }];
      }
    }
    dropped++;
    return [];
  });
  if (shifted) notes.push(`${shifted} note(s) moved by an octave to fit frets ${profile.minFret}–${profile.maxFret}${capo ? ` above the capo` : ''} (same key).`);
  if (dropped) notes.push(`${dropped} note(s) had no place in frets ${profile.minFret}–${profile.maxFret} and were left out.`);
  if (shifted) log.push({ kind: 'octave_shift', description: `Moved ${shifted} note(s) by an octave (key unchanged).`, sourceEventIds: [], resultEventIds: [] });
  if (!fit.length) return [];
  // Keep a given string/fret when it fits this level, else plan fingering.
  const given = fit.every((n) => n.string && n.fret !== undefined && n.fret - capo >= profile.minFret && n.fret - capo <= profile.maxFret && level === 'full' && capo === 0);
  let positions: { string: 1 | 2 | 3 | 4 | 5 | 6; fret: number; finger: NoteEvent['finger'] }[];
  if (given) {
    positions = fit.map((n) => ({ string: n.string!, fret: n.fret!, finger: n.fret === 0 ? null : (Math.min(4, Math.max(1, ((n.fret! - 1) % 4) + 1)) as 1 | 2 | 3 | 4) }));
  } else {
    const plan = planFingering(fit.map((n) => n.midi), profile);
    if (!plan.ok) return [];
    positions = plan.positions;
  }
  return fit.map((n, i) => {
    const p = positions[i]!;
    const legato = n.techniques?.some((t) => t.kind === 'hammer_on' || t.kind === 'pull_off' || t.kind === 'slide_up' || t.kind === 'slide_down' || t.kind === 'tap');
    const ev: NoteEvent = {
      id: `m${i + 1}`,
      kind: 'note',
      startTick: n.startTick,
      durationTicks: n.durationTicks,
      pitchMidi: fretToMidi(p.string, p.fret, capo),
      string: p.string,
      fret: p.fret,
      finger: p.fret === 0 ? null : p.finger,
      sourceEventIds: [],
      // Legato notes have no clear pick attack: only the pitch is checked.
      assessment: { pitch: true, attack: !legato, sustain: false },
    };
    if (level === 'full' && n.techniques?.length) ev.techniques = n.techniques.slice(0, 4);
    return ev;
  });
}

function chordTrack(level: Level, chords: readonly SourceChord[], voiced: VoicedChord[]): ChordEvent[] {
  const pattern = LEVEL_TEXT[level].pattern;
  const out: ChordEvent[] = [];
  chords.forEach((c, i) => {
    const v = voiced[i];
    if (!v) return;
    out.push({
      id: `c${i + 1}`,
      startTick: c.startTick,
      durationTicks: c.durationTicks,
      name: v.shapeName,
      frets: v.frets,
      ...(v.fingers ? { fingers: v.fingers } : {}),
      // Very short chords (under a beat) get a single strum at every level.
      pattern: c.durationTicks < PPQ ? null : pattern,
    });
  });
  return out;
}

/** Merge equal neighbours and clip overlaps so the chord track is valid. */
export function tidyChords(chords: readonly SourceChord[], durationTicks: number): SourceChord[] {
  const sorted = [...chords].filter((c) => c.durationTicks > 0 && c.startTick < durationTicks).sort((a, b) => a.startTick - b.startTick);
  const out: SourceChord[] = [];
  for (const c of sorted) {
    const prev = out[out.length - 1];
    const same = prev && prev.name === c.name && JSON.stringify(prev.fretsByString ?? null) === JSON.stringify(c.fretsByString ?? null);
    if (prev && same && c.startTick <= prev.startTick + prev.durationTicks) {
      prev.durationTicks = Math.max(prev.durationTicks, c.startTick + c.durationTicks - prev.startTick);
      continue;
    }
    if (prev && c.startTick < prev.startTick + prev.durationTicks) prev.durationTicks = c.startTick - prev.startTick;
    if (prev && prev.durationTicks <= 0) out.pop();
    out.push({ ...c, durationTicks: Math.min(c.durationTicks, durationTicks - c.startTick) });
  }
  return out.filter((c) => c.durationTicks > 0);
}

export function buildLevels(src: SongSource): LevelResult[] {
  const durationTicks = Math.max(BAR_TICKS, Math.ceil(src.durationTicks / BAR_TICKS) * BAR_TICKS);
  const chords = tidyChords(src.chords, durationTicks);
  const line = skyline(src.notes.filter((n) => n.startTick < durationTicks)).map((n) => ({ ...n, durationTicks: Math.min(n.durationTicks, durationTicks - n.startTick) }));
  const candidate = src.method === 'model_candidate';
  return LEVELS.map((level) => {
    const notes: string[] = [];
    const log: Transformation[] = [];
    const prog = voiceProgression(chords, level);
    if (prog.capo) notes.push(`Capo on fret ${prog.capo}: easier shapes, same sound as the original chords.`);
    notes.push(...prog.notes);
    const events = melodyFor(level, line, prog.capo, log, notes);
    const track = chordTrack(level, chords, prog.voiced);
    const base = blankScore({ arrangementId: `${src.arrangementId}.${level}`.slice(0, 120), title: `${src.title} (${LEVEL_TEXT[level].title.toLowerCase()})`, bpm: src.bpm, bars: durationTicks / BAR_TICKS, rights: src.rights, createdBy: src.createdBy, now: src.now });
    const score: Score = {
      ...base,
      schemaVersion: 'gu-score/2',
      role: candidate ? 'transcription_candidate' : level === 'full' ? (src.method === 'imported' ? 'imported_part' : 'reviewed_part') : 'simplified_arrangement',
      instrument: { ...base.instrument, capo: prog.capo },
      events: sortEvents(events),
      chords: track,
      sections: dedupeSections(src.sections, durationTicks),
      arrangementLevel: level,
      provenance: {
        ...base.provenance,
        method: candidate ? 'model_candidate' : level === 'full' ? src.method : 'derived',
        reviewStatus: 'unreviewed',
        reviewer: null,
        ...(src.providerId ? { providerId: src.providerId, providerVersion: src.providerVersion ?? null, modelArtifactSha256: null } : {}),
        notes: [`${LEVEL_TEXT[level].title} level: ${LEVEL_TEXT[level].sub}.`, ...notes].join(' ').slice(0, 4000),
      },
      transformations: log.slice(0, 1000),
      ...(src.sourceAudio ? { sourceAudio: src.sourceAudio } : {}),
    };
    if (!score.events.length && !score.chords?.length) {
      // Nothing playable at all: keep a valid placeholder rest-free score impossible; caller handles.
    }
    return { level, score: withSchemaVersion(score), notes, capo: prog.capo, chordNames: prog.sounding };
  });
}

function dedupeSections(sections: readonly { startTick: number; name: string }[], durationTicks: number) {
  const out: { tick: number; name: string }[] = [];
  for (const s of [...sections].sort((a, b) => a.startTick - b.startTick)) {
    const tick = Math.max(0, Math.round(s.startTick));
    if (tick > durationTicks) continue;
    if (out.length && tick <= out[out.length - 1]!.tick) continue;
    out.push({ tick, name: s.name.slice(0, 60) || 'Part' });
  }
  return out.slice(0, 500);
}

/** View of a level for practice: the melody line, or chords only (nothing assessed). */
export function partView(score: Score, part: 'melody' | 'chords'): Score {
  if (part === 'melody') return score;
  return { ...score, schemaVersion: 'gu-score/2', events: [], arrangementId: `${score.arrangementId}.chords`.slice(0, 120) };
}

export type { ChordFrets };
