/// <reference lib="webworker" />
/**
 * Analysis worker: receives PCM chunks directly from the capture worklet over a
 * MessagePort and runs the StreamAnalyzer off the main thread. Results are posted
 * in small batches. PCM never leaves this device and is not stored.
 */
import { StreamAnalyzer, type AnalyzerOutput } from './dsp/analyzer';
import type { AttackObservation, PitchFrame } from './observations';

let analyzer: StreamAnalyzer | null = null;
let port: MessagePort | null = null;
/** Explicit, user-started local recording (bounded). Never sent anywhere by the worker. */
let rec: { chunks: Float32Array[]; remaining: number; startFrame: number | null } | null = null;
let sampleRate = 48000;
const MAX_RECORD_SEC = 20;

type InMsg = { type: 'init'; sampleRate: number; port: MessagePort; minHz?: number } | { type: 'config'; minHz: number } | { type: 'resetAttack' } | { type: 'stop' } | { type: 'record'; seconds: number } | { type: 'cancelRecord' };

function finishRecording() {
  if (!rec) return;
  const total = rec.chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Float32Array(total);
  let o = 0;
  for (const c of rec.chunks) {
    pcm.set(c, o);
    o += c.length;
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ type: 'recording', pcm, sampleRate, startFrame: rec.startFrame }, [pcm.buffer]);
  rec = null;
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const d = e.data;
  if (d.type === 'init') {
    analyzer = new StreamAnalyzer({ sampleRate: d.sampleRate, ...(d.minHz ? { minHz: d.minHz } : {}) });
    sampleRate = d.sampleRate;
    port?.close();
    port = d.port;
    port.onmessage = (m: MessageEvent<{ type: string; startFrame: number; samples: Float32Array }>) => {
      if (m.data.type !== 'pcm' || !analyzer) return;
      if (rec) {
        rec.startFrame ??= m.data.startFrame;
        const take = Math.min(rec.remaining, m.data.samples.length);
        rec.chunks.push(m.data.samples.slice(0, take));
        rec.remaining -= take;
        if (rec.remaining <= 0) finishRecording();
      }
      const out: AnalyzerOutput[] = analyzer.push(m.data.samples, m.data.startFrame);
      if (!out.length) return;
      const frames: PitchFrame[] = [];
      const attacks: AttackObservation[] = [];
      for (const o of out) {
        if (o.type === 'frame') frames.push(o.frame);
        else attacks.push(o.attack);
      }
      (self as unknown as DedicatedWorkerGlobalScope).postMessage({ type: 'results', frames, attacks });
    };
  } else if (d.type === 'config') {
    analyzer = new StreamAnalyzer({ sampleRate, minHz: d.minHz });
  } else if (d.type === 'record') {
    const secs = Math.max(1, Math.min(MAX_RECORD_SEC, d.seconds));
    rec = { chunks: [], remaining: Math.round(secs * sampleRate), startFrame: null };
  } else if (d.type === 'cancelRecord') {
    rec = null;
  } else if (d.type === 'resetAttack') {
    analyzer?.resetAttackState();
  } else if (d.type === 'stop') {
    port?.close();
    port = null;
    analyzer = null;
  }
};
