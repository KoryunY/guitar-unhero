/**
 * Tap-along pulse check. Times are performance.now() milliseconds; click times are
 * when each click is expected to be *heard* (output-clock mapping). Keyboard and
 * audio-output delay are included, so this is a personal timing indication, not a
 * precise measurement.
 */
export interface PulseResult {
  taps: number;
  matched: number;
  onBeat: number;
  meanErrorMs: number | null;
  /** Mean absolute deviation from the mean error: steadiness. */
  spreadMs: number | null;
}

export function scoreTaps(clicksMs: readonly number[], tapsMs: readonly number[], toleranceMs = 150): PulseResult {
  const used = new Set<number>();
  const errs: number[] = [];
  for (const t of tapsMs) {
    let best = -1;
    for (let i = 0; i < clicksMs.length; i++) {
      if (used.has(i)) continue;
      if (best < 0 || Math.abs(clicksMs[i]! - t) < Math.abs(clicksMs[best]! - t)) best = i;
    }
    if (best >= 0 && Math.abs(clicksMs[best]! - t) <= 400) {
      used.add(best);
      errs.push(t - clicksMs[best]!);
    }
  }
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  return {
    taps: tapsMs.length,
    matched: errs.length,
    onBeat: errs.filter((e) => Math.abs(e) <= toleranceMs).length,
    meanErrorMs: mean === null ? null : Math.round(mean),
    spreadMs: mean === null ? null : Math.round(errs.reduce((a, e) => a + Math.abs(e - mean), 0) / errs.length),
  };
}

export function pulseFeedback(r: PulseResult, beats: number): { pass: boolean; text: string } {
  if (r.taps === 0) return { pass: false, text: 'No taps yet. Tap Space (or the big button) on each click.' };
  const pass = r.onBeat >= Math.ceil(beats * 0.75);
  const lean =
    r.meanErrorMs === null ? '' : Math.abs(r.meanErrorMs) < 40 ? 'Nicely centred on the beat.' : r.meanErrorMs > 0 ? `You tend to tap a little after the click (about ${r.meanErrorMs} ms).` : `You tend to tap a little before the click (about ${-r.meanErrorMs} ms).`;
  return {
    pass,
    text: `${r.onBeat} of ${beats} taps landed near a click. ${lean}${pass ? ' Great pulse.' : ' Try again and count “1, 2, 3, 4” out loud.'} (Approximate: includes keyboard and audio delay.)`,
  };
}
