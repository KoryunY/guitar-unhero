/**
 * Canonical score types for `gu-score/1` and its superset `gu-score/2`
 * (Documents/gu-score-v1.schema.json, Documents/gu-score-v2.schema.json).
 * v2 adds a chord track (never assessed), sections, a capo, technique
 * annotations and long recordings; `events` stays a monophonic line.
 * Timing (ticks), pitch (sounding MIDI), physical fingering (string/fret/finger),
 * evidence (assessment flags) and rights metadata stay separate fields.
 */

export const PPQ = 960;

export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type Finger = null | 1 | 2 | 3 | 4;

export type TechniqueKind =
  | 'bend' | 'release' | 'slide_up' | 'slide_down' | 'slide_into' | 'hammer_on' | 'pull_off'
  | 'vibrato' | 'palm_mute' | 'harmonic' | 'dead_note' | 'let_ring' | 'tap';

export interface Technique {
  kind: TechniqueKind;
  /** Bend/release size in semitones. */
  semitones?: number;
}

/** Fret per string, index 0 = string 1 (high E) … 5 = string 6; null = not played. */
export type ChordFrets = [number | null, number | null, number | null, number | null, number | null, number | null];

/**
 * A chord shape held over time (gu-score/2). Shown and played by the app but
 * never assessed: chords are only ever checked one string at a time in lessons.
 */
export interface ChordEvent {
  id: string;
  startTick: number;
  durationTicks: number;
  name: string | null;
  frets: ChordFrets;
  fingers?: Finger[];
  /** Eighth-note grid repeating each bar: D/U strum, d/u light, x chuck, - rest; null = one strum, let ring. */
  pattern: string | null;
  techniques?: Technique[];
}

export interface NoteEvent {
  id: string;
  kind: 'note';
  startTick: number;
  durationTicks: number;
  pitchMidi: number;
  string: StringNumber;
  fret: number;
  /** null = unspecified (never means "open string"). */
  finger: Finger;
  sourceEventIds: string[];
  assessment: { pitch: boolean; attack: boolean; sustain: false };
  /** gu-score/2 only. */
  techniques?: Technique[];
}

export type RightsStatus = 'unknown' | 'user_declared' | 'verified' | 'restricted';
export type AllowedUse = 'local_practice' | 'private_hosted_analysis' | 'modify' | 'redistribute';

export interface Rights {
  status: RightsStatus;
  author: string | null;
  license: string | null;
  allowedUses: AllowedUse[];
  sourceUri: string | null;
  evidence: string | null;
}

export interface Provenance {
  createdAt: string;
  createdBy: string;
  method: 'authored' | 'imported' | 'model_candidate' | 'derived';
  reviewStatus: 'unreviewed' | 'user_reviewed' | 'teacher_reviewed';
  reviewer: string | null;
  providerId?: string | null;
  providerVersion?: string | null;
  modelArtifactSha256?: string | null;
  notes?: string;
}

export interface Transformation {
  kind: 'omit' | 'rhythm_simplify' | 'octave_shift' | 'transpose' | 'fingering_change' | 'manual_edit' | 'select_part';
  description: string;
  sourceEventIds: string[];
  resultEventIds: string[];
}

export interface SourceAudio {
  assetId: string;
  sha256: string;
  durationSec: number;
  rights: Rights;
  alignmentStatus: 'candidate' | 'user_reviewed' | 'teacher_reviewed';
  anchors: { tick: number; sourceSec: number }[];
}

export interface Score {
  schemaVersion: 'gu-score/1' | 'gu-score/2';
  arrangementId: string;
  version: number;
  parent: null | { arrangementId: string; version: number };
  title: string;
  role: 'original_exercise' | 'transcription_candidate' | 'reviewed_part' | 'simplified_arrangement' | 'imported_part';
  ppq: 960;
  durationTicks: number;
  instrument: {
    type: 'six_string_guitar';
    /** Always 0 in gu-score/1. Frets are counted from the capo. */
    capo: number;
    maxFret: number;
    strings: { number: StringNumber; openMidi: number }[];
  };
  tempoMap: { tick: 0; bpm: number }[];
  meterMap: { tick: 0; numerator: 4; denominator: 4 }[];
  events: NoteEvent[];
  rights: Rights;
  provenance: Provenance;
  transformations: Transformation[];
  sourceAudio?: SourceAudio;
  /** gu-score/2 only. */
  chords?: ChordEvent[];
  sections?: { tick: number; name: string }[];
  arrangementLevel?: 'easy' | 'medium' | 'full';
}

/** True when a score needs gu-score/2 features. */
export function needsV2(score: Score): boolean {
  return !!(score.chords?.length || score.sections?.length || score.arrangementLevel || score.instrument.capo || score.role === 'imported_part' ||
    score.events.some((e) => e.techniques?.length) || (score.sourceAudio && score.sourceAudio.durationSec > 180) || score.events.length === 0);
}

/** Stamp the lowest schema version that can represent the score. */
export function withSchemaVersion(score: Score): Score {
  const v = needsV2(score) ? 'gu-score/2' : 'gu-score/1';
  return score.schemaVersion === v ? score : { ...score, schemaVersion: v };
}

export function scoreBpm(score: Score): number {
  const first = score.tempoMap[0];
  if (!first) throw new Error('Score has no tempo map entry');
  return first.bpm;
}

/** Deterministic event order: start tick, then ID. */
export function sortEvents(events: readonly NoteEvent[]): NoteEvent[] {
  return [...events].sort((a, b) => a.startTick - b.startTick || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
