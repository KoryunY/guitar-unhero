/**
 * Full-song audio analysis (beats, key, chords, melody, bass, sections) for an
 * imported band/pop mix, using classic DSP only: no models, no dependencies,
 * no network, no audio persisted. Input is decoded mono PCM; 22 050 Hz is the
 * native analysis rate (other rates are resampled internally, frame by frame).
 * Results are estimates for review, never assessment evidence.
 */
export type { AnalyzeOptions, ChordQuality, ChordSegment, NoteSegment, SongAnalysis, SongKey, SongSection, SongWorkerMessage, SongWorkerRequest } from './types';
export { analyzeSong, analyzeSongDetailed, MAX_ANALYSIS_SEC, type SongAnalysisDetails } from './analyze';
export { estimateTempo, localPeriods, localScore, trackBeats, beatConfidence } from './beats';
export { BandFlux, normalizeEnvelope } from './novelty';
export { estimateTuning } from './tuning';
export { frameChroma, beatSyncChroma } from './chroma';
export { chordTemplates, chordScores, decodeChords, chordSegments, stateLabel, QUALITIES } from './chords';
export { keyFromProfile, songProfile } from './key';
export { estimateDownbeat } from './downbeat';
export { segmentSections, noveltyCurve } from './sections';
export { trackContour, segmentNotes, MELODY_PARAMS, BASS_PARAMS } from './pitchTrack';
export { SalienceGrid } from './salience';
export { ResampledReader } from './resample';
export { RealFFT } from './spectrum';
