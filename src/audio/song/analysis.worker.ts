/// <reference lib="webworker" />
/**
 * Runs the full-song analysis off the main thread with progress. The PCM is
 * transferred in, analysed and dropped; nothing is stored or sent anywhere.
 * Cancel = terminate the worker (the analysis is synchronous inside it).
 */
import { analyzeSong } from './analyze';
import type { SongWorkerMessage, SongWorkerRequest } from './types';

self.onmessage = (e: MessageEvent<SongWorkerRequest>) => {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  const post = (m: SongWorkerMessage) => scope.postMessage(m);
  if (e.data?.type !== 'analyze') return;
  try {
    const analysis = analyzeSong(e.data.pcm, e.data.sampleRate, { onProgress: (fraction, stage) => post({ type: 'progress', fraction, stage }) });
    post({ type: 'result', analysis });
  } catch (err) {
    post({ type: 'error', message: (err as Error).message });
  }
};
