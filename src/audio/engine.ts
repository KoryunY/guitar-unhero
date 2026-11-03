/**
 * AudioEngine: one AudioContext shared by output (synth, metronome, reference)
 * and input (worklet capture → worker analysis), so all scheduling and all
 * observations live in the same context-time domain.
 *
 * Privacy: microphone PCM is analyzed in memory only, never routed to the
 * speakers (zero-gain keep-alive) and never sent over the network.
 */
import captureProcessorUrl from './capture-processor.js?url';
import { renderClick, renderPluck } from './dsp/pluckSynth';
import { classifyMicError, instrumentConstraints, micSupport, type MicError, type MicState } from './mic';
import type { AttackObservation, PitchFrame } from './observations';
import { SignalTimeline } from '../assessment/timeline';
import { midiToHz } from '../domain/tuning';

export type Bus = 'guide' | 'metronome' | 'reference';

export interface EngineEvents {
  frame: PitchFrame;
  attack: AttackObservation;
  mic: MicState;
  context: AudioContextState | 'interrupted';
  deviceLost: void;
}

type Listener<T> = (v: T) => void;

export interface Handle {
  stop(): void;
}

export interface TrackInfo {
  label: string;
  deviceId: string | null;
  sampleRate: number | null;
  echoCancellation: boolean | null;
  noiseSuppression: boolean | null;
  autoGainControl: boolean | null;
  channelCount: number | null;
}

/** Assessment is blocked while the app itself makes sound, plus this tail. */
const OUTPUT_TAIL_SEC = 0.35;

export class AudioEngine {
  ctx: AudioContext | null = null;
  micState: MicState = 'off';
  micError: MicError | null = null;
  track: TrackInfo | null = null;
  readonly timeline = new SignalTimeline();
  lastFrame: PitchFrame | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<Bus, GainNode>> = {};
  private busLevels: Record<Bus, number> = { guide: 0.8, metronome: 0.6, reference: 0.8 };
  private muted = false;
  private pluckCache = new Map<number, AudioBuffer>();
  private clickCache = new Map<string, AudioBuffer>();
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private keepAlive: GainNode | null = null;
  private worker: Worker | null = null;
  private workletLoaded = false;
  private blocks: { start: number; end: number; reason: string }[] = [];
  private listeners = new Map<keyof EngineEvents, Set<Listener<never>>>();
  private simTimer: number | null = null;

