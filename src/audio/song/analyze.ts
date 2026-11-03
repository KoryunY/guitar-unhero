/**
 * Full-song analysis of an already-decoded mono mix (classic DSP, no models,
 * no network, nothing stored). Pipeline:
 *   1. rhythm/melody pass and harmony pass (streaming spectra, see passes.ts);
 *   2. tuning from harmony peaks;
 *   3. tempo + DP beat tracking on the onset envelope;
 *   4. beat-synchronous chroma → chords (HMM), key, downbeat, sections;
 *   5. melody and bass lines from harmonic-summation salience.
 * Long input is analysed in bounded memory: only per-frame summaries are kept.
 */
import type { AnalyzeOptions, NoteSegment, SongAnalysis } from './types';
import { MELODY_K, PEAKS_PER_FRAME, TIMBRE_BANDS, runHarmonyPass, runRhythmPass, type HarmonyPass, type RhythmPass } from './passes';
import { estimateTuning } from './tuning';
import { normalizeEnvelope } from './novelty';
import { beatConfidence, estimateTempo, localPeriods, localScore, trackBeats } from './beats';
import { beatSyncChroma, frameChroma } from './chroma';
import { chordScores, chordSegments, decodeChords } from './chords';
import { keyFromProfile, songProfile } from './key';
import { estimateDownbeat } from './downbeat';
import { segmentSections } from './sections';
import { BASS_PARAMS, MELODY_PARAMS, segmentNotes, trackContour, type Candidates } from './pitchTrack';
import { SalienceGrid } from './salience';

export const MAX_ANALYSIS_SEC = 15 * 60;
/**
 * Delay of the log-flux onset envelope (46 ms window, 20 ms lag) relative to a
 * percussive onset, subtracted from beat times. On synthetic clicks, drums and
 * full mixes the median beat offset measured −5…+7 ms, so no correction is
 * applied; the constant is kept for calibration on real recordings.
 */
export const ONSET_LATENCY_SEC = 0;
const BASS_K = 3;
/** Below this peak-deviation concentration the tuning estimate is ignored (0 = uniform). */
const TUNING_MIN_CONCENTRATION = 0.3;
/** Harmony frames flatter than this are treated as noise (no melody/bass, favour 'N'). */
const NOISY_FLATNESS = 0.3;

function checkAbort(signal: AnalyzeOptions['signal']): void {
  if (signal?.aborted) throw new Error('cancelled');
}

function percentile(values: ArrayLike<number>, p: number): number {
  const a = Array.from(values).sort((x, y) => x - y);
  if (!a.length) return 0;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))]!;
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Moves each note start to the strongest onset-envelope peak within
 * [start − before, start + after] when that peak is clear (≥ `minPeak`
 * standard deviations); the long harmony window otherwise starts notes late.
 */
export function refineNoteStarts(notes: NoteSegment[], env: Float32Array, fps: number, before: number, after: number, minPeak: number): NoteSegment[] {
  const out = notes.map((n) => ({ ...n }));
  for (let i = 0; i < out.length; i++) {
    const n = out[i]!;
    const a = Math.max(0, Math.floor((n.startSec - before) * fps));
    const b = Math.min(env.length - 1, Math.ceil(Math.min(n.startSec + after, n.endSec - 0.05) * fps));
    let best = -1;
    let bv = minPeak;
    for (let f = a; f <= b; f++) {
      if (env[f]! > bv && env[f]! >= (env[f - 1] ?? 0) && env[f]! >= (env[f + 1] ?? 0)) {
        bv = env[f]!;
        best = f;
      }
    }
    if (best < 0) continue;
    const t = best / fps;
    const prev = out[i - 1];
    if (prev && t < prev.startSec + 0.05) continue;
    if (prev && prev.endSec > t) prev.endSec = t;
    n.startSec = t;
  }
  return out;
}

