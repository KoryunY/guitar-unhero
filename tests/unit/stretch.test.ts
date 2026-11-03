import { describe, expect, it } from 'vitest';
import { timeStretch } from '../../src/audio/dsp/stretch';
import { Yin } from '../../src/audio/dsp/yin';

const SR = 32000;
function tone(hz: number, sec: number): Float32Array {
  const x = new Float32Array(Math.round(SR * sec));
  for (let i = 0; i < x.length; i++) x[i] = 0.4 * Math.sin((2 * Math.PI * hz * i) / SR) + 0.2 * Math.sin((4 * Math.PI * hz * i) / SR);
  return x;
}

describe('WSOLA time-stretch', () => {
  it('halves the speed: twice as long, same pitch', () => {
    const x = tone(220, 2);
    const y = timeStretch(x, SR, 0.5);
    expect(y.length).toBe(x.length * 2);
    const yin = new Yin({ sampleRate: SR, bufferSize: 2048, minHz: 70, maxHz: 1000 });
    const mid = y.subarray(y.length / 2, y.length / 2 + 2048);
    const r = yin.detect(mid);
    expect(r.hz).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(r.hz! / 220))).toBeLessThan(10);
  });
  it('keeps the level steady (no holes or doubling at frame joins)', () => {
    const x = tone(330, 2);
    const y = timeStretch(x, SR, 0.75);
    expect(y.length).toBe(Math.ceil(x.length / 0.75));
    const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    const ref = rms(x.subarray(SR / 2, SR));
    for (let t = 0.5; t < 2.2; t += 0.25) {
      const seg = y.subarray(Math.round(t * SR), Math.round((t + 0.1) * SR));
      expect(Math.abs(rms(seg) / ref - 1)).toBeLessThan(0.2);
    }
  });
  it('a 3-minute song stretches in reasonable time', () => {
    const x = new Float32Array(SR * 180);
    for (let i = 0; i < x.length; i++) x[i] = Math.sin(i * 0.05) * 0.3 + Math.sin(i * 0.013) * 0.2;
    const t0 = performance.now();
    const y = timeStretch(x, SR, 0.5);
    const ms = performance.now() - t0;
    expect(y.length).toBe(x.length * 2);
    console.log(`stretch 180 s @ 0.5: ${Math.round(ms)} ms`);
    expect(ms).toBeLessThan(20000);
  });
});
