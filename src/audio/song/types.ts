/**
 * Public types of the full-song analysis (classic DSP only, no models, no
 * network). All times are seconds from the start of the decoded audio.
 * Pitch classes: 0 = C … 11 = B. MIDI note numbers use A4 = 69 = 440 Hz; the
 * estimated global tuning offset is already removed from every MIDI value.
 */
export type ChordQuality = 'maj' | 'min' | '7' | 'min7' | 'maj7' | '5' | 'N';

export interface ChordSegment {
  startSec: number;
  endSec: number;
  /** Root pitch class, null for 'N' (no chord). */
  root: number | null;
  quality: ChordQuality;
  /** Mean posterior of the chosen label over its beats (0..1, not calibrated). */
  confidence: number;
}

export interface NoteSegment {
  startSec: number;
  endSec: number;
  midi: number;
  /** Mean normalised salience/voicing margin (0..1, not calibrated). */
  confidence: number;
}

export interface SongSection {
  startSec: number;
  /** 'A', 'B', … — equal letters mean similar harmony/sound. */
  label: string;
}

export interface SongKey {
  /** Tonic pitch class, 0 = C. */
  tonic: number;
  mode: 'major' | 'minor';
  confidence: number;
}

export interface SongAnalysis {
  durationSec: number;
  sampleRate: number;
  /** Global tuning offset estimate in cents relative to A4 = 440 Hz (−50…+50). */
  tuningCents: number;
  bpm: number;
  /** Other plausible tempi (half/double). */
  bpmAlternatives: number[];
  /** Beat times in seconds, ascending. */
  beats: number[];
  /** Index into `beats` of the first bar's beat 1 (4/4 assumed). */
  downbeatIndex: number;
  /** 0..1 heuristic. */
  beatConfidence: number;
  key: SongKey;
  chords: ChordSegment[];
  /** Predominant melody notes (often the singer). */
  melody: NoteSegment[];
  /** Lowest predominant line. */
  bass: NoteSegment[];
  sections: SongSection[];
  /** Plain-English notes about reliability. */
  warnings: string[];
}

export interface AnalyzeOptions {
  onProgress?: (fraction: number, stage: string) => void;
  /** Checked between stages and blocks; when true, analysis throws Error('cancelled'). */
  signal?: { aborted: boolean };
}

/** Worker protocol (see analysis.worker.ts). The pcm buffer should be transferred. */
export type SongWorkerRequest = { type: 'analyze'; pcm: Float32Array; sampleRate: number };
export type SongWorkerMessage =
  | { type: 'progress'; fraction: number; stage: string }
  | { type: 'result'; analysis: SongAnalysis }
  | { type: 'error'; message: string };
