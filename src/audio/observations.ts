/**
 * Observation contracts shared by the detector, matcher and UI (master spec §9.2).
 * All times are AudioContext seconds derived from analyzed sample frames.
 */
export type SignalQuality = 'good' | 'poor' | 'unavailable';

export interface PitchFrame {
  id: string;
  /** Analysis buffer bounds. */
  startSec: number;
  endSec: number;
  centerSec: number;
  /** Bounds of the newest hop (used for level/coverage). */
  hopStartSec: number;
  rmsDb: number;
  peakDb: number;
  clipped: boolean;
  noiseFloorDb: number | null;
  gateDb: number;
  hz: number | null;
  midiFloat: number | null;
  /** YIN d'(τ); 0 periodic … 1 aperiodic. Not a probability. */
  aperiodicity: number;
  /** Whether the input itself was usable (not clipped / not too noisy). */
  inputQuality: SignalQuality;
  pitchQuality: SignalQuality;
  reasonCodes: string[];
}

export interface AttackObservation {
  id: string;
  providerId: string;
  onsetContextSec: number;
  analysisStartContextSec: number;
  analysisEndContextSec: number;
  /** When the result became available on the main thread (freshness only). */
  producedAtPerformanceMs: number;
  pitchHz: number | null;
  pitchMidiFloat: number | null;
  quality: SignalQuality;
  /** 1 − median aperiodicity; a raw score, not a calibrated probability. */
  modelScore: number | null;
  peakDb: number;
  frames: number;
  reasonCodes: string[];
  /** True only for clearly labeled simulation input. Never real assessment. */
  simulated: boolean;
}
