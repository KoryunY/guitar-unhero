/**
 * Global tuning estimate: each spectral peak's deviation from the nearest
 * equal-tempered pitch (A4 = 440 Hz) goes into a circular 1-cent histogram
 * weighted by √amplitude; the smoothed mode, refined by a local circular mean,
 * is the offset. Returns cents in [−50, 50).
 */
export function estimateTuning(
  peakHz: Float32Array,
  peakAmp: Float32Array,
  peakCount: Uint8Array,
  perFrame: number,
  opts: { minHz?: number; maxHz?: number; rangeDb?: number } = {},
): { cents: number; weight: number; concentration: number } {
  const minHz = opts.minHz ?? 80;
  const maxHz = opts.maxHz ?? 2000;
  const rel = 10 ** (-(opts.rangeDb ?? 30) / 20);
  const hist = new Float64Array(100);
  let total = 0;
  for (let f = 0; f < peakCount.length; f++) {
    const n = peakCount[f]!;
    if (!n) continue;
    const base = f * perFrame;
    const floor = peakAmp[base]! * rel;
    for (let i = 0; i < n; i++) {
      const a = peakAmp[base + i]!;
      if (a < floor) break;
      const hz = peakHz[base + i]!;
      if (hz < minHz || hz > maxHz) continue;
      const c = 1200 * Math.log2(hz / 440);
      const dev = ((Math.round(c) % 100) + 100) % 100;
      const w = Math.sqrt(a);
      hist[dev]! += w;
      total += w;
    }
  }
  if (total <= 0) return { cents: 0, weight: 0, concentration: 0 };
  let best = 0;
  let bestV = -1;
  for (let d = 0; d < 100; d++) {
    let s = 0;
    for (let k = -4; k <= 4; k++) s += hist[(d + k + 100) % 100]! * (5 - Math.abs(k));
    if (s > bestV) {
      bestV = s;
      best = d;
    }
  }
  // Circular mean within ±12 cents of the mode.
  let x = 0;
  let y = 0;
  for (let k = -12; k <= 12; k++) {
    const d = best + k;
    const w = hist[(d + 100) % 100]!;
    x += w * Math.cos((2 * Math.PI * d) / 100);
    y += w * Math.sin((2 * Math.PI * d) / 100);
  }
  let cents = (Math.atan2(y, x) / (2 * Math.PI)) * 100;
  if (cents >= 50) cents -= 100;
  if (cents < -50) cents += 100;
  // How concentrated the deviations are (0 = uniform, e.g. noise/drums; 1 = all on one offset).
  let cx = 0;
  let cy = 0;
  for (let d = 0; d < 100; d++) {
    cx += hist[d]! * Math.cos((2 * Math.PI * d) / 100);
    cy += hist[d]! * Math.sin((2 * Math.PI * d) / 100);
  }
  const concentration = Math.hypot(cx, cy) / total;
  return { cents, weight: total, concentration };
}
