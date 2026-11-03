/** Write deterministic 16-bit mono WAV fixtures for Chromium's fake audio capture. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { midiHz, placeAt, pluck, whiteNoise, mix } from './signals';

export function wavBytes(pcm: Float32Array, sampleRate: number): Buffer {
  const n = pcm.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i]!)) * 32767), 44 + i * 2);
  return buf;
}

/** Repeating original synthetic E4 plucks (1.5 s apart) over a faint noise floor. */
export function writeE4PlucksWav(path: string, sampleRate = 48000): string {
  const total = 12;
  const plucks = placeAt(sampleRate, total, Array.from({ length: 8 }, (_, i) => ({ atSec: 0.5 + i * 1.5, sig: pluck(sampleRate, midiHz(64), 1.4, 0.35, 10 + i, 0.9985) })));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wavBytes(mix(plucks, whiteNoise(sampleRate, total, 0.0008)), sampleRate));
  return path;
}
