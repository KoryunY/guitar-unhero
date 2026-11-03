/**
 * Local audio import: whole songs up to 15 minutes / 80 MiB encoded. Nothing is
 * uploaded; the original file is kept unchanged as a Blob and hashed for
 * provenance. For playback the song is decoded once to mono at 32 kHz (≈ 7.7 MB
 * per minute in memory, so a long song still fits on a phone); analysis uses a
 * 22.05 kHz mono copy rendered from that.
 */
export const MAX_IMPORT_BYTES = 80 * 1024 * 1024;
export const MAX_IMPORT_SECONDS = 15 * 60;
export const PLAYBACK_RATE = 32000;
export const ANALYSIS_RATE = 22050;

export type ImportFailure = 'unsupported_format' | 'too_large' | 'too_long' | 'decode_failed' | 'internal_error';

export const IMPORT_FAILURE_TEXT: Record<ImportFailure, string> = {
  unsupported_format: 'This file type cannot be played here. Try WAV or MP3.',
  too_large: 'The file is larger than 80 MB. Try an MP3 or M4A version of the song.',
  too_long: 'The recording is longer than 15 minutes. Trim it, or import the part you want to learn.',
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
  const okType = !file.type || file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm' || /\.(wav|mp3|m4a|mp4|aac|ogg|oga|opus|flac|webm|aif|aiff)$/i.test(file.name);
  return okType ? null : 'unsupported_format';
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode for playback: mono at PLAYBACK_RATE when OfflineAudioContext exists
 * (it resamples while decoding), otherwise with the given context.
 */
async function decodeForPlayback(fallback: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const Off = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Off) return fallback.decodeAudioData(data);
  const off = new Off(1, 1, PLAYBACK_RATE);
  const decoded = await off.decodeAudioData(data);
  if (decoded.numberOfChannels === 1) return decoded;
  const mono = off.createBuffer(1, decoded.length, decoded.sampleRate);
  mono.getChannelData(0).set(monoMix(decoded));
  return mono;
}

/** Decode a stored song file for playback (same memory-saving path as import). */
export async function decodeBlobForPlayback(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> {
  return decodeForPlayback(ctx, await blob.arrayBuffer());
}

/** 22.05 kHz mono copy for song analysis (rendered, so it is properly low-pass filtered). */
export async function analysisPcm(buffer: AudioBuffer): Promise<Float32Array> {
  const Off = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Off || buffer.sampleRate === ANALYSIS_RATE) return monoMix(buffer);
  const off = new Off(1, Math.max(1, Math.ceil(buffer.duration * ANALYSIS_RATE)), ANALYSIS_RATE);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
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
    buffer = await decodeForPlayback(ctx, data.slice(0));
  } catch {
    return { ok: false, reason: 'decode_failed' };
  }
  if (buffer.length === 0 || buffer.numberOfChannels < 1) return { ok: false, reason: 'decode_failed' };
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
