/**
 * Tick ↔ source-second maps (master spec TIME-02).
 * - Constant tempo: s(q) = q·60/(960·B).
 * - Alignment anchors (tick, sourceSec) of an imported recording: monotonic
 *   piecewise-linear interpolation, extrapolated with the nearest segment's slope.
 * The transport, scheduler, highway and matcher all use one map, so the score,
 * clicks and a backing recording stay on the same timeline.
 */
import { PPQ } from '../domain/score';

export interface TimeMap {
  readonly kind: 'tempo' | 'anchors';
  tickToSec(tick: number): number;
  secToTick(sec: number): number;
  /** Duration of one quarter-note beat around source second `sec`. */
  beatSecAt(sec: number): number;
  /** Nominal BPM for display (local at sec for anchor maps). */
  bpmAt(sec: number): number;
}

export class ConstantTempoMap implements TimeMap {
  readonly kind = 'tempo' as const;
  constructor(readonly bpm: number) {
    if (!(bpm > 0)) throw new RangeError('BPM must be positive');
  }
  tickToSec(tick: number): number {
    return (tick * 60) / (PPQ * this.bpm);
  }
  secToTick(sec: number): number {
    return (sec * PPQ * this.bpm) / 60;
  }
  beatSecAt(): number {
    return 60 / this.bpm;
  }
  bpmAt(): number {
    return this.bpm;
  }
}

export interface Anchor {
  tick: number;
  sourceSec: number;
}

export class AnchorTimeMap implements TimeMap {
  readonly kind = 'anchors' as const;
  readonly anchors: readonly Anchor[];

  /** Requires ≥2 anchors strictly increasing in both tick and sourceSec. */
  constructor(anchors: readonly Anchor[]) {
    if (anchors.length < 2) throw new RangeError('At least two alignment anchors are required');
    for (let i = 1; i < anchors.length; i++) {
      if (!(anchors[i]!.tick > anchors[i - 1]!.tick && anchors[i]!.sourceSec > anchors[i - 1]!.sourceSec)) {
        throw new RangeError('Alignment anchors must strictly increase in tick and seconds');
      }
    }
    this.anchors = [...anchors];
  }

  /** Binary search: the segment [i, i+1] containing `v` (clamped to the first/last segment). */
  private segIndex(v: number, key: 'tick' | 'sourceSec'): number {
    const a = this.anchors;
    let lo = 0, hi = a.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (v >= a[mid]![key]) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private segIndexByTick(tick: number): number {
    return this.segIndex(tick, 'tick');
  }

  private segIndexBySec(sec: number): number {
    return this.segIndex(sec, 'sourceSec');
  }

  tickToSec(tick: number): number {
    const i = this.segIndexByTick(tick);
    const p = this.anchors[i]!;
    const q = this.anchors[i + 1]!;
    return p.sourceSec + ((tick - p.tick) * (q.sourceSec - p.sourceSec)) / (q.tick - p.tick);
  }

  secToTick(sec: number): number {
    const i = this.segIndexBySec(sec);
    const p = this.anchors[i]!;
    const q = this.anchors[i + 1]!;
    return p.tick + ((sec - p.sourceSec) * (q.tick - p.tick)) / (q.sourceSec - p.sourceSec);
  }

  beatSecAt(sec: number): number {
    const i = this.segIndexBySec(sec);
    const p = this.anchors[i]!;
    const q = this.anchors[i + 1]!;
    return ((q.sourceSec - p.sourceSec) * PPQ) / (q.tick - p.tick);
  }

  bpmAt(sec: number): number {
    return 60 / this.beatSecAt(sec);
  }
}
