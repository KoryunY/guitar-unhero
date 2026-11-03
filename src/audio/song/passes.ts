/**
 * The two streaming spectral passes. Neither keeps a spectrogram: each frame's
 * spectrum is reduced immediately to a few numbers.
 *
 *  - Rhythm/melody pass (22 050 Hz, 1024-point Hann, ≈10 ms hop): onset flux
 *    (all bands and < 200 Hz), frame level, and the strongest melody-range
 *    salience peaks (MIDI 45–87).
 *  - Harmony pass (11 025 Hz, 4096-point Hann, ≈46 ms hop): up to 48 spectral
 *    peaks per frame (30–2600 Hz; later turned into tuning, chroma and bass
 *    salience), 8 coarse log band energies (timbre), frame energy and
 *    spectral flatness.
 */
import { ResampledReader, frameCount } from './resample';
import { RealFFT, hann, pickPeaks } from './spectrum';
import { BandFlux } from './novelty';
import { SalienceGrid } from './salience';

type Signal = { aborted: boolean } | undefined;
type Progress = ((fraction: number) => void) | undefined;

export const RHYTHM_RATE = 22050;
export const HARMONY_RATE = 11025;
export const MELODY_K = 5;
export const PEAKS_PER_FRAME = 48;
export const TIMBRE_BANDS = 8;
const TIMBRE_EDGES = [30, 120, 250, 500, 1000, 2000, 3000, 4000, 5400];

export interface RhythmPass {
  sampleRate: number;
  hop: number;
  fps: number;
  frames: number;
  flux: Float32Array;
  lowFlux: Float32Array;
  /** Frame RMS (windowed). */
  level: Float32Array;
  /** MELODY_K salience peaks per frame: MIDI float (untuned) and salience. */
  melMidi: Float32Array;
  melSal: Float32Array;
}

export interface HarmonyPass {
  sampleRate: number;
  hop: number;
  fps: number;
  frames: number;
  peakCount: Uint8Array;
  peakHz: Float32Array;
  peakAmp: Float32Array;
  timbre: Float32Array;
  energy: Float32Array;
  flatness: Float32Array;
}

/** Equal-loudness-like emphasis for melody peaks: suppress < ~180 Hz and > ~6 kHz. */
export function melodyWeight(hz: number): number {
  return 1 / (1 + (180 / hz) ** 4) / (1 + (hz / 6000) ** 2);
}

export function runRhythmPass(pcm: Float32Array, inRate: number, signal: Signal, progress: Progress): RhythmPass {
  const sr = RHYTHM_RATE;
  const reader = new ResampledReader(pcm, inRate, sr);
  const N = 1024;
  const hop = Math.round(sr * 0.01);
  const frames = frameCount(reader.length, hop);
  const bins = N / 2 + 1;
  const binHz = sr / N;
  const fft = new RealFFT(N);
  const win = hann(N);
  const frame = new Float32Array(N);
  const mag = new Float32Array(bins);
  const scratch = new Float32Array(bins);
  const flux = new BandFlux(binHz, bins, { fftSize: N, lag: 2 });
  const grid = new SalienceGrid({ minMidi: 45, maxMidi: 87, harmonics: 10, alpha: 0.8, rangeDb: 40, weight: melodyWeight });
  const pkHz = new Float32Array(40);
  const pkAmp = new Float32Array(40);
  const out: RhythmPass = {
    sampleRate: sr,
    hop,
    fps: sr / hop,
    frames,
    flux: new Float32Array(frames),
    lowFlux: new Float32Array(frames),
    level: new Float32Array(frames),
    melMidi: new Float32Array(frames * MELODY_K),
    melSal: new Float32Array(frames * MELODY_K),
  };
  for (let j = 0; j < frames; j++) {
    if ((j & 1023) === 0) {
      if (signal?.aborted) throw new Error('cancelled');
      progress?.(j / frames);
    }
    reader.read(j * hop - N / 2, N, frame);
    let e = 0;
    for (let i = 0; i < N; i++) {
      const x = frame[i]! * win[i]!;
      frame[i] = x;
      e += x * x;
    }
    out.level[j] = Math.sqrt(e / (N * 0.375));
    fft.magnitude(frame, mag);
    const f = flux.push(mag);
    out.flux[j] = f.full;
    out.lowFlux[j] = f.low;
    const n = e > 1e-10 ? pickPeaks(mag, bins, binHz, { minHz: 80, maxHz: 5000, prominence: 2, localBins: 8, rangeDb: 50, maxPeaks: 40 }, pkHz, pkAmp, scratch) : 0;
    grid.compute(pkHz, pkAmp, 0, n);
    grid.topPeaks(MELODY_K, out.melMidi, out.melSal, j * MELODY_K);
  }
  return out;
}

