import type { CalibrationRecord } from '../audio/calibration';
import type { PhraseStats, InputSource } from '../assessment/summary';
import type { PracticeMode } from '../transport/transport';

export type InputMode = 'microphone' | 'simulation' | 'none';
export type OutputRoute = 'headphones' | 'speakers' | 'unknown';

export interface Settings {
  /** Show developer/advanced tools (mic lab, calibration, backup/restore, details). */
  advanced: boolean;
  /** Experimental camera self-view (off by default). */
  cameraLab: boolean;
  handedness: 'right' | 'left';
  hasGuitar: boolean | null;
  inputMode: InputMode;
  deviceId: string | null;
  outputRoute: OutputRoute;
  reducedMotion: 'system' | 'on' | 'off';
  highContrast: boolean;
  guideLevel: number;
  metronomeLevel: number;
  referenceLevel: number;
  practiceRate: 0.5 | 0.75 | 1;
  practiceMode: PracticeMode;
  guideOn: boolean;
  metronomeOn: boolean;
  lookaheadSec: number;
  onboarded: boolean;
  calibration: CalibrationRecord | null;
}

export const DEFAULT_SETTINGS: Settings = {
  advanced: false,
  cameraLab: false,
  handedness: 'right',
  hasGuitar: null,
  inputMode: 'none',
  deviceId: null,
  outputRoute: 'unknown',
  reducedMotion: 'system',
  highContrast: false,
  guideLevel: 0.8,
  metronomeLevel: 0.6,
  referenceLevel: 0.8,
  practiceRate: 0.5,
  practiceMode: 'wait',
  guideOn: true,
  metronomeOn: true,
  lookaheadSec: 3,
  onboarded: false,
  calibration: null,
};

/** How a completion was evidenced. Manual completion is never relabeled as sensor mastery. */
export type Evidence = 'sensor' | 'self_reported' | 'simulated';

export type SkillState = 'unseen' | 'introduced' | 'practicing' | 'demonstrated' | 'retained';

export interface StepCompletion {
  stepId: string;
  evidence: Evidence;
  at: string;
}

export interface LessonProgress {
  lessonId: string;
  lessonVersion: number;
  completedSteps: StepCompletion[];
  completedAt: string | null;
  completionEvidence: Evidence | null;
  skillState: SkillState;
  /** Set when a later-day recall attempt succeeded. */
  retainedAt?: string | null;
  imported?: boolean;
}

export interface PracticeSummaryRecord {
  id: string;
  arrangementId: string;
  arrangementVersion: number;
  title: string;
  mode: PracticeMode;
  rate: number;
  loop: { aTick: number; bTick: number } | null;
  inputSource: InputSource;
  simulated: boolean;
  calibrated: boolean;
  policyVersion: string;
  stats: PhraseStats;
  suggestion: string;
  /** Recall level: full cues, reduced (no fret/finger numbers) or none (from memory). */
  cueLevel?: 'full' | 'reduced' | 'none';
  startedAt: string;
  finishedAt: string;
  imported?: boolean;
}

export interface ExportManifest {
  format: 'guitar-unhero-progress';
  formatVersion: 1;
  exportedAt: string;
  app: string;
  settings: Settings;
  lessons: LessonProgress[];
  summaries: PracticeSummaryRecord[];
}

import type { Rights, Score } from '../domain/score';

/** Local audio file imported by the learner (never uploaded). */
export interface AssetRecord {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  durationSec: number;
  sampleRate: number;
  channels: number;
  sha256: string;
  createdAt: string;
  rights: Rights;
  blob: Blob;
}

/** Status labels required by spec §7.2. */
export type SongStatus = 'backing only' | 'score attached' | 'candidate transcription' | 'review needed' | 'reviewed arrangement';

export interface SongVersionRef {
  arrangementId: string;
  version: number;
  role: Score['role'];
  title: string;
  createdAt: string;
  note: string;
}

export interface SongRecord {
  id: string;
  title: string;
  assetId: string | null;
  /** Main editable part (latest version is the last matching entry in `versions`). */
  mainArrangementId: string | null;
  versions: SongVersionRef[];
  /** Alignment of the recording to the score (tick ↔ recording second). */
  anchors: { tick: number; sourceSec: number }[];
  alignment: 'none' | 'tapped' | 'reviewed';
  /** Raw transcription leftovers to show as uncertain regions in review. */
  uncertain: { onsetSec: number; reason: string }[];
  createdAt: string;
  updatedAt: string;
}
