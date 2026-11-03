/**
 * Experimental monophonic transcription of a *clean, isolated* guitar recording
 * (master spec §7.3, M4). Uses the same analyzer as live listening. Produces:
 *   1. raw candidates (unquantized seconds, pitch, quality, reasons),
 *   2. a tempo/downbeat estimate with half/double alternatives,
 *   3. a quantized candidate arrangement (role transcription_candidate,
 *      method model_candidate, review required).
 * Raw and quantized results are kept separately; low-quality notes are listed
 * as uncertain regions instead of being forced into the score.
 */
import { StreamAnalyzer } from './dsp/analyzer';
import type { AttackObservation, PitchFrame } from './observations';
import { PPQ, type NoteEvent, type Rights, type Score } from '../domain/score';
import { blankScore, BAR_TICKS } from '../domain/edit';
import { FULL_NECK_PROFILE, planFingering, type FingeringProfile } from '../domain/fingering';

export const TRANSCRIBER_ID = 'gu-dsp-mono';
export const TRANSCRIBER_VERSION = '1';

export interface RawNote {
  onsetSec: number;
  offsetSec: number;
  midi: number;
  /** 1 − median YIN aperiodicity: a raw score, not a calibrated probability. */
  score: number | null;
}

export interface Uncertain {
  onsetSec: number;
  reason: string;
}

export interface RawTranscription {
  notes: RawNote[];
  uncertain: Uncertain[];
  durationSec: number;
  sampleRate: number;
  elapsedMs: number;
}

export function transcribeRaw(pcm: Float32Array, sampleRate: number, onProgress?: (fraction: number) => void, isCancelled?: () => boolean): RawTranscription {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const an = new StreamAnalyzer({ sampleRate });
  const attacks: AttackObservation[] = [];
  const frames: PitchFrame[] = [];
  const chunk = 4096;
  for (let o = 0; o < pcm.length; o += chunk) {
    if (isCancelled?.()) throw new Error('cancelled');
    for (const x of an.push(pcm.subarray(o, o + chunk), o)) {
      if (x.type === 'attack') attacks.push(x.attack);
      else frames.push(x.frame);
    }
    if (onProgress && (o / chunk) % 32 === 0) onProgress(Math.min(1, o / pcm.length));
  }
  // Flush: a final attack needs ~140 ms of audio after it.
  for (const x of an.push(new Float32Array(Math.round(sampleRate * 0.3)), pcm.length)) {
    if (x.type === 'attack') attacks.push(x.attack);
  }
  const durationSec = pcm.length / sampleRate;
  const notes: RawNote[] = [];
  const uncertain: Uncertain[] = [];
  attacks.sort((a, b) => a.onsetContextSec - b.onsetContextSec);
  attacks.forEach((a, i) => {
    if (a.quality !== 'good' || a.pitchMidiFloat === null) {
      uncertain.push({ onsetSec: a.onsetContextSec, reason: a.reasonCodes[0] ?? 'no_stable_pitch' });
      return;
    }
    const next = attacks[i + 1]?.onsetContextSec ?? durationSec;
    // Offset: first sustained drop below the gate, or pitch leaving the note, before the next onset.
    let offset = next;
    let quiet = 0;
    let drift = 0;
    for (const f of frames) {
      if (f.hopStartSec < a.onsetContextSec + 0.08) continue;
      if (f.hopStartSec >= next) break;
      const below = f.reasonCodes.includes('below_gate');
      const off = f.midiFloat !== null && f.pitchQuality === 'good' && Math.abs(f.midiFloat - a.pitchMidiFloat) * 100 > 100;
      quiet = below ? quiet + 1 : 0;
      drift = off ? drift + 1 : 0;
      if (quiet >= 2 || drift >= 3) {
        offset = f.hopStartSec;
        break;
      }
    }
    notes.push({ onsetSec: a.onsetContextSec, offsetSec: Math.max(offset, a.onsetContextSec + 0.05), midi: a.pitchMidiFloat, score: a.modelScore });
  });
  onProgress?.(1);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { notes, uncertain, durationSec, sampleRate, elapsedMs: Math.round(now - t0) };
}

export interface TempoEstimate {
  bpm: number;
  firstBeatSec: number;
  alternatives: number[];
  /** 0..1 grid fit of onsets to the chosen beat grid (not a probability). */
  fit: number;
}

