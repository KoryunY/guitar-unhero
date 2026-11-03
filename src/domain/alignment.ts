/**
 * Alignment of a recording to the score grid (master spec §7.4).
 * Tap-tempo: the learner taps on beats while the recording plays; a least-squares
 * line through (beat index, tap time) gives the beat period and the first
 * downbeat. Anchors must strictly increase; implausible slopes and large
 * residuals (tempo drift, repeats, rubato) are reported, not hidden.
 */
import { PPQ } from './score';
import type { Anchor } from '../transport/timemap';

export interface TapFit {
  ok: boolean;
  bpm: number | null;
  /** Recording second of the first tapped beat. */
  firstBeatSec: number | null;
  /** RMS deviation of taps from the fitted line, ms. */
  residualMs: number | null;
  /** Largest single deviation, ms. */
  maxDeviationMs: number | null;
  warnings: string[];
  reason: string | null;
}

/**
 * Fit beat times. Taps are recording seconds. Gaps of ~2 beats (a missed tap)
 * are tolerated by assigning each tap to the nearest beat index.
 */
export function fitTaps(taps: readonly number[]): TapFit {
  const fail = (reason: string): TapFit => ({ ok: false, bpm: null, firstBeatSec: null, residualMs: null, maxDeviationMs: null, warnings: [], reason });
  const t = [...taps].sort((a, b) => a - b);
  if (t.length < 4) return fail('Tap at least 4 beats (8 is better).');
  const iois = t.slice(1).map((x, i) => x - t[i]!).sort((a, b) => a - b);
  const median = iois[iois.length >> 1]!;
  if (!(median > 0.2 && median < 2)) return fail('Taps were too fast or too slow to be beats (30–300 BPM).');
  // Assign beat indexes using the median interval.
  const idx = t.map((x) => Math.round((x - t[0]!) / median));
  for (let i = 1; i < idx.length; i++) if (idx[i]! <= idx[i - 1]!) return fail('Two taps landed on the same beat. Tap once per beat.');
  // Least squares t = a + b·k.
  const n = t.length;
  const mk = idx.reduce((s, k) => s + k, 0) / n;
  const mt = t.reduce((s, x) => s + x, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (idx[i]! - mk) * (t[i]! - mt);
    sxx += (idx[i]! - mk) ** 2;
  }
  const b = sxy / sxx;
  const a = mt - b * mk;
  const dev = t.map((x, i) => x - (a + b * idx[i]!));
  const rms = Math.sqrt(dev.reduce((s, d) => s + d * d, 0) / n) * 1000;
  const maxDev = Math.max(...dev.map((d) => Math.abs(d))) * 1000;
  const warnings: string[] = [];
  // Drift: compare beat periods fitted to the first and second half of the taps.
  if (n >= 8) {
    const half = (from: number, to: number) => {
      const ks = idx.slice(from, to);
      const ts = t.slice(from, to);
      const mk2 = ks.reduce((s2, k) => s2 + k, 0) / ks.length;
      const mt2 = ts.reduce((s2, x) => s2 + x, 0) / ts.length;
      let nxy = 0, nxx = 0;
      ks.forEach((k, i) => {
        nxy += (k - mk2) * (ts[i]! - mt2);
        nxx += (k - mk2) ** 2;
      });
      return nxy / nxx;
    };
    const b1 = half(0, Math.floor(n / 2));
    const b2 = half(Math.floor(n / 2), n);
    if (Math.abs(b2 / b1 - 1) > 0.05) warnings.push('The recording (or your tapping) changes speed. One tempo will not stay in sync — add more anchors or tap a shorter section.');
  }
  if (rms > 40) warnings.push('Your taps were uneven (or the recording changes speed). The match will drift — try tapping again, or add anchors later in the song.');
  if (idx[idx.length - 1]! + 1 > n + 2) warnings.push('Some beats were skipped; the fit assumes one tap per beat.');
  return { ok: true, bpm: Math.round((60 / b) * 100) / 100, firstBeatSec: a, residualMs: Math.round(rms), maxDeviationMs: Math.round(maxDev), warnings, reason: null };
}

/** Two anchors for a constant-tempo fit: tick 0 at the first beat, and `bars` bars later. */
export function anchorsFromFit(fit: TapFit, totalTicks: number): Anchor[] {
  if (!fit.ok || fit.bpm === null || fit.firstBeatSec === null) throw new Error('No valid fit');
  const beat = 60 / fit.bpm;
  return [
    { tick: 0, sourceSec: fit.firstBeatSec },
    { tick: totalTicks, sourceSec: fit.firstBeatSec + (totalTicks / PPQ) * beat },
  ];
}

export interface AnchorCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function checkAnchors(anchors: readonly Anchor[], audioDurationSec: number): AnchorCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (anchors.length < 2) errors.push('At least two anchors are needed to align a recording.');
  for (let i = 1; i < anchors.length; i++) {
    if (!(anchors[i]!.tick > anchors[i - 1]!.tick && anchors[i]!.sourceSec > anchors[i - 1]!.sourceSec)) errors.push(`Anchor ${i + 1} must come after anchor ${i} in both the score and the recording.`);
  }
  anchors.forEach((a, i) => {
    if (a.sourceSec < 0 || a.sourceSec > audioDurationSec) errors.push(`Anchor ${i + 1} is outside the recording.`);
  });
  if (!errors.length) {
    const bpms = anchors.slice(1).map((a, i) => (60 * (a.tick - anchors[i]!.tick)) / PPQ / (a.sourceSec - anchors[i]!.sourceSec));
    if (bpms.some((b) => b < 30 || b > 300)) warnings.push('An anchor pair implies an implausible tempo (below 30 or above 300 BPM). Check for a repeated or skipped section.');
    for (let i = 1; i < bpms.length; i++) {
      const r = bpms[i]! / bpms[i - 1]!;
      if (r > 1.3 || r < 0.77) warnings.push(`The speed changes sharply between anchors ${i} and ${i + 2}. If a section repeats or is cut in the recording, the score must match it.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
