/**
 * Predominant-line tracking over per-frame salience candidates, then note
 * segmentation. Used for both the melody and the bass line.
 *
 * Tracking is a Viterbi search over (K candidates + unvoiced) per frame:
 *   - a voiced candidate scores its salience relative to a song-level
 *     reference minus a voicing threshold, plus a small bonus for being the
 *     frame's strongest (voicing is relative to the frame and the song);
 *   - moving between candidates costs in proportion to the pitch distance,
 *     plus a fixed cost for a note change (continuity);
 *   - switching voicing on/off has a fixed cost.
 * Segmentation splits a voiced run where the (median-smoothed) pitch moves
 * ≥ 0.7 semitone from the current note for a few frames, or where the
 * tracked salience jumps up (re-attack of the same pitch); notes shorter than
 * the minimum are dropped; a note's pitch is the median of its frames.
 */
import type { NoteSegment } from './types';

export interface Candidates {
  frames: number;
  k: number;
  fps: number;
  midi: Float32Array;
  sal: Float32Array;
  /** Frames to skip (silence): forced unvoiced. */
  silent?: Uint8Array;
}

export interface TrackParams {
  /** Voicing threshold as a fraction of the song reference salience. */
  voicing: number;
  /** Bonus weight for the candidate's salience relative to the frame maximum. */
  frameRelative: number;
  /** Cost per semitone of pitch movement between frames. */
  slope: number;
  /** Extra cost of a jump ≥ 0.5 semitone. */
  jump: number;
  /** Cost of switching between voiced and unvoiced. */
  voicingSwitch: number;
  /** Song reference = this percentile of per-frame maximum salience. */
  refPercentile: number;
  minNoteSec: number;
  splitSemitones: number;
  /** Salience rise ratio (over `riseFrames`) that counts as a re-attack. */
  reattack: number;
  riseFrames: number;
  /** Frames the pitch must stay away before a pitch split. */
  splitFrames: number;
}

export const MELODY_PARAMS: TrackParams = {
  voicing: 0.3,
  frameRelative: 0.15,
  slope: 0.3,
  jump: 1.2,
  voicingSwitch: 0.6,
  refPercentile: 0.9,
  minNoteSec: 0.08,
  splitSemitones: 0.7,
  reattack: 1.7,
  riseFrames: 4,
  splitFrames: 3,
};

export const BASS_PARAMS: TrackParams = {
  voicing: 0.25,
  frameRelative: 0.15,
  slope: 0.3,
  jump: 0.9,
  voicingSwitch: 0.5,
  refPercentile: 0.9,
  minNoteSec: 0.12,
  splitSemitones: 0.7,
  reattack: 1.6,
  riseFrames: 2,
  splitFrames: 2,
};

export interface Track {
  /** MIDI float per frame (untuned), NaN when unvoiced. */
  pitch: Float32Array;
  sal: Float32Array;
  ref: number;
}

export function songReference(c: Candidates, percentile: number): number {
  const v: number[] = [];
  for (let f = 0; f < c.frames; f++) {
    const s = c.sal[f * c.k]!;
    if (s > 0 && !c.silent?.[f]) v.push(s);
  }
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(v.length * percentile))]!;
}

