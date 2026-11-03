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

type InMsg = { type: 'init'; sampleRate: number; port: MessagePort } | { type: 'resetAttack' } | { type: 'stop' };

self.onmessage = (e: MessageEvent<InMsg>) => {
  const d = e.data;
  if (d.type === 'init') {
    analyzer = new StreamAnalyzer({ sampleRate: d.sampleRate });
    port?.close();
    port = d.port;
    port.onmessage = (m: MessageEvent<{ type: string; startFrame: number; samples: Float32Array }>) => {
      if (m.data.type !== 'pcm' || !analyzer) return;
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
  } else if (d.type === 'resetAttack') {
    analyzer?.resetAttackState();
  } else if (d.type === 'stop') {
    port?.close();
    port = null;
    analyzer = null;
  }
};
