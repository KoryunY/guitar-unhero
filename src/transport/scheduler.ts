/**
 * Lookahead scheduler (master spec TIME-03). A UI timer only *refills* the
 * schedule; musical time always comes from the AudioContext clock via the
 * transport. One-shot sources are recreated for every scheduled item, and all
 * live handles are stopped on pause/seek/rate/loop/mode changes.
 */
import type { ScheduledItem, Transport } from './transport';

export interface SourceHandle {
  stop(): void;
}

export interface OutputSink {
  /** Schedule an item at item.contextTime. Return null when nothing audible is created. */
  schedule(item: ScheduledItem): SourceHandle | null;
}

export class Scheduler {
  readonly lookahead: number;
  private readonly handles = new Map<string, { item: ScheduledItem; handle: SourceHandle | null }>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly transport: Transport,
    private readonly sink: OutputSink,
    private readonly now: () => number,
    opts: { lookahead?: number } = {},
  ) {
    this.lookahead = opts.lookahead ?? 0.1;
    this.unsubscribe = transport.subscribe((e) => {
      if (e.type === 'stopAll') this.stopAll();
    });
  }

  /** Refill the schedule. Returns items newly scheduled in this tick. */
  tick(): ScheduledItem[] {
    const now = this.now();
    this.transport.update(now);
    const fresh: ScheduledItem[] = [];
    for (const item of this.transport.scheduleWindow(now, now + this.lookahead)) {
      if (this.handles.has(item.key)) continue;
      const handle = this.sink.schedule(item);
      this.handles.set(item.key, { item, handle });
      fresh.push(item);
    }
    for (const [key, v] of this.handles) {
      if (v.item.contextTime < now - 5) this.handles.delete(key);
    }
    return fresh;
  }

  /** Stop every source that is still pending or sounding. */
  stopAll(): void {
    for (const { handle } of this.handles.values()) handle?.stop();
    this.handles.clear();
  }

  get pendingCount(): number {
    return this.handles.size;
  }

  dispose(): void {
    this.stopAll();
    this.unsubscribe();
  }
}