/** Bass-line candidates from the harmony pass's stored peaks. */
export function bassCandidates(h: HarmonyPass, silent: Uint8Array): Candidates {
  const grid = new SalienceGrid({ minMidi: 26, maxMidi: 55, harmonics: 8, alpha: 0.8, rangeDb: 40, weight: (hz) => 1 / (1 + (hz / 400) ** 2) });
  const midi = new Float32Array(h.frames * BASS_K);
  const sal = new Float32Array(h.frames * BASS_K);
  for (let f = 0; f < h.frames; f++) {
    grid.compute(h.peakHz, h.peakAmp, f * PEAKS_PER_FRAME, h.peakCount[f]!);
    grid.topPeaks(BASS_K, midi, sal, f * BASS_K);
  }
  return { frames: h.frames, k: BASS_K, fps: h.fps, midi, sal, silent };
}

function emptyResult(durationSec: number, sampleRate: number, warnings: string[]): SongAnalysis {
  return {
    durationSec: r3(durationSec),
    sampleRate,
    tuningCents: 0,
    bpm: 0,
    bpmAlternatives: [],
    beats: [],
    downbeatIndex: 0,
    beatConfidence: 0,
    key: { tonic: 0, mode: 'major', confidence: 0 },
    chords: durationSec > 0 ? [{ startSec: 0, endSec: r3(durationSec), root: null, quality: 'N', confidence: 1 }] : [],
    melody: [],
    bass: [],
    sections: [{ startSec: 0, label: 'A' }],
    warnings,
  };
}

/** Intermediate measures, for tests and diagnostics (not part of the public result). */
export interface SongAnalysisDetails {
  /** 0..1: how concentrated spectral peaks are around one tuning offset. */
  tuningConcentration: number;
  /** Median spectral flatness of the harmony pass (≈1 for white noise). */
  flatness: number;
  tempoStrength: number;
  downbeatScores: number[];
  downbeatConfidence: number;
  keyScores: number[];
  sectionNovelty: Float32Array;
  /** Per-beat section features: chroma (beats × 12) and band levels in dB (beats × 8). */
  sectionChroma: Float32Array;
  sectionLevels: Float32Array;
  elapsedMs: number;
}

export function analyzeSong(input: Float32Array, sampleRate: number, opts: AnalyzeOptions = {}): SongAnalysis {
  return analyzeSongDetailed(input, sampleRate, opts).analysis;
}

