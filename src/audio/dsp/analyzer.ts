/**
 * Streaming input analyzer: DC removal, block RMS/peak, clipping, adaptive noise
 * floor, energy-rise onset candidates, YIN pitch frames, and stabilized attack
 * observations. Pure and synchronous so it runs identically in a Web Worker and
 * in unit tests.
 *
 * Time convention (master spec AUD-04): every result is stamped from the sample
 * frames it analyzed, converted to AudioContext seconds as frame / sampleRate.
 * Processing delay never changes the musical time assigned to an observation.
 *   - Pitch frame time: centre of the analysis buffer.
 *   - Onset time: start of the first 64-sample sub-block whose smoothed energy
 *     rose ≥ ONSET_RISE_DB above the recent minimum and above the signal gate.
 */
import { Yin } from './yin';
import type { AttackObservation, PitchFrame, SignalQuality } from '../observations';

export interface AnalyzerConfig {
  sampleRate: number;
  bufferSize: number;
  hop: number;
  minHz: number;
  maxHz: number;
  providerId: string;
}

export type AnalyzerOutput = { type: 'frame'; frame: PitchFrame } | { type: 'attack'; attack: AttackObservation };

export const ANALYZER_PROVIDER_ID = 'gu-yin-energy/1';

const SUB = 64; // onset sub-block size in samples
const ONSET_RISE_DB = 7;
const ONSET_LOOKBACK_SEC = 0.05;
const ONSET_REFRACTORY_SEC = 0.09;
const GATE_ABOVE_NOISE_DB = 12;
const ABSOLUTE_GATE_DB = -58;
const CLIP_LEVEL = 0.985;
const NOISY_FLOOR_DB = -38;
const GOOD_APERIODICITY = 0.2;
const INITIAL_NOISE_FLOOR_DB = -70;
const NOISE_RISE_DB_PER_HOP = 0.03;
/** Attack pitch uses frames whose whole buffer lies after the onset, up to this long after it. */
const ATTACK_COLLECT_SEC = 0.05;
const ATTACK_MIN_FRAMES = 2;
const ATTACK_MAX_SPREAD_CENTS = 45;

function db(x: number): number {
  return x > 1e-10 ? 20 * Math.log10(x) : -200;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : 0.5 * (s[m - 1]! + s[m]!);
}

interface PendingAttack {
  onsetFrame: number;
  peak: number;
  clipped: boolean;
  midis: number[];
  hzs: number[];
  aper: number[];
  deadlineFrame: number;
}

export class StreamAnalyzer {
  readonly cfg: AnalyzerConfig;
  private readonly yin: Yin;
  private readonly ring: Float32Array;
  private readonly lin: Float32Array;
  private writePos = 0;
  /** Absolute index (context sample frame) of the next sample to be written. */
  private nextFrame: number | null = null;
  private sinceHop = 0;
  // DC blocker state
  private dcX = 0;
  private dcY = 0;
  private readonly dcR: number;
  // block stats since last hop
  private hopSumSq = 0;
  private hopPeak = 0;
  private hopClipCount = 0;
  // onset state
  private subSumSq = 0;
  private subCount = 0;
  private readonly subLevels: number[] = [];
  private smoothDb = -200;
  private lastOnsetFrame = -Infinity;
  private noiseFloorDb: number | null = null;
  private pending: PendingAttack | null = null;
  private attackSeq = 0;
  private frameSeq = 0;

  constructor(cfg: Partial<AnalyzerConfig> & { sampleRate: number }) {
    this.cfg = { bufferSize: 4096, hop: 512, minHz: 60, maxHz: 1500, providerId: ANALYZER_PROVIDER_ID, ...cfg };
    this.yin = new Yin({ sampleRate: this.cfg.sampleRate, bufferSize: this.cfg.bufferSize, minHz: this.cfg.minHz, maxHz: this.cfg.maxHz });
    this.ring = new Float32Array(this.cfg.bufferSize);
    this.lin = new Float32Array(this.cfg.bufferSize);
    this.dcR = 1 - (2 * Math.PI * 15) / this.cfg.sampleRate; // ≈15 Hz high-pass
  }

  get noiseFloor(): number | null {
    return this.noiseFloorDb;
  }

  private gateDb(): number {
    return Math.max(ABSOLUTE_GATE_DB, (this.noiseFloorDb ?? INITIAL_NOISE_FLOOR_DB) + GATE_ABOVE_NOISE_DB);
  }

  /** Reset onset/attack state (e.g. after a reference tone or device change). */
  resetAttackState(): void {
    this.pending = null;
    this.lastOnsetFrame = -Infinity;
    this.subLevels.length = 0;
  }