export function trackContour(c: Candidates, p: TrackParams, signal?: { aborted: boolean }): Track {
  const { frames, k } = c;
  const S = k + 1; // last state = unvoiced
  const pitch = new Float32Array(frames).fill(NaN);
  const salOut = new Float32Array(frames);
  const ref = songReference(c, p.refPercentile);
  if (frames === 0 || ref <= 0) return { pitch, sal: salOut, ref };
  const back = new Uint8Array(frames * S);
  let prev = new Float64Array(S);
  let cur = new Float64Array(S);
  const emit = (f: number, s: number): number => {
    if (s === k) return 0;
    const v = c.sal[f * k + s]!;
    if (v <= 0 || c.silent?.[f]) return -Infinity;
    const top = c.sal[f * k]!;
    return v / ref - p.voicing + p.frameRelative * (v / top - 1);
  };
  for (let s = 0; s < S; s++) prev[s] = emit(0, s);
  for (let f = 1; f < frames; f++) {
    if ((f & 8191) === 0 && signal?.aborted) throw new Error('cancelled');
    for (let s = 0; s < S; s++) {
      const e = emit(f, s);
      if (e === -Infinity) {
        cur[s] = -Infinity;
        back[f * S + s] = k;
        continue;
      }
      let best = -Infinity;
      let arg = k;
      for (let q = 0; q < S; q++) {
        const pv = prev[q]!;
        if (pv === -Infinity) continue;
        let cost: number;
        if (s === k && q === k) cost = 0;
        else if (s === k || q === k) cost = p.voicingSwitch;
        else {
          const d = Math.abs(c.midi[f * k + s]! - c.midi[(f - 1) * k + q]!);
          cost = p.slope * d + (d >= 0.5 ? p.jump : 0);
        }
        const v = pv - cost;
        if (v > best) {
          best = v;
          arg = q;
        }
      }
      cur[s] = best + e;
      back[f * S + s] = arg;
    }
    [prev, cur] = [cur, prev];
  }
  let last = k;
  for (let s = 0; s < S; s++) if (prev[s]! > prev[last]!) last = s;
  for (let f = frames - 1; f >= 0; f--) {
    if (last !== k) {
      pitch[f] = c.midi[f * k + last]!;
      salOut[f] = c.sal[f * k + last]!;
    }
    last = back[f * S + last]!;
  }
  return { pitch, sal: salOut, ref };
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function segmentNotes(track: Track, fps: number, p: TrackParams, tuningCents: number): NoteSegment[] {
  const { pitch, sal, ref } = track;
  const n = pitch.length;
  const notes: NoteSegment[] = [];
  // Median-smoothed pitch (5 frames, voiced only).
  const sm = new Float32Array(n).fill(NaN);
  for (let f = 0; f < n; f++) {
    if (Number.isNaN(pitch[f]!)) continue;
    const w: number[] = [];
    for (let j = f - 2; j <= f + 2; j++) if (j >= 0 && j < n && !Number.isNaN(pitch[j]!)) w.push(pitch[j]!);
    sm[f] = median(w);
  }
  const minFrames = Math.max(1, Math.round(p.minNoteSec * fps));
  const emit = (a: number, b: number) => {
    // frames [a, b)
    if (b - a < minFrames) return;
    const ps: number[] = [];
    let ss = 0;
    for (let f = a; f < b; f++) {
      ps.push(pitch[f]!);
      ss += sal[f]!;
    }
    const midi = Math.round(median(ps) - tuningCents / 100);
    notes.push({
      startSec: a / fps,
      endSec: b / fps,
      midi,
      confidence: Math.round(100 * Math.min(1, ss / (b - a) / ref)) / 100,
    });
  };
  let f = 0;
  while (f < n) {
    if (Number.isNaN(pitch[f]!)) {
      f++;
      continue;
    }
    let start = f;
    let refPitch = sm[f]!;
    const hist: number[] = [sm[f]!];
    let away = 0;
    f++;
    while (f < n && !Number.isNaN(pitch[f]!)) {
      const d = Math.abs(sm[f]! - refPitch);
      away = d >= p.splitSemitones ? away + 1 : 0;
      const back = f - p.riseFrames;
      const rise = back >= start && sal[back]! > 0 ? sal[f]! / sal[back]! : 0;
      if (away >= p.splitFrames) {
        const cut = f - p.splitFrames + 1;
        emit(start, cut);
        start = cut;
        hist.length = 0;
        for (let j = cut; j <= f; j++) hist.push(sm[j]!);
        refPitch = median(hist);
        away = 0;
      } else if (rise >= p.reattack && f - start >= minFrames && sal[f]! > 0.5 * ref * p.voicing) {
        // Re-attack: cut where the rise begins (largest single-frame increase).
        let cut = back + 1;
        let bestInc = 0;
        for (let j = back + 1; j <= f; j++) {
          const inc = sal[j]! - sal[j - 1]!;
          if (inc > bestInc) {
            bestInc = inc;
            cut = j;
          }
        }
        emit(start, cut);
        start = cut;
        hist.length = 0;
        for (let j = cut; j <= f; j++) hist.push(sm[j]!);
        refPitch = median(hist);
      } else {
        hist.push(sm[f]!);
        if (hist.length > 30) hist.shift();
        refPitch = median(hist);
      }
      f++;
    }
    emit(start, f);
  }
  return notes;
}
