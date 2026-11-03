/**
 * Signal-usability timeline for assessment coverage. Each interval says whether
 * listening was usable at that context time. Missing intervals count as
 * unavailable, so a sensor outage can never become a "missed note".
 */
import type { SignalQuality } from '../audio/observations';

export interface SignalInterval {
  start: number;
  end: number;
  quality: SignalQuality;
  reason: string | null;
}

export interface Coverage {
  good: number;
  poor: number;
  unavailable: number;
  /** Most common non-good reason inside the window, if any. */
  reason: string | null;
}

export class SignalTimeline {
  private items: SignalInterval[] = [];
  private blocks: { start: number; end: number; reason: string }[] = [];

  add(start: number, end: number, quality: SignalQuality, reason: string | null = null): void {
    if (end <= start) return;
    this.items.push({ start, end, quality, reason });
    if (this.items.length > 20000) this.items.splice(0, 5000);
  }

  /** Mark a span where assessment is disabled (e.g. reference tone, guide audible on speakers). */
  block(start: number, end: number, reason: string): void {
    this.blocks.push({ start, end, reason });
    if (this.blocks.length > 2000) this.blocks.splice(0, 500);
  }

  /** Extend an open-ended block (end = Infinity) to a concrete end. */
  endBlocks(reason: string, end: number): void {
    for (const b of this.blocks) if (b.reason === reason && b.end === Infinity) b.end = end;
  }

  clear(): void {
    this.items = [];
    this.blocks = [];
  }

  coverage(start: number, end: number): Coverage {
    const span = end - start;
    if (span <= 0) return { good: 0, poor: 0, unavailable: 1, reason: 'empty_window' };
    // Blocks dominate.
    let blocked = 0;
    const reasonCount = new Map<string, number>();
    for (const b of this.blocks) {
      const ov = Math.min(end, b.end) - Math.max(start, b.start);
      if (ov > 0) {
        blocked += ov;
        reasonCount.set(b.reason, (reasonCount.get(b.reason) ?? 0) + ov);
      }
    }
    blocked = Math.min(blocked, span);
    let good = 0;
    let poor = 0;
    // Union of observed intervals per quality (frames can overlap slightly).
    const covered: [number, number, SignalQuality, string | null][] = [];
    for (const it of this.items) {
      const s = Math.max(start, it.start);
      const e = Math.min(end, it.end);
      if (e > s) covered.push([s, e, it.quality, it.reason]);
    }
    covered.sort((a, b) => a[0] - b[0]);
    let cursor = start;
    for (const [s0, e, q, r] of covered) {
      const s = Math.max(s0, cursor);
      if (e <= s) continue;
      const len = e - s;
      if (q === 'good') good += len;
      else if (q === 'poor') {
        poor += len;
        if (r) reasonCount.set(r, (reasonCount.get(r) ?? 0) + len);
      } else if (r) reasonCount.set(r, (reasonCount.get(r) ?? 0) + len);
      cursor = e;
    }
    // Blocked time is removed from good/poor proportionally.
    const observed = good + poor;
    if (blocked > 0 && observed > 0) {
      const keep = Math.max(0, (observed - blocked) / observed);
      good *= keep;
      poor *= keep;
    }
    const unavailable = Math.max(0, span - good - poor);
    if (unavailable > 0.5 * span && reasonCount.size === 0) reasonCount.set('listening_unavailable', unavailable);
    let reason: string | null = null;
    let best = 0;
    for (const [r, v] of reasonCount) if (v > best) { best = v; reason = r; }
    return { good: good / span, poor: poor / span, unavailable: unavailable / span, reason };
  }
}