  /** Feed a chunk of mono PCM whose first sample is context frame `startFrame`. */
  push(chunk: Float32Array, startFrame: number): AnalyzerOutput[] {
    const out: AnalyzerOutput[] = [];
    if (this.nextFrame !== null && startFrame !== this.nextFrame) {
      // Discontinuity (dropped/duplicated buffers): restart onset tracking honestly.
      this.resetAttackState();
      this.sinceHop = 0;
      this.hopSumSq = 0;
      this.hopPeak = 0;
      this.hopClipCount = 0;
    }
    for (let i = 0; i < chunk.length; i++) {
      const frame = startFrame + i;
      const raw = chunk[i]!;
      const absRaw = Math.abs(raw);
      // DC removal
      const y = raw - this.dcX + this.dcR * this.dcY;
      this.dcX = raw;
      this.dcY = y;
      this.ring[this.writePos] = y;
      this.writePos = (this.writePos + 1) % this.ring.length;

      this.hopSumSq += y * y;
      if (absRaw > this.hopPeak) this.hopPeak = absRaw;
      if (absRaw >= CLIP_LEVEL) this.hopClipCount++;

      this.subSumSq += y * y;
      this.subCount++;
      if (this.subCount === SUB) {
        this.onSubBlock(frame - SUB + 1);
        this.subSumSq = 0;
        this.subCount = 0;
      }
      if (this.pending) {
        if (absRaw > this.pending.peak) this.pending.peak = absRaw;
        if (absRaw >= CLIP_LEVEL) this.pending.clipped = true;
      }

      this.sinceHop++;
      if (this.sinceHop >= this.cfg.hop) {
        this.sinceHop = 0;
        const f = this.analyzeHop(frame + 1);
        out.push({ type: 'frame', frame: f });
        this.feedPending(f, frame + 1);
        while (this.finished.length) out.push({ type: 'attack', attack: this.finished.shift()! });
      }
    }
    this.nextFrame = startFrame + chunk.length;
    return out;
  }

  private onSubBlock(subStartFrame: number): void {
    const rms = Math.sqrt(this.subSumSq / SUB);
    const level = db(rms);
    // light smoothing (~3 sub-blocks)
    this.smoothDb = this.smoothDb < -150 ? level : 0.5 * this.smoothDb + 0.5 * level;
    const sr = this.cfg.sampleRate;
    const lookback = Math.max(1, Math.round((ONSET_LOOKBACK_SEC * sr) / SUB));
    let recentMin = Infinity;
    for (const v of this.subLevels) if (v < recentMin) recentMin = v;
    this.subLevels.push(this.smoothDb);
    if (this.subLevels.length > lookback) this.subLevels.shift();
    if (recentMin === Infinity) return;
    const gate = this.gateDb();
    const refractory = (subStartFrame - this.lastOnsetFrame) / sr < ONSET_REFRACTORY_SEC;
    if (!refractory && this.smoothDb > gate && this.smoothDb - Math.max(recentMin, gate - ONSET_RISE_DB - 6) >= ONSET_RISE_DB) {
      this.lastOnsetFrame = subStartFrame;
      this.startAttack(subStartFrame);
    }
  }

  private startAttack(onsetFrame: number): void {
    const sr = this.cfg.sampleRate;
    // A new attack finalizes an unfinished one with whatever evidence it has.
    if (this.pending) this.finished.push(this.finalize(this.pending, onsetFrame, 'superseded_by_new_attack'));
    this.pending = {
      onsetFrame,
      peak: 0,
      clipped: false,
      midis: [],
      hzs: [],
      aper: [],
      deadlineFrame: onsetFrame + this.cfg.bufferSize + Math.round(ATTACK_COLLECT_SEC * sr),
    };
  }

  private readonly finished: AttackObservation[] = [];

