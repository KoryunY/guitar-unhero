/**
 * Timing calibration (master spec §6.2). deltaIO is ONE combined offset from a
 * scheduled output event to its observed input-frame onset. Scoring subtracts it
 * once; output latency is never subtracted a second time.
 */
export type CalibrationMethod = 'loopback' | 'manual';

export interface CalibrationRecord {
  method: CalibrationMethod;
  offsetMs: number;
  spreadMs: number | null;
  samples: number;
  deviceId: string | null;
  sampleRate: number | null;
  outputRoute: 'headphones' | 'speakers' | 'unknown';
  createdAt: string;
}

export interface LoopbackEstimate {
  ok: boolean;
  offsetMs: number | null;
  spreadMs: number | null;
  matched: number;
  reason: string | null;
}

/**
 * Pair each scheduled pulse with the nearest onset in [0, maxLag) after it and
 * estimate the median offset. Reject ambiguous or noisy measurements.
 */
export function estimateLoopback(scheduled: number[], onsets: number[], opts: { maxLagSec?: number; minMatched?: number; maxSpreadMs?: number } = {}): LoopbackEstimate {
  const maxLag = opts.maxLagSec ?? 0.35;
  const minMatched = opts.minMatched ?? Math.max(4, Math.ceil(scheduled.length * 0.75));
  const maxSpread = opts.maxSpreadMs ?? 20;
  const used = new Set<number>();
  const lags: number[] = [];
  for (const s of scheduled) {
    let best = -1;
    for (let i = 0; i < onsets.length; i++) {
      if (used.has(i)) continue;
      const d = onsets[i]! - s;
      if (d >= -0.005 && d < maxLag && (best < 0 || d < onsets[best]! - s)) best = i;
    }
    if (best >= 0) {
      used.add(best);
      lags.push(onsets[best]! - s);
    }
  }
  if (lags.length < minMatched) {
    return { ok: false, offsetMs: null, spreadMs: null, matched: lags.length, reason: 'too_few_pulses_heard' };
  }
  const sorted = [...lags].sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1]!;
  // Spread: interquartile range in ms.
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]!;
  const spreadMs = (q3 - q1) * 1000;
  if (spreadMs > maxSpread) {
    return { ok: false, offsetMs: Math.round(med * 1000), spreadMs: Math.round(spreadMs), matched: lags.length, reason: 'inconsistent_measurements' };
  }
  return { ok: true, offsetMs: Math.round(med * 1000), spreadMs: Math.round(spreadMs * 10) / 10, matched: lags.length, reason: null };
}

/** A calibration only applies to the same input device, sample rate and output route. */
export function calibrationValid(
  cal: CalibrationRecord | null,
  current: { deviceId: string | null; sampleRate: number | null; outputRoute: CalibrationRecord['outputRoute'] },
): boolean {
  if (!cal) return false;
  if (cal.method === 'manual') return cal.outputRoute === current.outputRoute;
  return cal.deviceId === current.deviceId && cal.sampleRate === current.sampleRate && cal.outputRoute === current.outputRoute;
}
