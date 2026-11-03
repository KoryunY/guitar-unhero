/**
 * Original Karplus–Strong plucked-string renderer used for demonstrations,
 * reference tones and the metronome. Pure: returns PCM, so the browser wraps it in
 * an AudioBuffer and tests can feed it to the analyzer (leakage regression).
 */
export function renderPluck(sampleRate: number, hz: number, seconds = 1.6, amp = 0.35, seed = 12345): Float32Array {
  const n = Math.round(sampleRate * seconds);
  const out = new Float32Array(n);
  const period = sampleRate / hz - 0.5;
  const L = Math.max(2, Math.floor(period));
  const frac = period - L;
  const c = (1 - frac) / (1 + frac);
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const buf = new Float64Array(L);
  for (let i = 0; i < L; i++) buf[i] = rnd() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < L; i++) buf[i] = 0.5 * (buf[i]! + buf[i - 1]!);
  let mean = 0;
  for (let i = 0; i < L; i++) mean += buf[i]!;
  mean /= L;
  for (let i = 0; i < L; i++) buf[i]! -= mean;
  // Decay per period chosen so higher notes don't ring unrealistically long.
  const decay = Math.min(0.9985, Math.max(0.985, 1 - hz / 60000));
  let idx = 0, prev = 0, apX = 0, apY = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx]!;
    const avg = decay * 0.5 * (cur + prev);
    prev = cur;
    const y = c * avg + apX - c * apY;
    apX = avg;
    apY = y;
    buf[idx] = y;
    idx = (idx + 1) % L;
    out[i] = cur;
    peak = Math.max(peak, Math.abs(cur));
  }
  const g = peak > 0 ? amp / peak : 0;
  const fadeIn = Math.min(n, Math.round(sampleRate * 0.002));
  const fadeOut = Math.min(n, Math.round(sampleRate * 0.05));
  for (let i = 0; i < n; i++) {
    let e = g;
    if (i < fadeIn) e *= i / fadeIn;
    if (i > n - fadeOut) e *= (n - i) / fadeOut;
    out[i]! *= e;
  }
  return out;
}

/** Short filtered-noise click: deliberately aperiodic so it carries no pitch evidence. */
export function renderClick(sampleRate: number, accent: boolean): Float32Array {
  const n = Math.round(sampleRate * 0.025);
  const out = new Float32Array(n);
  let s = accent ? 99 : 7;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const noise = s / 2147483648 - 1;
    lp = lp + 0.6 * (noise - lp);
    const hp = noise - lp;
    const env = Math.exp(-i / (sampleRate * (accent ? 0.006 : 0.004)));
    out[i] = (accent ? 0.5 : 0.32) * hp * env;
  }
  return out;
}