  private analyzeHop(endFrame: number): PitchFrame {
    const sr = this.cfg.sampleRate;
    const n = this.cfg.hop;
    const rms = Math.sqrt(this.hopSumSq / n);
    const rmsDb = db(rms);
    const peakDb = db(this.hopPeak);
    const clipped = this.hopClipCount >= 3;
    this.hopSumSq = 0;
    this.hopPeak = 0;
    this.hopClipCount = 0;

    const startFrame = endFrame - this.cfg.bufferSize;
    const filled = this.nextFrame !== null || endFrame >= this.cfg.bufferSize;
    let hz: number | null = null;
    let aperiodicity = 1;
    const aboveGate = rmsDb > this.gateDb();
    if (aboveGate && filled) {
      // linearize ring (oldest first)
      const L = this.ring.length;
      const tail = L - this.writePos;
      this.lin.set(this.ring.subarray(this.writePos), 0);
      this.lin.set(this.ring.subarray(0, this.writePos), tail);
      const r = this.yin.detect(this.lin);
      hz = r.hz;
      aperiodicity = r.aperiodicity;
    }
    // Adaptive noise floor: falls quickly; rises slowly (≈3 dB/s) and never while a
    // clearly periodic note is sounding, so a long-held string is not absorbed.
    const nf = this.noiseFloorDb ?? INITIAL_NOISE_FLOOR_DB;
    const periodic = hz !== null && aperiodicity <= GOOD_APERIODICITY;
    if (rmsDb < nf) this.noiseFloorDb = 0.7 * nf + 0.3 * Math.max(rmsDb, -96);
    else if (!periodic) this.noiseFloorDb = nf + Math.min(NOISE_RISE_DB_PER_HOP, rmsDb - nf);
    else this.noiseFloorDb = nf;
    const noisy = (this.noiseFloorDb ?? -96) > NOISY_FLOOR_DB;
    const inputQuality: SignalQuality = clipped || noisy ? 'poor' : 'good';
    let pitchQuality: SignalQuality = 'unavailable';
    if (hz !== null) pitchQuality = aperiodicity <= GOOD_APERIODICITY && !clipped ? 'good' : 'poor';
    const reasonCodes: string[] = [];
    if (clipped) reasonCodes.push('clipping');
    if (noisy) reasonCodes.push('noisy_input');
    if (!aboveGate) reasonCodes.push('below_gate');
    else if (hz === null) reasonCodes.push('no_periodicity');
    this.frameSeq++;
    return {
      id: `f${this.frameSeq}`,
      startSec: startFrame / sr,
      endSec: endFrame / sr,
      centerSec: (startFrame + this.cfg.bufferSize / 2) / sr,
      hopStartSec: (endFrame - n) / sr,
      rmsDb,
      peakDb,
      clipped,
      noiseFloorDb: this.noiseFloorDb,
      gateDb: this.gateDb(),
      hz,
      midiFloat: hz === null ? null : 69 + 12 * Math.log2(hz / 440),
      aperiodicity,
      inputQuality,
      pitchQuality,
      reasonCodes,
    };
  }

  private feedPending(f: PitchFrame, endFrame: number): void {
    const p = this.pending;
    if (!p) return;
    const startFrame = endFrame - this.cfg.bufferSize;
    if (startFrame >= p.onsetFrame && f.midiFloat !== null && f.aperiodicity <= GOOD_APERIODICITY) {
      p.midis.push(f.midiFloat);
      p.hzs.push(f.hz!);
      p.aper.push(f.aperiodicity);
    }
    if (endFrame >= p.deadlineFrame) {
      this.pending = null;
      this.finished.push(this.finalize(p, endFrame, null));
    }
  }

  private finalize(p: PendingAttack, endFrame: number, extraReason: string | null): AttackObservation {
    const sr = this.cfg.sampleRate;
    const reasons: string[] = [];
    if (extraReason) reasons.push(extraReason);
    let quality: SignalQuality = 'good';
    let midi: number | null = null;
    let hz: number | null = null;
    if (p.midis.length >= 1) {
      midi = median(p.midis);
      hz = 440 * 2 ** ((midi - 69) / 12);
    }
    if (p.midis.length < ATTACK_MIN_FRAMES) {
      quality = p.midis.length ? 'poor' : 'unavailable';
      reasons.push(p.midis.length ? 'too_few_pitch_frames' : 'no_stable_pitch');
    } else {
      const spread = (Math.max(...p.midis) - Math.min(...p.midis)) * 100;
      if (spread > ATTACK_MAX_SPREAD_CENTS) {
        quality = 'poor';
        reasons.push('unstable_pitch');
      }
    }
    if (p.clipped) {
      quality = 'poor';
      reasons.push('clipping');
    }
    this.attackSeq++;
    return {
      id: `a${this.attackSeq}`,
      providerId: this.cfg.providerId,
      onsetContextSec: p.onsetFrame / sr,
      analysisStartContextSec: p.onsetFrame / sr,
      analysisEndContextSec: endFrame / sr,
      producedAtPerformanceMs: 0,
      pitchHz: hz,
      pitchMidiFloat: midi,
      quality,
      modelScore: p.aper.length ? 1 - median(p.aper) : null,
      peakDb: db(p.peak),
      frames: p.midis.length,
      reasonCodes: reasons,
      simulated: false,
    };
  }
}
