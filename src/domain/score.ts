/**
 * Canonical score types for `gu-score/1` (see Documents/gu-score-v1.schema.json).
 * Timing (ticks), pitch (sounding MIDI), physical fingering (string/fret/finger),
 * evidence (assessment flags) and rights metadata stay separate fields.
 */

export const PPQ = 960;

export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type Finger = null | 1 | 2 | 3 | 4;

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
  schemaVersion: 'gu-score/1';
  arrangementId: string;
  version: number;
  parent: null | { arrangementId: string; version: number };
  title: string;
  role: 'original_exercise' | 'transcription_candidate' | 'reviewed_part' | 'simplified_arrangement';
  ppq: 960;
  durationTicks: number;
  instrument: {
    type: 'six_string_guitar';
    capo: 0;
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
