/**
 * WSOLA time-stretch: slows a recording down without changing its pitch, so a
 * song can be practised at 50 % or 75 % speed with the original audio. Frames
 * of ~64 ms are overlap-added with a Hann window (50 % overlap); each next frame
 * is taken near its nominal position where it best continues the previous one
 * (cross-correlation searched on a 4× decimated signal, then refined).
 * Pure function: runs in a worker and in tests.
 */
export function timeStretch(x: Float32Array, sampleRate: number, rate: number, onProgress?: (f: number) => void, alignShift = 1): Float32Array {
  if (!(rate > 0) || rate === 1 || x.length === 0) return x.slice();
  const N = sampleRate > 24000 ? 2048 : 1024;
  const Hs = N / 2;
  const Ha = Hs * rate;
  const tol = N / 4;
  const D = 4; // decimation for the coarse search
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  // Decimated copy (box-filtered) for the coarse search.
  const xd = new Float32Array(Math.ceil(x.length / D));
  for (let i = 0; i < xd.length; i++) {
    let s = 0;
    for (let k = 0; k < D; k++) s += x[i * D + k] ?? 0;
    xd[i] = s / D;
  }
  const outLen = Math.ceil(x.length / rate);
  const y = new Float32Array(outLen + 2 * N);
  const frames = Math.ceil(outLen / Hs) + 1;
  const L = Hs; // overlap length compared
  let prev = 0;
  // Frame k is centred at output k·Hs + N/2; take input centred at (k·Hs + N/2)·rate so that
  // input time t lands at output t / rate (no constant lead/lag between the copy and the beat).
  const shift = alignShift * (N / 2) * (1 - rate);
  for (let k = 0; k < frames; k++) {
    const nominal = Math.round(k * Ha - shift);
    let pos = nominal;
    if (k > 0 && nominal - tol >= 0) {
      const target = prev + Hs; // natural continuation of the previous frame
      // Coarse search on the decimated signal.
      const tD = Math.floor(target / D), lD = Math.floor(L / D);
      let best = -Infinity, bestPos = nominal;
      for (let p = Math.max(0, nominal - tol); p <= nominal + tol; p += D) {
        const pD = Math.floor(p / D);
        if (pD + lD >= xd.length || tD + lD >= xd.length) break;
        let c = 0, e = 1e-9;
        for (let i = 0; i < lD; i++) {
          const a = xd[pD + i]!;
          c += a * xd[tD + i]!;
          e += a * a;
        }
        const score = c / Math.sqrt(e);
        if (score > best) { best = score; bestPos = p; }
      }
      // Refine ±D at full resolution.
      best = -Infinity;
      pos = bestPos;
      for (let p = Math.max(0, bestPos - D); p <= bestPos + D; p++) {
        if (p + L >= x.length || target + L >= x.length) break;
        let c = 0, e = 1e-9;
        for (let i = 0; i < L; i += 2) {
          const a = x[p + i]!;
          c += a * x[target + i]!;
          e += a * a;
        }
        const score = c / Math.sqrt(e);
        if (score > best) { best = score; pos = p; }
      }
    }
    const o = k * Hs;
    for (let i = Math.max(0, -pos); i < N; i++) {
      const v = x[pos + i];
      if (v === undefined) break;
      y[o + i]! += v * win[i]!;
    }
    prev = pos;
    if (onProgress && k % 2000 === 0) onProgress(k / frames);
  }
  // Measured residual: transients come out ~0.22·N late at every rate (window-weighted
  // placement + the search's forward bias). Drop that lead-in so beats stay aligned.
  const lead = Math.round(N * 0.22 * alignShift);
  return y.subarray(lead, lead + outLen);
}