export function runHarmonyPass(pcm: Float32Array, inRate: number, signal: Signal, progress: Progress): HarmonyPass {
  const sr = HARMONY_RATE;
  const reader = new ResampledReader(pcm, inRate, sr);
  const N = 4096;
  const hop = 512;
  const frames = frameCount(reader.length, hop);
  const bins = N / 2 + 1;
  const binHz = sr / N;
  const fft = new RealFFT(N);
  const win = hann(N);
  const frame = new Float32Array(N);
  const mag = new Float32Array(bins);
  const scratch = new Float32Array(bins);
  const pkHz = new Float32Array(PEAKS_PER_FRAME);
  const pkAmp = new Float32Array(PEAKS_PER_FRAME);
  const tb = TIMBRE_EDGES.map((f) => Math.min(bins - 1, Math.round(f / binHz)));
  const flatLo = Math.round(100 / binHz);
  const flatHi = Math.min(bins - 1, Math.round(5000 / binHz));
  const out: HarmonyPass = {
    sampleRate: sr,
    hop,
    fps: sr / hop,
    frames,
    peakCount: new Uint8Array(frames),
    peakHz: new Float32Array(frames * PEAKS_PER_FRAME),
    peakAmp: new Float32Array(frames * PEAKS_PER_FRAME),
    timbre: new Float32Array(frames * TIMBRE_BANDS),
    energy: new Float32Array(frames),
    flatness: new Float32Array(frames),
  };
  const norm = 1 / (N / 4);
  for (let j = 0; j < frames; j++) {
    if ((j & 255) === 0) {
      if (signal?.aborted) throw new Error('cancelled');
      progress?.(j / frames);
    }
    reader.read(j * hop - N / 2, N, frame);
    let e = 0;
    for (let i = 0; i < N; i++) {
      const x = frame[i]! * win[i]!;
      frame[i] = x;
      e += x * x;
    }
    out.energy[j] = e / (N * 0.375);
    if (e < 1e-12) {
      out.timbre.fill(-10, j * TIMBRE_BANDS, (j + 1) * TIMBRE_BANDS);
      out.flatness[j] = 1;
      continue;
    }
    fft.magnitude(frame, mag);
    for (let k = 0; k < bins; k++) mag[k]! *= norm;
    for (let b = 0; b < TIMBRE_BANDS; b++) {
      let s = 0;
      for (let k = tb[b]!; k < tb[b + 1]!; k++) s += mag[k]! * mag[k]!;
      out.timbre[j * TIMBRE_BANDS + b] = Math.log10(1e-10 + s);
    }
    // Spectral flatness on every 4th bin (≈10.8 Hz spacing is plenty for this measure).
    let lg = 0;
    let ar = 0;
    let cnt = 0;
    for (let k = flatLo; k <= flatHi; k += 4) {
      const p = mag[k]! * mag[k]! + 1e-14;
      lg += Math.log(p);
      ar += p;
      cnt++;
    }
    out.flatness[j] = Math.exp(lg / cnt) / (ar / cnt);
    const n = pickPeaks(mag, bins, binHz, { minHz: 30, maxHz: 2600, prominence: 2, localBins: 12, rangeDb: 60, maxPeaks: PEAKS_PER_FRAME }, pkHz, pkAmp, scratch);
    out.peakCount[j] = n;
    out.peakHz.set(pkHz.subarray(0, n), j * PEAKS_PER_FRAME);
    out.peakAmp.set(pkAmp.subarray(0, n), j * PEAKS_PER_FRAME);
  }
  return out;
}