export function analyzeSongDetailed(input: Float32Array, sampleRate: number, opts: AnalyzeOptions = {}): { analysis: SongAnalysis; details: SongAnalysisDetails } {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = () => Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  const { signal } = opts;
  let lastStage = '';
  let lastFrac = -1;
  const progress = (fraction: number, stage: string) => {
    if (!opts.onProgress) return;
    const f = Math.max(0, Math.min(1, fraction));
    if (stage === lastStage && f - lastFrac < 0.01 && f < 1) return;
    lastStage = stage;
    lastFrac = f;
    opts.onProgress(f, stage);
  };
  if (!Number.isFinite(sampleRate) || sampleRate < 4000 || sampleRate > 384000) throw new Error('Unsupported sample rate');
  const warnings: string[] = [];
  let pcm = input;
  if (pcm.length > MAX_ANALYSIS_SEC * sampleRate) {
    pcm = pcm.subarray(0, Math.floor(MAX_ANALYSIS_SEC * sampleRate));
    warnings.push('Only the first 15 minutes were analysed.');
  }
  for (let i = 0; i < pcm.length; i++) {
    if (!Number.isFinite(pcm[i]!)) {
      pcm = pcm.map((x) => (Number.isFinite(x) ? x : 0));
      break;
    }
  }
  const durationSec = pcm.length / sampleRate;
  if (sampleRate < 16000) warnings.push('The sample rate is low, so high instruments and cymbals may be missed.');
  checkAbort(signal);
  progress(0, 'Listening for rhythm and melody');
  const rhythm: RhythmPass = runRhythmPass(pcm, sampleRate, signal, (f) => progress(0.45 * f, 'Listening for rhythm and melody'));
  checkAbort(signal);
  progress(0.45, 'Listening for harmony');
  const harmony: HarmonyPass = runHarmonyPass(pcm, sampleRate, signal, (f) => progress(0.45 + 0.37 * f, 'Listening for harmony'));
  checkAbort(signal);

  // Silence.
  const loud = percentile(rhythm.level, 0.95);
  const flat = percentile(harmony.flatness, 0.5);
  if (durationSec < 0.5 || loud < 1e-4) {
    warnings.push(durationSec < 0.5 ? 'The recording is too short to analyse.' : 'The recording is silent or almost silent, so nothing could be analysed.');
    progress(1, 'Done');
    return {
      analysis: emptyResult(durationSec, sampleRate, warnings),
      details: { tuningConcentration: 0, flatness: flat, tempoStrength: 0, downbeatScores: [], downbeatConfidence: 0, keyScores: [], sectionNovelty: new Float32Array(0), sectionChroma: new Float32Array(0), sectionLevels: new Float32Array(0), elapsedMs: elapsed() },
    };
  }
  if (durationSec < 10) warnings.push('The recording is very short, so tempo, key and sections are rough guesses.');

  // Tuning.
  progress(0.82, 'Finding the beat');
  const tuning = estimateTuning(harmony.peakHz, harmony.peakAmp, harmony.peakCount, PEAKS_PER_FRAME);
  // Spread-out deviations (drums, noise) carry no tuning information: assume standard pitch.
  const tuningReliable = tuning.concentration >= TUNING_MIN_CONCENTRATION;
  const tuningCents = tuningReliable ? Math.round(tuning.cents) : 0;

  // Beats.
  const fps = rhythm.fps;
  const env = normalizeEnvelope(rhythm.flux, Math.round(0.4 * fps));
  const tempo = estimateTempo(env, fps);
  checkAbort(signal);
  const periods = localPeriods(env, fps, tempo.period, signal);
  const score = localScore(env, tempo.period);
  const beatFrames = trackBeats(score, periods, 100, signal);
  checkAbort(signal);
  const beats = beatFrames.map((f) => f / fps - ONSET_LATENCY_SEC).filter((t) => t >= 0 && t < durationSec).map(r3);
  const ibis = beats.slice(1).map((b, i) => b - beats[i]!);
  const bpm = ibis.length ? 60 / median(ibis) : tempo.bpm;
  const beatConf = beatConfidence(env, beatFrames, tempo.strength);
  const alternatives = new Set<number>();
  for (const b of [bpm / 2, bpm * 2]) if (b >= 30 && b <= 300) alternatives.add(r2(b));
  if (tempo.runnerUp) {
    const rb = (60 * fps) / tempo.runnerUp;
    if ([...alternatives, bpm].every((a) => Math.abs(Math.log(a / rb)) > Math.log(1.06))) alternatives.add(r2(rb));
  }
  if (beats.length >= 4 && beatConf < 0.3) warnings.push('No steady beat was found; beat times are a rough guess.');
  if (ibis.length >= 16) {
    // Local tempo over 8-beat windows.
    const loc: number[] = [];
    for (let i = 0; i + 8 <= ibis.length; i += 4) loc.push(60 / median(ibis.slice(i, i + 8)));
    const lo = percentile(loc, 0.05);
    const hi = percentile(loc, 0.95);
    if (lo > 0 && hi / lo > 1.04 && beatConf >= 0.3) warnings.push('Tempo seems to drift; beat times follow it.');
  }

  // Beat-synchronous chroma over the whole song: [0, b0), [b0, b1), …, [bN, end).
  progress(0.87, 'Recognising chords');
  const fc = frameChroma(harmony, tuningCents);
  const bounds: number[] = [];
  const beatRow: number[] = []; // row index of the interval starting at beats[i]
  if (beats.length >= 2) {
    if (beats[0]! > 0.05) bounds.push(0);
    for (const b of beats) {
      beatRow.push(bounds.length);
      bounds.push(b);
    }
    bounds[0] = 0; // a first beat within 50 ms of the start owns the start
    if (durationSec - beats[beats.length - 1]! > 0.05) bounds.push(durationSec);
    else bounds[bounds.length - 1] = durationSec;
  } else {
    for (let t = 0; t < durationSec; t += 0.5) bounds.push(t);
    bounds.push(durationSec);
  }
  // A trailing beat must still own an interval.
  if (beatRow.length && beatRow[beatRow.length - 1]! >= bounds.length - 1) beatRow.pop();
  const bc = beatSyncChroma(fc, harmony.energy, bounds, harmony.flatness);
  const loudEnergy = percentile(harmony.energy, 0.9);
  const silentRows = new Uint8Array(bc.count);
  for (let i = 0; i < bc.count; i++) silentRows[i] = bc.energy[i]! < Math.max(1e-9, 1e-4 * loudEnergy) ? 1 : 0;
  const S = chordScores(bc, silentRows);
  const dec = decodeChords(S, bc.count);
  const chords = chordSegments(bounds.map(r3), dec.path, dec.posterior);
  checkAbort(signal);

  // Key (confidence scaled by how much of the sounding time has a chord).
  const durations = bounds.slice(1).map((b, i) => b - bounds[i]!);
  const keyRaw = keyFromProfile(songProfile(bc, durations, silentRows));
  let nTime = 0;
  let soundTime = 0;
  for (let i = 0; i < bc.count; i++) {
    if (silentRows[i]) continue;
    soundTime += durations[i]!;
    if (dec.path[i] === 0) nTime += durations[i]!;
  }
  const chordCoverage = soundTime > 0 ? 1 - nTime / soundTime : 0;
  const key = { ...keyRaw, confidence: r2(keyRaw.confidence * Math.min(1, chordCoverage / 0.5)) };

  // Downbeat (beat rows only).
  const nb = beatRow.length;
  const bt = new Float32Array(nb * 12);
  const bb = new Float32Array(nb * 12);
  const lowAt: number[] = [];
  const lowEnv = normalizeEnvelope(rhythm.lowFlux, Math.round(0.4 * fps));
  for (let i = 0; i < nb; i++) {
    const r = beatRow[i]!;
    bt.set(bc.treble.subarray(r * 12, r * 12 + 12), i * 12);
    bb.set(bc.bass.subarray(r * 12, r * 12 + 12), i * 12);
    const fr = Math.round((beats[i]! + ONSET_LATENCY_SEC) * fps);
    let m = 0;
    for (let j = fr - 3; j <= fr + 3; j++) if (j >= 0 && j < lowEnv.length) m = Math.max(m, lowEnv[j]!);
    lowAt.push(m);
  }
  const down = estimateDownbeat({ treble: bt, bass: bb, count: nb, lowOnset: lowAt });

  // Melody.
  progress(0.9, 'Following the melody');
  const melSilent = new Uint8Array(rhythm.frames);
  for (let f = 0; f < rhythm.frames; f++) {
    const hf = Math.min(harmony.frames - 1, Math.round((f / fps) * harmony.fps));
    melSilent[f] = rhythm.level[f]! < Math.max(1e-5, 0.003 * loud) || harmony.flatness[hf]! > NOISY_FLATNESS ? 1 : 0;
  }
  const melCand: Candidates = { frames: rhythm.frames, k: MELODY_K, fps, midi: rhythm.melMidi, sal: rhythm.melSal, silent: melSilent };
  const melTrack = trackContour(melCand, MELODY_PARAMS, signal);
  const melody: NoteSegment[] = segmentNotes(melTrack, fps, MELODY_PARAMS, tuningCents)
    .filter((n) => n.midi >= 45 && n.midi <= 87)
    .map((n) => ({ ...n, startSec: r3(n.startSec), endSec: r3(n.endSec) }));
  checkAbort(signal);

  // Bass.
  progress(0.94, 'Following the bass');
  const bassSilent = new Uint8Array(harmony.frames);
  for (let f = 0; f < harmony.frames; f++) bassSilent[f] = harmony.energy[f]! < Math.max(1e-10, 1e-5 * loudEnergy) || harmony.flatness[f]! > NOISY_FLATNESS ? 1 : 0;
  const bassTrack = trackContour(bassCandidates(harmony, bassSilent), BASS_PARAMS, signal);
  const bassRaw = segmentNotes(bassTrack, harmony.fps, BASS_PARAMS, tuningCents).filter((n) => n.midi >= 26 && n.midi <= 55);
  const bass: NoteSegment[] = refineNoteStarts(bassRaw, lowEnv, fps, 0.2, 0.06, 1.5).map((n) => ({ ...n, startSec: r3(n.startSec), endSec: r3(n.endSec) }));
  checkAbort(signal);

  // Sections on beat rows: chroma (cosine) + coarse band levels in dB (Gaussian, 3 dB scale).
  progress(0.98, 'Finding sections');
  const tim = new Float32Array(nb * TIMBRE_BANDS);
  for (let i = 0; i < nb; i++) {
    const s0 = beats[i]!;
    const s1 = i + 1 < nb ? beats[i + 1]! : Math.min(durationSec, s0 + (ibis[ibis.length - 1] ?? 0.5));
    const f0 = Math.max(0, Math.round(s0 * harmony.fps));
    const f1 = Math.min(harmony.frames, Math.max(f0 + 1, Math.round(s1 * harmony.fps)));
    for (let f = f0; f < f1; f++) for (let d = 0; d < TIMBRE_BANDS; d++) tim[i * TIMBRE_BANDS + d]! += (10 * harmony.timbre[f * TIMBRE_BANDS + d]!) / (f1 - f0);
  }
  const sec = segmentSections({
    count: nb,
    sets: [
      { data: bt, dim: 12, kind: 'cosine', weight: 1, sameLabel: 0.92 },
      { data: tim, dim: TIMBRE_BANDS, kind: 'gaussian', scale: 3, weight: 1, sameLabel: 0.6 },
    ],
  });
  const sections = nb
    ? sec.boundaries.map((b, i) => ({ startSec: i === 0 ? 0 : beats[b]!, label: sec.labels[i]! }))
    : [{ startSec: 0, label: 'A' }];

  // Warnings about content.
  if (flat > 0.35) warnings.push('The recording sounds mostly like noise, so chords and melody may be missing.');
  if (soundTime > 0 && chordCoverage < 0.4) warnings.push('Few clear chords were found.');
  if (melody.length < Math.max(2, durationSec / 30)) warnings.push('No clear melody line was found.');
  if (key.confidence < 0.3) warnings.push('The key is unclear; the song may change key or avoid a clear home chord.');
  if (Math.abs(tuningCents) >= 15 && tuningReliable) {
    warnings.push(`The recording is tuned about ${Math.abs(tuningCents)} cents ${tuningCents < 0 ? 'flat' : 'sharp'} of standard pitch (A = 440 Hz); notes and chords allow for this.`);
  }
  progress(1, 'Done');
  const analysis: SongAnalysis = {
    durationSec: r3(durationSec),
    sampleRate,
    tuningCents,
    bpm: beats.length >= 2 ? r2(bpm) : 0,
    bpmAlternatives: beats.length >= 2 ? [...alternatives] : [],
    beats,
    downbeatIndex: nb ? down.index : 0,
    beatConfidence: beatConf,
    key: { tonic: key.tonic, mode: key.mode, confidence: key.confidence },
    chords,
    melody,
    bass,
    sections,
    warnings,
  };
  const details: SongAnalysisDetails = {
    tuningConcentration: tuning.concentration,
    flatness: flat,
    tempoStrength: tempo.strength,
    downbeatScores: down.scores,
    downbeatConfidence: down.confidence,
    keyScores: key.scores,
    sectionNovelty: sec.novelty,
    sectionChroma: bt,
    sectionLevels: tim,
    elapsedMs: elapsed(),
  };
  return { analysis, details };
}
