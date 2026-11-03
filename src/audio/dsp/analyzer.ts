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
 *   - Onset trigger: the ~21 ms windowed level rises ≥ ONSET_RISE_DB above its
 *     recent minimum and above the gate; the onset time is then refined to the
 *     earliest 64-sample block clearly louder than the preceding signal.
 */
import { Yin } from './yin';
import { FFT } from './fft';
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
const ONSET_WINDOW_SEC = 0.021;
const FLUX_N = 1024;
const FLUX_HOP_BLOCKS = 4; // 256 samples
const FLUX_LAG = 2; // compare with the spectrum 512 samples earlier
const FLUX_MEDIAN_FRAMES = 100;
const FLUX_ABS_THRESHOLD = 4; // mean dB increase per bin
const FLUX_REL_THRESHOLD = 3;
const FLUX_MAX_LEVEL_DROP_DB = 6;
/** Recent good pitches kept to know which note was ringing before an onset. */
const PREV_PITCH_SEC = 0.15;
const RINGING_MEMORY_SEC = 2.5;
const MAX_CANCEL = 2;
const SAME_PITCH_MIN_RISE_DB = 3;
/** Below this level for DEAD_INPUT_SEC the input is treated as absent (muted/zero gain). */
const DEAD_INPUT_DB = -100;
const DEAD_INPUT_SEC = 0.5;
/** A "new" attack at a still-ringing pitch needs this much sustained level rise. */
const RINGING_REPLUCK_MIN_RISE_DB = 1.5;
/** Flux-only onsets are not accepted this soon after another onset (spectrum still settling). */
const FLUX_REFRACTORY_SEC = 0.15;
/** The fundamental must also stand this far above the median spectral floor. */
const MIN_FUNDAMENTAL_ABOVE_FLOOR_DB = 10;
/** A pitch whose fundamental is this far below the strongest partial is treated as unreliable. */
const MIN_FUNDAMENTAL_SUPPORT_DB = -40;
const ONSET_HISTORY_SEC = 0.2;
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
  /** Pitches (MIDI float) that may still be ringing at this onset (most recent first). */
  prevMidis: number[];
  separated: number;
  ambiguous: number;
  /** Level rise for a spectral-flux-only onset (Infinity for an energy onset). */
  fluxOnlyRiseDb: number;
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
  private lastOnsetFrame = -Infinity;
  private noiseFloorDb: number | null = null;
  private pending: PendingAttack | null = null;
  private attackSeq = 0;
  private frameSeq = 0;

  constructor(cfg: Partial<AnalyzerConfig> & { sampleRate: number }) {
    this.cfg = { bufferSize: 4096, hop: 512, minHz: 78, maxHz: 1500, providerId: ANALYZER_PROVIDER_ID, ...cfg };
    this.yin = new Yin({ sampleRate: this.cfg.sampleRate, bufferSize: this.cfg.bufferSize, minHz: this.cfg.minHz, maxHz: this.cfg.maxHz });
    this.ring = new Float32Array(this.cfg.bufferSize);
    this.sepBuf = new Float32Array(this.cfg.bufferSize);
    this.sepBuf2 = new Float32Array(this.cfg.bufferSize);
    // Strict threshold for separated estimates: comb filtering weakens fundamentals and a
    // loose threshold invites sub-octave answers.
    this.sepYin = new Yin({ sampleRate: this.cfg.sampleRate, bufferSize: this.cfg.bufferSize - 1024, minHz: this.cfg.minHz, maxHz: this.cfg.maxHz, fallbackThreshold: null });
    this.fundFft = new FFT(this.cfg.bufferSize);
    this.fundRe = new Float64Array(this.cfg.bufferSize);
    this.fundIm = new Float64Array(this.cfg.bufferSize);
    this.fundWin = Float64Array.from({ length: this.cfg.bufferSize }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.cfg.bufferSize));
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
    this.subEnergies.length = 0;
    this.specHistory.length = 0;
    this.recentGood.length = 0;
    this.recentAttacks.length = 0;
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
    const sr = this.cfg.sampleRate;
    const e = this.subSumSq / SUB;
    // Windowed level over ~21 ms (longer than one period of low E), so the shape
    // of a single waveform period never looks like a new attack.
    this.subEnergies.push({ frame: subStartFrame, e });
    const winBlocks = Math.max(1, Math.round((ONSET_WINDOW_SEC * sr) / SUB));
    if (this.subEnergies.length > Math.round((ONSET_HISTORY_SEC * sr) / SUB)) this.subEnergies.shift();
    const recent = this.subEnergies.slice(-winBlocks);
    const level = db(Math.sqrt(recent.reduce((s, x) => s + x.e, 0) / recent.length));
    const lookback = Math.max(1, Math.round((ONSET_LOOKBACK_SEC * sr) / SUB));
    let recentMin = Infinity;
    for (const v of this.subLevels) if (v < recentMin) recentMin = v;
    this.subLevels.push(level);
    if (this.subLevels.length > lookback) this.subLevels.shift();
    this.subCounter++;
    const fluxHit = this.subCounter % FLUX_HOP_BLOCKS === 0 ? this.spectralFlux() : false;
    if (recentMin === Infinity || this.subEnergies.length < winBlocks) return;
    const gate = this.gateDb();
    const refractory = (subStartFrame - this.lastOnsetFrame) / sr < ONSET_REFRACTORY_SEC;
    const energyHit = level - Math.max(recentMin, gate - ONSET_RISE_DB - 6) >= ONSET_RISE_DB;
    // Flux onsets need the level to hold or grow: muting a string is not a new note.
    // The newest audio must itself be loud: a note cut off or muted (energy vanishing)
    // also changes the spectrum but is not a new note.
    const newest = this.subEnergies.slice(-2);
    const newestDb = db(Math.sqrt(newest.reduce((a, b) => a + b.e, 0) / newest.length));
    const fluxOk =
      fluxHit &&
      level >= (this.subLevels[0] ?? level) - FLUX_MAX_LEVEL_DROP_DB &&
      newestDb >= level - 6 &&
      (subStartFrame - this.lastOnsetFrame) / sr >= FLUX_REFRACTORY_SEC;
    if (!refractory && level > gate && (energyHit || fluxOk)) {
      const onset = this.refineOnset(winBlocks);
      if (onset - this.lastOnsetFrame < ONSET_REFRACTORY_SEC * sr) return;
      this.lastOnsetFrame = onset;
      this.startAttack(onset, energyHit ? Infinity : level - recentMin);
    }
  }

  /**
   * Sample-accurate-ish onset: the earliest 64-sample block in the trigger window
   * whose energy clearly exceeds the loudest block of the preceding signal.
   */
  private refineOnset(winBlocks: number): number {
    const blocks = this.subEnergies;
    const n = blocks.length;
    const searchFrom = Math.max(0, n - winBlocks - 2);
    const before = blocks.slice(Math.max(0, searchFrom - winBlocks * 2), searchFrom);
    // 75th percentile, not the max: a short click just before a pluck must not
    // become the reference that delays (or steals) the pluck's onset time.
    const sortedE = before.map((b) => b.e).sort((x, y) => x - y);
    const ref = sortedE.length ? sortedE[Math.floor(sortedE.length * 0.75)]! : 0;
    const thresh = Math.max(ref * 2, 1e-10); // +3 dB over the previous peak block
    for (let i = searchFrom; i < n; i++) if (blocks[i]!.e > thresh) return blocks[i]!.frame;
    return blocks[Math.max(0, n - Math.ceil(winBlocks / 2))]!.frame;
  }

  private readonly subEnergies: { frame: number; e: number }[] = [];
  private readonly fundFft: FFT;
  private readonly sepBuf: Float32Array;
  private readonly sepBuf2: Float32Array;
  private readonly sepYin: Yin;
  private readonly fundRe: Float64Array;
  private readonly fundIm: Float64Array;
  private readonly fundWin: Float64Array;

  /**
   * Energy at the estimated fundamental relative to the strongest partial (dB).
   * Two notes sounding together (e.g. B3 over a ringing E4) have a common period
   * far below both with no energy there — YIN would report that "missing
   * fundamental", which no one played. Such frames are not trusted.
   */
  private fundamentalSupportDb(hz: number, buf: Float32Array = this.lin): number {
    const N = this.lin.length;
    const sr = this.cfg.sampleRate;
    for (let i = 0; i < N; i++) {
      this.fundRe[i] = buf[i]! * this.fundWin[i]!;
      this.fundIm[i] = 0;
    }
    this.fundFft.transform(this.fundRe, this.fundIm);
    const bin = (f: number) => Math.round((f * N) / sr);
    let max = 0;
    for (let k = bin(55); k <= bin(5000); k++) max = Math.max(max, this.fundRe[k]! ** 2 + this.fundIm[k]! ** 2);
    let fund = 0;
    for (let k = bin(hz * 0.94); k <= bin(hz * 1.06); k++) fund = Math.max(fund, this.fundRe[k]! ** 2 + this.fundIm[k]! ** 2);
    if (max <= 0) return -200;
    // Median power over the analysis band = local noise floor estimate.
    const pw: number[] = [];
    for (let k = bin(55); k <= bin(5000); k += 2) pw.push(this.fundRe[k]! ** 2 + this.fundIm[k]! ** 2);
    pw.sort((a, b) => a - b);
    const floor = pw[pw.length >> 1]!;
    if (fund < floor * 10 ** (MIN_FUNDAMENTAL_ABOVE_FLOOR_DB / 10)) return -200;
    return 10 * Math.log10((fund + 1e-30) / max);
  }
  private subCounter = 0;
  private deadHops = 0;
  /** Recent per-hop power for sustained-rise checks (≈1 s). */
  private readonly hopPower: { frame: number; p: number }[] = [];

  /** Mean power (dB) of hops whose end frame lies in [from, to). */
  private meanPowerDb(from: number, to: number): number | null {
    let sum = 0, n = 0;
    for (const h of this.hopPower) if (h.frame >= from && h.frame < to) { sum += h.p; n++; }
    return n ? 10 * Math.log10(sum / n + 1e-20) : null;
  }
  private readonly fluxFft = new FFT(FLUX_N);
  private readonly fluxRe = new Float64Array(FLUX_N);
  private readonly fluxIm = new Float64Array(FLUX_N);
  private readonly hann = Float64Array.from({ length: FLUX_N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FLUX_N));
  private readonly specHistory: Float64Array[] = [];
  private readonly fluxHistory: number[] = [];
  lastFlux = 0;

  /**
   * Spectral flux on log magnitudes (new partials appearing). Detects a new note
   * even when an earlier one is still ringing and total loudness barely rises.
   * Returns true on a flux peak above an adaptive threshold.
   */
  private spectralFlux(): boolean {
    const sr = this.cfg.sampleRate;
    const L = this.ring.length;
    for (let i = 0; i < FLUX_N; i++) {
      const v = this.ring[(this.writePos - FLUX_N + i + L) % L]!;
      this.fluxRe[i] = v * this.hann[i]!;
      this.fluxIm[i] = 0;
    }
    this.fluxFft.transform(this.fluxRe, this.fluxIm);
    const k0 = Math.max(1, Math.floor((70 * FLUX_N) / sr));
    const k1 = Math.min(FLUX_N / 2 - 1, Math.ceil((4000 * FLUX_N) / sr));
    const spec = new Float64Array(k1 - k0);
    let maxDb = -200;
    for (let k = k0; k < k1; k++) {
      const m = 10 * Math.log10(this.fluxRe[k]! ** 2 + this.fluxIm[k]! ** 2 + 1e-20);
      spec[k - k0] = m;
      if (m > maxDb) maxDb = m;
    }
    const floor = maxDb - 50;
    for (let k = 0; k < spec.length; k++) if (spec[k]! < floor) spec[k] = floor;
    this.specHistory.push(spec);
    if (this.specHistory.length > FLUX_LAG + 1) this.specHistory.shift();
    if (this.specHistory.length <= FLUX_LAG) return false;
    const prev = this.specHistory[0]!;
    let flux = 0;
    for (let k = 0; k < spec.length; k++) {
      const d = spec[k]! - Math.max(prev[k]!, floor);
      if (d > 0) flux += d;
    }
    flux /= spec.length;
    this.lastFlux = flux;
    const hist = this.fluxHistory;
    const sorted = [...hist].sort((a, b) => a - b);
    const med = sorted.length ? sorted[sorted.length >> 1]! : flux;
    hist.push(flux);
    if (hist.length > FLUX_MEDIAN_FRAMES) hist.shift();
    const prevFlux = hist.length > 1 ? hist[hist.length - 2]! : 0;
    // Rising crossing of an adaptive threshold.
    const thr = Math.max(FLUX_ABS_THRESHOLD, FLUX_REL_THRESHOLD * med);
    return flux > thr && prevFlux <= thr;
  }

  private startAttack(onsetFrame: number, fluxOnlyRiseDb = Infinity): void {
    const sr = this.cfg.sampleRate;
    // A new attack finalizes an unfinished one with whatever evidence it has.
    if (this.pending) this.emitAttack(this.pending, onsetFrame, 'superseded_by_new_attack');
    this.pending = {
      onsetFrame,
      peak: 0,
      clipped: false,
      midis: [],
      hzs: [],
      aper: [],
      deadlineFrame: onsetFrame + this.cfg.bufferSize + Math.round(ATTACK_COLLECT_SEC * sr),
      prevMidis: this.ringingBefore(onsetFrame),
      fluxOnlyRiseDb,
      separated: 0,
      ambiguous: 0,
    };
  }

  private readonly recentGood: { frame: number; midi: number }[] = [];

  /** Recently attacked pitches, kept to cancel notes that may still be ringing. */
  private readonly recentAttacks: { frame: number; midi: number }[] = [];

  private ringingBefore(onsetFrame: number): number[] {
    const sr = this.cfg.sampleRate;
    const out: number[] = [];
    const xs = this.recentGood.filter((g) => g.frame < onsetFrame && onsetFrame - g.frame < PREV_PITCH_SEC * sr).map((g) => g.midi);
    if (xs.length >= 2) out.push(median(xs));
    for (let i = this.recentAttacks.length - 1; i >= 0 && out.length < MAX_CANCEL; i--) {
      const a = this.recentAttacks[i]!;
      if (onsetFrame - a.frame > RINGING_MEMORY_SEC * sr) break;
      if (out.every((m) => Math.abs(m - a.midi) * 100 > 50)) out.push(a.midi);
    }
    return out;
  }

  /**
   * Cancel a still-ringing previous note with a feed-forward comb filter at its
   * period, y[n] = x[n] − x[n − T], then estimate the pitch of what remains.
   */
  private separatedPitch(prevMidis: number[]): { midi: number; aper: number } | null {
    const sr = this.cfg.sampleRate;
    const N = this.lin.length;
    let src: Float32Array = this.lin;
    let start = 0;
    for (const prevMidi of prevMidis) {
      const T = sr / (440 * 2 ** ((prevMidi - 69) / 12));
      const Ti = Math.floor(T);
      const fr = T - Ti;
      const out = src === this.sepBuf ? this.sepBuf2 : this.sepBuf;
      out.fill(0);
      start += Ti + 1;
      for (let i = start; i < N; i++) out[i] = src[i]! - ((1 - fr) * src[i - Ti]! + fr * src[i - Ti - 1]!);
      src = out;
    }
    const out = src;
    if (N - start < this.sepYin.cfg.bufferSize) return null;
    const r = this.sepYin.detect(out.subarray(N - this.sepYin.cfg.bufferSize));
    if (r.hz === null || r.aperiodicity > GOOD_APERIODICITY) return null;
    const support = this.fundamentalSupportDb(r.hz, out);
    if (support < MIN_FUNDAMENTAL_SUPPORT_DB) return null;
    return { midi: 69 + 12 * Math.log2(r.hz / 440), aper: r.aperiodicity };
  }


  private readonly finished: AttackObservation[] = [];

  private analyzeHop(endFrame: number): PitchFrame {
    const sr = this.cfg.sampleRate;
    const n = this.cfg.hop;
    const rms = Math.sqrt(this.hopSumSq / n);
    const rmsDb = db(rms);
    const peakDb = db(this.hopPeak);
    this.hopPower.push({ frame: endFrame, p: rms * rms });
    if (this.hopPower.length > Math.ceil(sr / n)) this.hopPower.shift();
    const clipped = this.hopClipCount >= 3;
    this.hopSumSq = 0;
    this.hopPeak = 0;
    this.hopClipCount = 0;

    const startFrame = endFrame - this.cfg.bufferSize;
    const filled = this.nextFrame !== null || endFrame >= this.cfg.bufferSize;
    let hz: number | null = null;
    let aperiodicity = 1;
    let fundamentalDb = 0;
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
      if (hz !== null) fundamentalDb = this.fundamentalSupportDb(hz);
    }
    // Adaptive noise floor: falls quickly; rises slowly (≈3 dB/s) and never while a
    // clearly periodic note is sounding, so a long-held string is not absorbed.
    const nf = this.noiseFloorDb ?? INITIAL_NOISE_FLOOR_DB;
    const periodic = hz !== null && aperiodicity <= GOOD_APERIODICITY;
    if (rmsDb < nf) this.noiseFloorDb = 0.7 * nf + 0.3 * Math.max(rmsDb, -96);
    else if (!periodic) this.noiseFloorDb = nf + Math.min(NOISE_RISE_DB_PER_HOP, rmsDb - nf);
    else this.noiseFloorDb = nf;
    const noisy = (this.noiseFloorDb ?? -96) > NOISY_FLOOR_DB;
    // A muted track / zero input gain delivers (near-)digital silence: that is not
    // "quiet listening", it is no listening at all.
    this.deadHops = rmsDb < DEAD_INPUT_DB ? this.deadHops + 1 : 0;
    const dead = this.deadHops * n >= DEAD_INPUT_SEC * sr;
    const inputQuality: SignalQuality = dead ? 'unavailable' : clipped || noisy ? 'poor' : 'good';
    let pitchQuality: SignalQuality = 'unavailable';
    const missingFundamental = hz !== null && fundamentalDb < MIN_FUNDAMENTAL_SUPPORT_DB;
    if (hz !== null) pitchQuality = aperiodicity <= GOOD_APERIODICITY && !clipped && !missingFundamental ? 'good' : 'poor';
    const reasonCodes: string[] = [];
    if (dead) reasonCodes.push('no_input_signal');
    if (clipped) reasonCodes.push('clipping');
    if (noisy) reasonCodes.push('noisy_input');
    if (missingFundamental) reasonCodes.push('missing_fundamental_possibly_several_notes');
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
    if (f.midiFloat !== null && f.pitchQuality === 'good') {
      this.recentGood.push({ frame: endFrame - this.cfg.bufferSize / 2, midi: f.midiFloat });
      if (this.recentGood.length > 64) this.recentGood.shift();
    }
    const p = this.pending;
    if (!p) return;
    const startFrame = endFrame - this.cfg.bufferSize;
    if (startFrame >= p.onsetFrame) {
      const rawGood = f.midiFloat !== null && f.pitchQuality === 'good';
      const rawIsPrev = rawGood && p.prevMidis.some((m) => Math.abs(f.midiFloat! - m) * 100 <= 50);
      if (p.prevMidis.length > 0 && (!rawGood || rawIsPrev) && f.rmsDb > f.gateDb) {
        const sep = this.separatedPitch(p.prevMidis);
        // The separated pitch must differ from every recently played pitch, not only the
        // cancelled ones: a third, older string may still be ringing underneath.
        const recent = [...p.prevMidis, ...this.recentAttacks.filter((r) => p.onsetFrame - r.frame < RINGING_MEMORY_SEC * this.cfg.sampleRate).map((r) => r.midi)];
        const sepDistinct = sep !== null && recent.every((m) => Math.abs(sep.midi - m) * 100 > 50);
        if (!rawGood && sepDistinct) {
          // A new note over a ringing one: use the separated estimate.
          p.midis.push(sep!.midi);
          p.hzs.push(440 * 2 ** ((sep!.midi - 69) / 12));
          p.aper.push(sep!.aper);
          p.separated++;
        } else if (rawIsPrev && sepDistinct) {
          // Either a repeated note or a softer new note hidden under the old one: ambiguous.
          p.ambiguous++;
        } else if (rawGood) {
          p.midis.push(f.midiFloat!);
          p.hzs.push(f.hz!);
          p.aper.push(f.aperiodicity);
        }
      } else if (f.midiFloat !== null && (rawGood || (f.clipped && f.aperiodicity <= GOOD_APERIODICITY))) {
        // Clipped frames still contribute (the attack is then marked poor); frames with a
        // missing fundamental (likely several notes) never do.
        p.midis.push(f.midiFloat);
        p.hzs.push(f.hz!);
        p.aper.push(f.aperiodicity);
      }
    }
    if (endFrame >= p.deadlineFrame) {
      this.pending = null;
      this.emitAttack(p, endFrame, null);
    }
  }

  /** Finalize, drop non-attacks, remember good pitches for ringing-note cancellation. */
  private emitAttack(p: PendingAttack, endFrame: number, extraReason: string | null): void {
    const a = this.finalize(p, endFrame, extraReason);
    // A flux-only "onset" that continues the previous attack's pitch without a level
    // rise is a spectral change (e.g. a click or a stopped neighbour), not a new pluck.
    const last = this.recentAttacks[this.recentAttacks.length - 1];
    if (
      p.fluxOnlyRiseDb < SAME_PITCH_MIN_RISE_DB &&
      a.pitchMidiFloat !== null &&
      last &&
      (p.onsetFrame - last.frame) / this.cfg.sampleRate < 1 &&
      Math.abs(a.pitchMidiFloat - last.midi) * 100 <= 50
    ) {
      return;
    }
    // Any onset (energy or flux) whose pitch equals a note that was already ringing must
    // show a *sustained* level rise; a metronome click or knock over a ringing string
    // has the ringing pitch but no new string energy, so it is not a new pluck.
    if (a.pitchMidiFloat !== null && p.prevMidis.some((m) => Math.abs(m - a.pitchMidiFloat!) * 100 <= 50)) {
      const sr = this.cfg.sampleRate;
      const before = this.meanPowerDb(p.onsetFrame - 0.08 * sr, p.onsetFrame - 0.01 * sr);
      const after = this.meanPowerDb(p.onsetFrame + 0.05 * sr, p.onsetFrame + 0.13 * sr);
      if (before !== null && after !== null && after - before < RINGING_REPLUCK_MIN_RISE_DB) return;
    }
    if (a.pitchMidiFloat !== null && a.quality === 'good') {
      this.recentAttacks.push({ frame: p.onsetFrame, midi: a.pitchMidiFloat });
      if (this.recentAttacks.length > 8) this.recentAttacks.shift();
    }
    this.finished.push(a);
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
    if (p.ambiguous > 0 && p.ambiguous >= p.midis.length / 2) {
      quality = 'poor';
      reasons.push('ambiguous_with_ringing_note');
    }
    if (p.separated > 0) reasons.push('separated_from_ringing_note');
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
      onsetKind: p.fluxOnlyRiseDb === Infinity ? 'energy' : 'flux',
    };
  }
}
