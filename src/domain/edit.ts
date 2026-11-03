/**
 * Immutable editing of monophonic gu-score/1 arrangements (master spec §7.4).
 * Every operation returns a new score; `commitVersion` stamps a new immutable
 * version with a parent link and a transformation log entry. Placing a note
 * keeps the part monophonic by trimming/removing what it overlaps (logged).
 */
import { PPQ, sortEvents, type NoteEvent, type Rights, type Score, type StringNumber, type Transformation } from './score';
import { openMidi } from './tuning';
import { defaultFinger } from './fingering';

export const BAR_TICKS = PPQ * 4;

export function blankScore(opts: { arrangementId: string; title: string; bpm: number; bars: number; rights: Rights; createdBy?: string; now?: Date }): Score {
  return {
    schemaVersion: 'gu-score/1',
    arrangementId: opts.arrangementId,
    version: 1,
    parent: null,
    title: opts.title.slice(0, 200) || 'Untitled',
    role: 'original_exercise',
    ppq: 960,
    durationTicks: Math.max(1, opts.bars) * BAR_TICKS,
    instrument: {
      type: 'six_string_guitar',
      capo: 0,
      maxFret: 22,
      strings: [
        { number: 1, openMidi: 64 },
        { number: 2, openMidi: 59 },
        { number: 3, openMidi: 55 },
        { number: 4, openMidi: 50 },
        { number: 5, openMidi: 45 },
        { number: 6, openMidi: 40 },
      ],
    },
    tempoMap: [{ tick: 0, bpm: Math.min(300, Math.max(20, Math.round(opts.bpm * 100) / 100)) }],
    meterMap: [{ tick: 0, numerator: 4, denominator: 4 }],
    events: [],
    rights: opts.rights,
    provenance: {
      createdAt: (opts.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      createdBy: opts.createdBy ?? 'Guitar Unhero user (local)',
      method: 'authored',
      reviewStatus: 'unreviewed',
      reviewer: null,
      notes: 'Created in the local score editor.',
    },
    transformations: [],
  };
}

function nextId(score: Score): string {
  let max = 0;
  for (const e of score.events) {
    const m = /^e(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `e${max + 1}`;
}

function withEvents(score: Score, events: NoteEvent[]): Score {
  const sorted = sortEvents(events);
  const end = sorted.reduce((m, e) => Math.max(m, e.startTick + e.durationTicks), 0);
  const durationTicks = Math.max(score.durationTicks, Math.ceil(end / BAR_TICKS) * BAR_TICKS);
  return { ...score, events: sorted, durationTicks };
}

export interface NoteSpec {
  startTick: number;
  durationTicks: number;
  string: StringNumber;
  fret: number;
}

export function makeEvent(id: string, n: NoteSpec): NoteEvent {
  return {
    id,
    kind: 'note',
    startTick: n.startTick,
    durationTicks: n.durationTicks,
    pitchMidi: openMidi(n.string) + n.fret,
    string: n.string,
    fret: n.fret,
    finger: defaultFinger(n.fret, n.fret <= 4 ? 1 : n.fret - 3),
    sourceEventIds: [],
    assessment: { pitch: true, attack: true, sustain: false },
  };
}

/** Insert a note; earlier overlapping notes are shortened, later ones it covers are removed. */
export function placeNote(score: Score, n: NoteSpec): { score: Score; id: string; removed: string[]; trimmed: string[] } {
  if (n.fret < 0 || n.fret > score.instrument.maxFret) throw new RangeError(`Fret must be 0–${score.instrument.maxFret}`);
  if (n.durationTicks < 1 || n.startTick < 0) throw new RangeError('Invalid note timing');
  const id = nextId(score);
  const end = n.startTick + n.durationTicks;
  const removed: string[] = [];
  const trimmed: string[] = [];
  const kept: NoteEvent[] = [];
  for (const e of score.events) {
    const eEnd = e.startTick + e.durationTicks;
    if (e.startTick >= n.startTick && e.startTick < end) {
      removed.push(e.id);
    } else if (e.startTick < n.startTick && eEnd > n.startTick) {
      trimmed.push(e.id);
      kept.push({ ...e, durationTicks: n.startTick - e.startTick });
    } else kept.push(e);
  }
  kept.push(makeEvent(id, n));
  return { score: withEvents(score, kept), id, removed, trimmed };
}

export function deleteNote(score: Score, id: string): Score {
  return withEvents(score, score.events.filter((e) => e.id !== id));
}

export function updateNote(score: Score, id: string, patch: Partial<NoteSpec> & { finger?: NoteEvent['finger'] }): Score {
  const e = score.events.find((x) => x.id === id);
  if (!e) return score;
  const spec: NoteSpec = {
    startTick: patch.startTick ?? e.startTick,
    durationTicks: patch.durationTicks ?? e.durationTicks,
    string: patch.string ?? e.string,
    fret: patch.fret ?? e.fret,
  };
  const without = { ...score, events: score.events.filter((x) => x.id !== id) };
  const placed = placeNote(without, spec);
  // Keep the original ID for a stable reference.
  let events = placed.score.events.map((x) => (x.id === placed.id ? { ...x, id } : x));
  if (patch.finger !== undefined) events = events.map((x) => (x.id === id ? { ...x, finger: x.fret === 0 ? null : patch.finger! } : x));
  return { ...placed.score, events };
}

export function setTempo(score: Score, bpm: number): Score {
  return { ...score, tempoMap: [{ tick: 0, bpm: Math.min(300, Math.max(20, Math.round(bpm * 100) / 100)) }] };
}

/** Stamp a new immutable version (parent link + transformation log). */
export function commitVersion(prev: Score, next: Score, t: Omit<Transformation, 'resultEventIds'> & { resultEventIds?: string[] }, now = new Date()): Score {
  const resultIds = t.resultEventIds ?? next.events.map((e) => e.id);
  const known = new Set(next.events.map((e) => e.id));
  return {
    ...next,
    version: prev.version + 1,
    parent: { arrangementId: prev.arrangementId, version: prev.version },
    provenance: { ...next.provenance, createdAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z') },
    transformations: [...next.transformations, { kind: t.kind, description: t.description.slice(0, 1000), sourceEventIds: t.sourceEventIds, resultEventIds: resultIds.filter((x) => known.has(x)) }].slice(-1000),
  };
}

/** Simple undo/redo history of score states. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(public present: T, private readonly limit = 100) {}
  push(next: T): void {
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = next;
    this.future = [];
  }
  undo(): T {
    const p = this.past.pop();
    if (p !== undefined) {
      this.future.push(this.present);
      this.present = p;
    }
    return this.present;
  }
  redo(): T {
    const f = this.future.pop();
    if (f !== undefined) {
      this.past.push(this.present);
      this.present = f;
    }
    return this.present;
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
}
