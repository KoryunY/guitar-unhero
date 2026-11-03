/**
 * Song analysis (beats, chords, melody in seconds) → a SongSource in ticks, plus
 * beat anchors so the recording plays in sync. Everything produced here is a
 * candidate: the app worked it out from audio and may be wrong.
 */
import type { SongAnalysis } from '../audio/song';
import { PPQ, type Rights, type SourceAudio } from './score';
import type { SongSource } from './songArrange';

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITY_SUFFIX: Record<string, string> = { maj: '', min: 'm', '7': '7', min7: 'm7', maj7: 'maj7', '5': '5' };

/** Flat spelling for flat keys (F, Bb, Eb… and their relative minors). */
export function usesFlats(key: { tonic: number; mode: 'major' | 'minor' }): boolean {
  const major = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12;
  return [5, 10, 3, 8, 1, 6].includes(major);
}

export function chordName(root: number, quality: string, flats: boolean): string {
  return `${(flats ? FLAT : SHARP)[((root % 12) + 12) % 12]}${QUALITY_SUFFIX[quality] ?? ''}`;
}

export interface BeatGrid {
  /** Beat times (s) from the first bar's downbeat on. */
  beats: number[];
  tickOf(sec: number): number;
  anchors: { tick: number; sourceSec: number }[];
}

export function beatGrid(a: Pick<SongAnalysis, 'beats' | 'downbeatIndex' | 'bpm' | 'durationSec'>): BeatGrid {
  let beats = a.beats.filter((b) => Number.isFinite(b) && b >= 0 && b <= a.durationSec);
  const bpm = Math.min(220, Math.max(40, a.bpm || 100));
  if (beats.length < 8) {
    const step = 60 / bpm;
    beats = Array.from({ length: Math.floor(a.durationSec / step) + 1 }, (_, i) => i * step);
  }
  const i0 = Math.max(0, Math.min(beats.length - 1, (a.downbeatIndex >= 0 ? a.downbeatIndex : 0) % 4));
  const b = beats.slice(i0);
  const last = b.length - 1;
  const lastStep = last > 0 ? b[last]! - b[last - 1]! : 60 / bpm;
  const tickOf = (sec: number): number => {
    if (sec < b[0]!) return ((sec - b[0]!) / (b[1]! - b[0]! || lastStep)) * PPQ;
    if (sec >= b[last]!) return (last + (sec - b[last]!) / lastStep) * PPQ;
    let lo = 0, hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (b[mid]! <= sec) lo = mid;
      else hi = mid;
    }
    return (lo + (sec - b[lo]!) / (b[lo + 1]! - b[lo]!)) * PPQ;
  };
  const anchors: { tick: number; sourceSec: number }[] = [];
  b.forEach((s, k) => {
    const prev = anchors[anchors.length - 1];
    const sec = Math.round(s * 1000) / 1000;
    if (!prev || sec > prev.sourceSec) anchors.push({ tick: k * PPQ, sourceSec: sec });
  });
  return { beats: b, tickOf, anchors: anchors.slice(0, 10000) };
}

const snap = (tick: number, grid: number) => Math.round(tick / grid) * grid;

export function analysisToSource(
  a: SongAnalysis,
  base: { arrangementId: string; title: string; rights: Rights; createdBy: string; sourceAudio: Omit<SourceAudio, 'anchors' | 'alignmentStatus'>; providerId: string; providerVersion: string },
): { source: SongSource; anchors: { tick: number; sourceSec: number }[]; warnings: string[] } {
  const grid = beatGrid(a);
  const durationTicks = Math.max(4 * PPQ, Math.ceil(grid.tickOf(a.durationSec) / (4 * PPQ)) * 4 * PPQ);
  const flats = usesFlats(a.key);
  const chords = a.chords
    .filter((c) => c.quality !== 'N' && c.root !== null)
    .map((c) => {
      const s = Math.max(0, snap(grid.tickOf(c.startSec), PPQ / 2));
      const e = Math.min(durationTicks, snap(grid.tickOf(c.endSec), PPQ / 2));
      return { startTick: s, durationTicks: e - s, name: chordName(c.root!, c.quality, flats) };
    })
    .filter((c) => c.durationTicks >= PPQ / 2);
  const notes = a.melody
    .map((n) => {
      const s = snap(grid.tickOf(n.startSec), PPQ / 4);
      const e = snap(grid.tickOf(n.endSec), PPQ / 4);
      return { startTick: s, durationTicks: Math.max(PPQ / 4, e - s), midi: Math.round(n.midi) };
    })
    .filter((n) => n.startTick >= 0 && n.startTick < durationTicks);
  const sections = a.sections.map((s, i) => ({ startTick: Math.max(0, snap(grid.tickOf(s.startSec), 4 * PPQ)), name: s.label.length <= 2 ? `Part ${s.label || i + 1}` : s.label }));
  const anchors = grid.anchors.filter((x) => x.tick <= durationTicks && x.sourceSec <= a.durationSec);
  const source: SongSource = {
    arrangementId: base.arrangementId,
    title: base.title,
    bpm: Math.round(Math.min(300, Math.max(20, a.bpm)) * 100) / 100,
    durationTicks,
    notes,
    chords,
    sections,
    rights: base.rights,
    method: 'model_candidate',
    createdBy: base.createdBy,
    providerId: base.providerId,
    providerVersion: base.providerVersion,
    sourceAudio: anchors.length >= 2 ? { ...base.sourceAudio, alignmentStatus: 'candidate', anchors } : undefined,
  };
  return { source, anchors, warnings: a.warnings };
}