/** Tempo + phase by scoring a beat grid against onset times (60–160 BPM search). */
export function estimateTempo(onsets: readonly number[]): TempoEstimate | null {
  if (onsets.length < 3) return null;
  const sigma = 0.025;
  let best = { bpm: 0, phase: 0, score: -1 };
  for (let bpm = 50; bpm <= 180; bpm += 0.5) {
    const beat = 60 / bpm;
    for (let ph = 0; ph < beat; ph += 0.01) {
      let score = 0;
      for (const t of onsets) {
        // Distance to the nearest eighth-note grid point; beats weigh more than off-beats.
        const pos = (t - ph) / beat;
        const db = Math.abs(pos - Math.round(pos)) * beat;
        const de = Math.abs(pos * 2 - Math.round(pos * 2)) * (beat / 2);
        score += Math.exp(-(db * db) / (2 * sigma * sigma)) + 0.5 * Math.exp(-(de * de) / (2 * sigma * sigma));
      }
      // Mild preference for moderate tempi (avoid always choosing the fastest grid).
      score *= Math.exp(-(((bpm - 90) / 60) ** 2) * 0.5);
      if (score > best.score) best = { bpm, phase: ph, score };
    }
  }
  const beat = 60 / best.bpm;
  const first = Math.min(...onsets);
  // First beat at or just before the first onset on the chosen phase.
  const k = Math.floor((first - best.phase) / beat + 0.25);
  const firstBeatSec = best.phase + k * beat;
  const onBeat = onsets.filter((t) => {
    const pos = (t - best.phase) / (beat / 2);
    return Math.abs(pos - Math.round(pos)) * (beat / 2) < 0.05;
  }).length;
  return { bpm: best.bpm, firstBeatSec, alternatives: [best.bpm / 2, best.bpm * 2].filter((b) => b >= 30 && b <= 300), fit: onBeat / onsets.length };
}

export interface QuantizeOptions {
  bpm: number;
  firstBeatSec: number;
  /** Grid subdivisions per beat: 1 quarter, 2 eighth, 4 sixteenth. */
  division: 1 | 2 | 4;
}

export interface Quantized {
  startTick: number;
  durationTicks: number;
  midi: number;
  raw: RawNote;
}

export function quantize(notes: readonly RawNote[], o: QuantizeOptions): Quantized[] {
  const beat = 60 / o.bpm;
  const grid = PPQ / o.division;
  const q = (sec: number) => Math.round(((sec - o.firstBeatSec) / beat) * o.division) * grid || 0;
  const out: Quantized[] = [];
  for (const n of notes) {
    const start = q(n.onsetSec);
    let dur = Math.max(grid, q(n.offsetSec) - start);
    if (out.length && out[out.length - 1]!.startTick === start) {
      // Two candidates on one grid point: keep the higher-scoring one.
      if ((n.score ?? 0) > (out[out.length - 1]!.raw.score ?? 0)) out[out.length - 1] = { startTick: start, durationTicks: dur, midi: Math.round(n.midi), raw: n };
      continue;
    }
    dur = Math.min(dur, 4 * PPQ * 2);
    out.push({ startTick: start, durationTicks: dur, midi: Math.round(n.midi), raw: n });
  }
  // Monophonic: trim overlaps.
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i]!;
    const b = out[i + 1]!;
    if (a.startTick + a.durationTicks > b.startTick) a.durationTicks = Math.max(grid, b.startTick - a.startTick);
  }
  return out;
}

export interface CandidateResult {
  score: Score | null;
  reason: string | null;
  /** Events dropped because no fingering exists in the chosen range. */
  unplayable: number[];
  shiftTicks: number;
}

