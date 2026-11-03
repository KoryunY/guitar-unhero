/// <reference lib="webworker" />
/** Runs the experimental transcriber off the main thread with progress; cancel = terminate. */
import { transcribeRaw } from './transcribe';

self.onmessage = (e: MessageEvent<{ pcm: Float32Array; sampleRate: number }>) => {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  try {
    const result = transcribeRaw(e.data.pcm, e.data.sampleRate, (f) => scope.postMessage({ type: 'progress', fraction: f }));
    scope.postMessage({ type: 'done', result });
  } catch (err) {
    scope.postMessage({ type: 'error', message: (err as Error).message });
  }
};
