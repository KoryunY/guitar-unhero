/**
 * Pitch-preserving slowed-down copies of a backing recording, made once per
 * speed in a worker and kept in memory for this session (never saved).
 */
const cache = new WeakMap<AudioBuffer, Map<number, Promise<AudioBuffer>>>();

export function stretchedBacking(buffer: AudioBuffer, rate: number): Promise<AudioBuffer> {
  let m = cache.get(buffer);
  if (!m) cache.set(buffer, (m = new Map()));
  const hit = m.get(rate);
  if (hit) return hit;
  // Keep at most one slowed copy per recording in memory (a 15-minute song at 50 % is ~230 MB).
  m.clear();
  const p = new Promise<AudioBuffer>((resolve, reject) => {
    const w = new Worker(new URL('./stretch.worker.ts', import.meta.url), { type: 'module' });
    const pcm = buffer.getChannelData(0).slice();
    w.onmessage = (e: MessageEvent<{ type: string; pcm?: Float32Array; message?: string }>) => {
      if (e.data.type === 'result' && e.data.pcm) {
        const out = new AudioBuffer({ length: e.data.pcm.length, sampleRate: buffer.sampleRate, numberOfChannels: 1 });
        out.copyToChannel(e.data.pcm as Float32Array<ArrayBuffer>, 0);
        w.terminate();
        resolve(out);
      } else if (e.data.type === 'error') {
        w.terminate();
        reject(new Error(e.data.message));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message));
    };
    w.postMessage({ pcm, sampleRate: buffer.sampleRate, rate }, [pcm.buffer]);
  });
  p.catch(() => m!.delete(rate));
  m.set(rate, p);
  return p;
}