/** Build a review-required candidate arrangement from quantized notes. */
export function buildCandidate(opts: {
  arrangementId: string;
  title: string;
  quantized: Quantized[];
  bpm: number;
  firstBeatSec: number;
  rights: Rights;
  source?: { assetId: string; sha256: string; durationSec: number };
  profile?: FingeringProfile;
}): CandidateResult {
  const profile = opts.profile ?? FULL_NECK_PROFILE;
  if (!opts.quantized.length) return { score: null, reason: 'low_signal', unplayable: [], shiftTicks: 0 };
  // A pickup before the first downbeat shifts everything by whole bars.
  const minTick = Math.min(...opts.quantized.map((q) => q.startTick));
  const shiftTicks = minTick < 0 ? Math.ceil(-minTick / BAR_TICKS) * BAR_TICKS : 0;
  const plan = planFingering(opts.quantized.map((q) => q.midi), profile);
  const unplayable = plan.ok ? [] : plan.impossibleIndexes;
  const keep = opts.quantized.map((q, i) => ({ q, i })).filter(({ i }) => !unplayable.includes(i));
  const plan2 = planFingering(keep.map(({ q }) => q.midi), profile);
  if (!plan2.ok || !keep.length) return { score: null, reason: 'no_playable_fingering', unplayable, shiftTicks };
  const events: NoteEvent[] = keep.map(({ q }, j) => {
    const p = plan2.positions[j]!;
    return {
      id: `t${j + 1}`,
      kind: 'note',
      startTick: q.startTick + shiftTicks,
      durationTicks: q.durationTicks,
      pitchMidi: q.midi,
      string: p.string,
      fret: p.fret,
      finger: p.finger,
      sourceEventIds: [],
      assessment: { pitch: true, attack: true, sustain: false },
    };
  });
  const end = Math.max(...events.map((e) => e.startTick + e.durationTicks));
  const bars = Math.max(1, Math.ceil(end / BAR_TICKS));
  const base = blankScore({ arrangementId: opts.arrangementId, title: opts.title, bpm: opts.bpm, bars, rights: opts.rights, createdBy: `${TRANSCRIBER_ID} ${TRANSCRIBER_VERSION}` });
  const beat = 60 / opts.bpm;
  const tick0Sec = opts.firstBeatSec - (shiftTicks / PPQ) * beat;
  const score: Score = {
    ...base,
    role: 'transcription_candidate',
    events,
    provenance: {
      ...base.provenance,
      method: 'model_candidate',
      reviewStatus: 'unreviewed',
      providerId: TRANSCRIBER_ID,
      providerVersion: TRANSCRIBER_VERSION,
      modelArtifactSha256: null,
      notes: `Experimental monophonic transcription (no ML model). ${events.length} notes; ${unplayable.length} without a fingering in frets ${profile.minFret}–${profile.maxFret}. Needs review before it is used for assessment.`,
    },
  };
  if (opts.source && tick0Sec >= 0) {
    const endSec = Math.min(opts.source.durationSec, tick0Sec + (bars * BAR_TICKS * beat) / PPQ);
    if (endSec > tick0Sec) {
      score.sourceAudio = {
        assetId: opts.source.assetId,
        sha256: opts.source.sha256,
        durationSec: Math.min(180, opts.source.durationSec),
        rights: opts.rights,
        alignmentStatus: 'candidate',
        anchors: [
          { tick: 0, sourceSec: Math.round(tick0Sec * 1000) / 1000 },
          { tick: Math.round(((endSec - tick0Sec) / beat) * PPQ), sourceSec: Math.round(endSec * 1000) / 1000 },
        ],
      };
    }
  }
  return { score, reason: null, unplayable, shiftTicks };
}

/** Note-level F-measure (onset ±50 ms, pitch ±50 cents); optional offset check (max(50 ms, 20 % of duration)). */
export function noteF1(ref: readonly { onsetSec: number; offsetSec: number; midi: number }[], est: readonly RawNote[], withOffset = false): { precision: number; recall: number; f1: number } {
  const used = new Set<number>();
  let tp = 0;
  for (const r of ref) {
    const j = est.findIndex((e, i) => {
      if (used.has(i)) return false;
      if (Math.abs(e.onsetSec - r.onsetSec) > 0.05 || Math.abs(e.midi - r.midi) * 100 > 50) return false;
      if (withOffset) {
        const tol = Math.max(0.05, 0.2 * (r.offsetSec - r.onsetSec));
        if (Math.abs(e.offsetSec - r.offsetSec) > tol) return false;
      }
      return true;
    });
    if (j >= 0) {
      used.add(j);
      tp++;
    }
  }
  const precision = est.length ? tp / est.length : 0;
  const recall = ref.length ? tp / ref.length : 0;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
}