  on<K extends keyof EngineEvents>(type: K, fn: Listener<EngineEvents[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const s = set as unknown as Set<Listener<EngineEvents[K]>>;
    s.add(fn);
    return () => s.delete(fn);
  }

  private emit<K extends keyof EngineEvents>(type: K, v: EngineEvents[K]): void {
    (this.listeners.get(type) as unknown as Set<Listener<EngineEvents[K]>> | undefined)?.forEach((fn) => fn(v));
  }

  // ---------------- context & output ----------------
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.1;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(limiter).connect(ctx.destination);
      (['guide', 'metronome', 'reference'] as Bus[]).forEach((b) => {
        const g = ctx.createGain();
        g.gain.value = this.busLevels[b];
        g.connect(this.master!);
        this.buses[b] = g;
      });
      ctx.addEventListener('statechange', () => this.emit('context', ctx.state as AudioContextState));
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* resume needs a user gesture; caller shows state */
      }
    }
    return this.ctx;
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get sampleRate(): number | null {
    return this.ctx?.sampleRate ?? null;
  }

  /**
   * Context time currently reaching the listener, for drawing. Uses
   * getOutputTimestamp() when available, otherwise currentTime − outputLatency.
   */
  audibleNow(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    try {
      const ts = ctx.getOutputTimestamp?.();
      if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
        const t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
        if (Number.isFinite(t) && Math.abs(t - ctx.currentTime) < 0.5) return t;
      }
    } catch {
      /* fall through */
    }
    return ctx.currentTime - (ctx.outputLatency || 0);
  }

  setBusLevel(bus: Bus, level: number): void {
    this.busLevels[bus] = level;
    const g = this.buses[bus];
    if (g && this.ctx) g.gain.setTargetAtTime(level, this.ctx.currentTime, 0.02);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private pluckBuffer(midi: number): AudioBuffer {
    const ctx = this.ctx!;
    let b = this.pluckCache.get(midi);
    if (!b) {
      const pcm = renderPluck(ctx.sampleRate, midiToHz(midi), 2.2, 0.35, 1000 + midi);
      b = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      b.getChannelData(0).set(pcm);
      this.pluckCache.set(midi, b);
    }
    return b;
  }

  private clickBuffer(accent: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const k = accent ? 'a' : 'n';
    let b = this.clickCache.get(k);
    if (!b) {
      const pcm = renderClick(ctx.sampleRate, accent);
      b = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      b.getChannelData(0).set(pcm);
      this.clickCache.set(k, b);
    }
    return b;
  }

  /** Start a fresh one-shot source (AudioBufferSourceNode cannot be restarted). */
  private oneShot(buffer: AudioBuffer, when: number, bus: Bus, maxDur?: number): Handle {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    src.connect(g).connect(this.buses[bus]!);
    const t = Math.max(when, ctx.currentTime);
    src.start(t);
    if (maxDur) {
      g.gain.setValueAtTime(1, t + maxDur);
      g.gain.linearRampToValueAtTime(0, t + maxDur + 0.04);
      src.stop(t + maxDur + 0.05);
    }
    let stopped = false;
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          const n = ctx.currentTime;
          g.gain.cancelScheduledValues(n);
          g.gain.setValueAtTime(g.gain.value, n);
          g.gain.linearRampToValueAtTime(0, n + 0.015);
          src.stop(n + 0.02);
        } catch {
          /* already stopped */
        }
      },
    };
  }

  playNote(midi: number, when: number, bus: Bus = 'guide', maxDur?: number): Handle | null {
    if (!this.ctx) return null;
    return this.oneShot(this.pluckBuffer(midi), when, bus, maxDur);
  }

  /** Recent metronome click times; an unpitched sound just after one is likely its echo. */
  private clickTimes: number[] = [];

  playClick(when: number, accent: boolean): Handle | null {
    if (!this.ctx) return null;
    this.clickTimes.push(when);
    if (this.clickTimes.length > 64) this.clickTimes.shift();
    return this.oneShot(this.clickBuffer(accent), when, 'metronome');
  }

  /**
   * Demonstration/reference sound with assessment blocked while it plays.
   * Returns the handle and the blocked context interval.
   */
  async demonstrate(midis: number[], gapSec = 0.9, bus: Bus = 'reference'): Promise<{ handle: Handle; start: number; end: number }> {
    const ctx = await this.ensureContext();
    const start = ctx.currentTime + 0.05;
    const handles = midis.map((m, i) => this.playNote(m, start + i * gapSec, bus)!);
    const end = start + (midis.length - 1) * gapSec + 2.2;
    this.blockAssessment(start, end + OUTPUT_TAIL_SEC, 'app_sound_playing');
    return {
      handle: {
        stop: () => {
          handles.forEach((h) => h.stop());
          const n = ctx.currentTime;
          this.blocks = this.blocks.map((b) => (b.start === start ? { ...b, end: Math.min(b.end, n + OUTPUT_TAIL_SEC) } : b));
          this.timeline.endBlocks('app_sound_playing', n + OUTPUT_TAIL_SEC);
        },
      },
      start,
      end,
    };
  }

  blockAssessment(start: number, end: number, reason: string): void {
    this.blocks.push({ start, end, reason });
    if (this.blocks.length > 200) this.blocks.shift();
    this.timeline.block(start, end, reason);
    this.worker?.postMessage({ type: 'resetAttack' });
  }

  /** Is assessment blocked (app sound) at context time t? */
  isBlocked(t: number): string | null {
    for (const b of this.blocks) if (t >= b.start && t < b.end) return b.reason;
    return null;
  }

  // ---------------- microphone ----------------
  private setMic(state: MicState, err: MicError | null = null): void {
    this.micState = state;
    this.micError = err;
    this.emit('mic', state);
  }

  async listInputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput');
  }

  async startMic(deviceId: string | null): Promise<MicState> {
    const unsupported = micSupport();
    if (unsupported) {
      this.setMic(unsupported.state, unsupported);
      return unsupported.state;
    }
    this.stopMic(false);
    this.setMic('requesting');
    const ctx = await this.ensureContext();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(instrumentConstraints(deviceId));
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(instrumentConstraints(null));
        } catch (e2) {
          const err = classifyMicError(e2);
          this.setMic(err.state, err);
          return err.state;
        }
      } else {
        const err = classifyMicError(e);
        this.setMic(err.state, err);
        return err.state;
      }
    }
    try {
      if (!this.workletLoaded) {
        await ctx.audioWorklet.addModule(captureProcessorUrl);
        this.workletLoaded = true;
      }
      this.stream = stream;
      const track = stream.getAudioTracks()[0]!;
      const s = track.getSettings();
      this.track = {
        label: track.label || 'Microphone',
        deviceId: s.deviceId ?? null,
        sampleRate: s.sampleRate ?? null,
        echoCancellation: typeof s.echoCancellation === 'boolean' ? s.echoCancellation : null,
        noiseSuppression: typeof s.noiseSuppression === 'boolean' ? s.noiseSuppression : null,
        autoGainControl: typeof s.autoGainControl === 'boolean' ? s.autoGainControl : null,
        channelCount: s.channelCount ?? null,
      };
      track.addEventListener('ended', () => this.handleLost());
      this.source = ctx.createMediaStreamSource(stream);
      this.worklet = new AudioWorkletNode(ctx, 'gu-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      this.keepAlive = ctx.createGain();
      this.keepAlive.gain.value = 0; // never route the mic to the speakers
      this.source.connect(this.worklet).connect(this.keepAlive).connect(ctx.destination);
      this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
      const ch = new MessageChannel();
      this.worklet.port.postMessage({ type: 'port', port: ch.port1 }, [ch.port1]);
      this.worker.postMessage({ type: 'init', sampleRate: ctx.sampleRate, port: ch.port2 }, [ch.port2]);
      this.worker.onmessage = (e: MessageEvent<{ type: string; frames: PitchFrame[]; attacks: AttackObservation[] }>) => this.onResults(e.data);
      this.worker.onerror = () => this.setMic('error', { state: 'error', title: 'Audio analysis stopped', detail: 'The analysis worker failed. Reload the page and try again.' });
      this.setMic('on');
      return 'on';
    } catch (e) {
      this.stopMic(false);
      const err: MicError = { state: 'error', title: 'Audio processing could not start', detail: (e as Error).message || 'Unknown error' };
      this.setMic('error', err);
      return 'error';
    }
  }

  private onResults(d: { frames: PitchFrame[]; attacks: AttackObservation[] }): void {
    for (const f of d.frames) {
      const blocked = this.isBlocked(f.centerSec);
      this.timeline.add(f.hopStartSec, f.endSec, f.inputQuality, f.inputQuality === 'good' ? null : f.reasonCodes[0] ?? 'poor_signal');
      this.lastFrame = f;
      this.emit('frame', blocked ? { ...f, reasonCodes: [...f.reasonCodes, 'app_sound_playing'] } : f);
    }
    for (const a of d.attacks) {
      if (this.isBlocked(a.onsetContextSec)) continue; // never assess the app's own sound
      // An unpitched onset within 300 ms after one of our clicks is treated as click leakage.
      if (a.pitchMidiFloat === null && this.clickTimes.some((c) => a.onsetContextSec >= c - 0.02 && a.onsetContextSec <= c + 0.3)) continue;
      this.emit('attack', { ...a, producedAtPerformanceMs: performance.now() });
    }
  }

  private handleLost(): void {
    this.stopMic(false);
    this.setMic('lost', {
      state: 'lost',
      title: 'The microphone disconnected',
      detail: 'Practice is paused and nothing was marked wrong. Reconnect the input, then press “Try again”.',
    });
    this.emit('deviceLost', undefined);
  }

  stopMic(emit = true): void {
    this.worklet?.port.postMessage({ type: 'stop' });
    this.source?.disconnect();
    this.worklet?.disconnect();
    this.keepAlive?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.worker?.postMessage({ type: 'stop' });
    this.worker?.terminate();
    this.source = null;
    this.worklet = null;
    this.keepAlive = null;
    this.stream = null;
    this.worker = null;
    this.lastFrame = null;
    if (emit) this.setMic('off');
  }

  // ---------------- simulation (clearly labeled, never real assessment) ----------------
  startSimulationCoverage(): void {
    if (this.simTimer !== null) return;
    let last = this.now;
    this.simTimer = window.setInterval(() => {
      const n = this.now;
      if (n > last) this.timeline.add(last, n, 'good', null);
      last = n;
    }, 50);
  }

  stopSimulationCoverage(): void {
    if (this.simTimer !== null) window.clearInterval(this.simTimer);
    this.simTimer = null;
  }

  /** Inject a simulated attack (labeled simulated:true end to end). */
  simulateAttack(midi: number | null, onset = this.now): void {
    this.emit('attack', {
      id: `sim-${Math.round(onset * 1000)}-${Math.random().toString(36).slice(2, 6)}`,
      providerId: 'simulation',
      onsetContextSec: onset,
      analysisStartContextSec: onset,
      analysisEndContextSec: onset,
      producedAtPerformanceMs: performance.now(),
      pitchHz: midi === null ? null : midiToHz(midi),
      pitchMidiFloat: midi,
      quality: midi === null ? 'unavailable' : 'good',
      modelScore: null,
      peakDb: -20,
      frames: 0,
      reasonCodes: ['simulated_input'],
      simulated: true,
    });
  }
}

export const engine = new AudioEngine();
