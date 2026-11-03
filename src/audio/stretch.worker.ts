/// <reference lib="webworker" />
import { timeStretch } from './dsp/stretch';

self.onmessage = (e: MessageEvent<{ pcm: Float32Array; sampleRate: number; rate: number }>) => {
  const { pcm, sampleRate, rate } = e.data;
  try {
    const out = timeStretch(pcm, sampleRate, rate, (f) => (self as unknown as Worker).postMessage({ type: 'progress', fraction: f }));
    const copy = out.slice();
    (self as unknown as Worker).postMessage({ type: 'result', pcm: copy, rate }, [copy.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: (err as Error).message });
  }
};
