/** Minimal WAV (RIFF PCM) encode/decode: 16-bit write; 16-bit int or 32-bit float read. */
export function encodeWav16(pcm: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i]!)) * 32767), true);
  return new Uint8Array(buf);
}

/** Decode mono (or first channel of) 16-bit PCM / 32-bit float WAV. Throws on anything else. */
export function decodeWav(bytes: Uint8Array): { pcm: Float32Array; sampleRate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let o = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  while (o + 8 <= bytes.length) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: v.getUint16(o + 8, true), channels: v.getUint16(o + 10, true), sampleRate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    if (id === 'data' && fmt) {
      const bps = fmt.bits / 8;
      const frames = Math.floor(size / (bps * fmt.channels));
      const pcm = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const p = o + 8 + i * bps * fmt.channels;
        if (fmt.format === 1 && fmt.bits === 16) pcm[i] = v.getInt16(p, true) / 32768;
        else if (fmt.format === 3 && fmt.bits === 32) pcm[i] = v.getFloat32(p, true);
        else throw new Error(`Unsupported WAV encoding (format ${fmt.format}, ${fmt.bits}-bit)`);
      }
      return { pcm, sampleRate: fmt.sampleRate };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}
