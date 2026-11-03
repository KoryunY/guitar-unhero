/**
 * Real-recording evaluation harness (AC-08 path). Put WAV + .labels.json pairs
 * saved from the Diagnostics screen into tests/fixtures/recordings/ and run
 * `pnpm test:recordings`. With no recordings the suite reports that and passes;
 * set GU_EVAL_STRICT=1 to enforce the AC-08 gate.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeClip, type DiagnosticLabel } from '../../src/audio/diagnostics';
import { decodeWav, encodeWav16 } from '../../src/audio/wav';
import { guitarLike, midiHz, placeAt } from '../fixtures/signals';

const DIR = join(__dirname, '../fixtures/recordings');

describe('WAV round trip and clip analysis', () => {
  it('encodes/decodes 16-bit WAV and analyzes a guided clip', () => {
    const sr = 44100;
    const sig = placeAt(sr, 8, [0.5, 2, 3.5, 5].map((t, i) => ({ atSec: t, sig: guitarLike(sr, midiHz(45), 1.4, { seed: i + 1 }) })));
    const { pcm, sampleRate } = decodeWav(encodeWav16(sig, sr));
    expect(sampleRate).toBe(sr);
    const r = analyzeClip(pcm, sampleRate, 45, 4);
    expect(r.attacks).toBe(4);
    expect(r.onTarget).toBe(4);
    expect(r.wrongPitch).toBe(0);
  });
});

describe('real recordings (tests/fixtures/recordings)', () => {
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.wav')) : [];
  if (files.length === 0) {
    it('no recordings present — AC-08 remains pending (record some in Diagnostics)', () => {
      process.stderr.write('\nRECORDINGS none found in tests/fixtures/recordings — AC-08 not run.\n');
      expect(true).toBe(true);
    });
    return;
  }
  let totalFrames = 0, within = 0, plucksAsked = 0, heard = 0, onTarget = 0, wrong = 0;
  for (const f of files) {
    it(f, () => {
      const labelPath = join(DIR, f.replace(/\.wav$/, '.labels.json'));
      if (!existsSync(labelPath)) throw new Error(`Missing label file for ${f}`);
      const label = JSON.parse(readFileSync(labelPath, 'utf8')) as DiagnosticLabel;
      const { pcm, sampleRate } = decodeWav(new Uint8Array(readFileSync(join(DIR, f))));
      const r = analyzeClip(pcm, sampleRate, label.targetMidi, label.requestedPlucks);
      totalFrames += r.steadyFrames;
      within += Math.round((r.framesWithin15 ?? 0) * r.steadyFrames);
      plucksAsked += r.requestedPlucks;
      heard += r.pitched;
      onTarget += r.onTarget;
      wrong += r.wrongPitch;
      process.stderr.write(`\nRECORDING ${f}: attacks=${r.attacks} pitched=${r.pitched} onTarget=${r.onTarget} wrong=${r.wrongPitch} median=${r.medianCents?.toFixed(1)}c within15=${r.framesWithin15?.toFixed(2)}\n`);
    });
  }
  it('summary', () => {
    const frac = totalFrames ? within / totalFrames : null;
    process.stderr.write(`\nRECORDINGS SUMMARY files=${files.length} plucks asked=${plucksAsked} pitched=${heard} onTarget=${onTarget} wrong=${wrong} steady frames ±15c=${frac?.toFixed(3)} (AC-08 target ≥0.95)\n`);
    if (process.env.GU_EVAL_STRICT === '1') expect(frac ?? 0).toBeGreaterThanOrEqual(0.95);
  });
});
