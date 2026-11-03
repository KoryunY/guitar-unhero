import type { CalibrationRecord } from '../audio/calibration';
import type { PhraseStats, InputSource } from '../assessment/summary';
import type { PracticeMode } from '../transport/transport';

export type InputMode = 'microphone' | 'simulation' | 'none';
export type OutputRoute = 'headphones' | 'speakers' | 'unknown';

export interface Settings {
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
