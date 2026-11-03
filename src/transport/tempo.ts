/**
 * Time-domain mapping (master spec §6.1).
 *  q: score ticks (PPQ 960)
 *  s: source seconds (score time at 100% tempo)
 *  c: AudioContext seconds
 * Constant tempo: s(q) = q * 60 / (960 * B).
 * Segment: s(c) = s0 + r * (c - c0)  ⇔  c(s) = c0 + (s - s0) / r.
 */
import { PPQ } from '../domain/score';

export function ticksToSec(tick: number, bpm: number): number {
  return (tick * 60) / (PPQ * bpm);
}

export function secToTicks(sec: number, bpm: number): number {
  return (sec * PPQ * bpm) / 60;
}

export function beatSec(bpm: number): number {
  return 60 / bpm;
}

export interface Segment {
  /** Increments for each play/resume/continue; loop wraps keep the epoch. */
  epoch: number;
  loopIteration: number;
  s0: number;
  c0: number;
  rate: number;
  /** Source second at which this segment ends (loop B, score end or wait target). */
  endS: number;
}

export function sourceAt(seg: Pick<Segment, 's0' | 'c0' | 'rate'>, c: number): number {
  return seg.s0 + seg.rate * (c - seg.c0);
}

export function contextAt(seg: Pick<Segment, 's0' | 'c0' | 'rate'>, s: number): number {
  return seg.c0 + (s - seg.s0) / seg.rate;
}

export function segmentEndContext(seg: Segment): number {
  return contextAt(seg, seg.endS);
}

/**
 * Segment history so a delayed observation spanning a rate change or loop wrap
 * maps with the segment that was active at its own timestamp.
 */
export class SegmentHistory {
  private items: Segment[] = [];

  push(seg: Segment): void {
    this.items.push(seg);
    if (this.items.length > 256) this.items.shift();
  }

  clear(): void {
    this.items = [];
  }

  get all(): readonly Segment[] {
    return this.items;
  }

  get latest(): Segment | undefined {
    return this.items[this.items.length - 1];
  }

  /** The segment active at context time c (latest with c0 ≤ c), if any. */
  at(c: number): Segment | undefined {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const seg = this.items[i]!;
      if (seg.c0 <= c) return seg;
    }
    return undefined;
  }
}
