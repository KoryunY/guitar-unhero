/**
 * Local audio import with the M3 limits (master spec §7.2): ≤ 25 MiB encoded,
 * ≤ 180 s decoded, ≤ 2 channels, non-empty. Nothing is uploaded; the original
 * file is kept unchanged as a Blob, decoded once, and hashed for provenance.
 */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_SECONDS = 180;

export type ImportFailure = 'unsupported_format' | 'too_large' | 'too_long' | 'decode_failed' | 'internal_error';

export const IMPORT_FAILURE_TEXT: Record<ImportFailure, string> = {
  unsupported_format: 'This file type cannot be played here. Try WAV or MP3.',
  too_large: 'The file is larger than 25 MB. Trim it to the part you want to practise (15–30 seconds is ideal).',
  too_long: 'The recording is longer than 3 minutes. Trim it to the part you want to practise.',
  decode_failed: 'The file could not be decoded. It may be damaged, copy-protected (DRM), or in an unsupported format.',
  internal_error: 'Something went wrong while reading the file. Please try again.',
};

export interface DecodedImport {
  buffer: AudioBuffer;
  sha256: string;
  bytes: number;
  mime: string;
}

export function precheck(file: { size: number; type: string; name: string }): ImportFailure | null {
  if (file.size <= 0) return 'decode_failed';
  if (file.size > MAX_IMPORT_BYTES) return 'too_large';
  const okType = !file.type || file.type.startsWith('audio/') || /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm)$/i.test(file.name);
  return okType ? null : 'unsupported_format';
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function decodeImport(ctx: BaseAudioContext, file: File): Promise<{ ok: true; value: DecodedImport } | { ok: false; reason: ImportFailure }> {
  const pre = precheck(file);
  if (pre) return { ok: false, reason: pre };
  let data: ArrayBuffer;
  try {
    data = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: 'internal_error' };
  }
  const sha256 = await sha256Hex(data);
  let buffer: AudioBuffer;
  try {
    // decodeAudioData detaches its input; pass a copy.
    buffer = await ctx.decodeAudioData(data.slice(0));
  } catch {
    return { ok: false, reason: 'decode_failed' };
  }
  if (buffer.length === 0 || buffer.numberOfChannels < 1) return { ok: false, reason: 'decode_failed' };
  if (buffer.numberOfChannels > 2) return { ok: false, reason: 'unsupported_format' };
  if (buffer.duration > MAX_IMPORT_SECONDS) return { ok: false, reason: 'too_long' };
  return { ok: true, value: { buffer, sha256, bytes: file.size, mime: file.type || 'audio/*' } };
}

/** Mono mix for analysis (the original stays unchanged). */
export function monoMix(buffer: AudioBuffer): Float32Array {
  const n = buffer.length;
  const out = new Float32Array(n);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i]! += ch[i]! / buffer.numberOfChannels;
  }
  return out;
}

/** Peak envelope for drawing a waveform (min/max per bucket). */
export function waveformPeaks(pcm: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const per = Math.max(1, Math.floor(pcm.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let m = 0;
    for (let i = b * per; i < Math.min(pcm.length, (b + 1) * per); i++) m = Math.max(m, Math.abs(pcm[i]!));
    out[b] = m;
  }
  return out;
}
