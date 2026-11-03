import { describe, expect, it } from 'vitest';
import { asciiTabToSong, countTabStaves } from '../../src/domain/importers/asciiTab';
import { chordSheetToSong, isChordLine, looksLikeChordPro } from '../../src/domain/importers/chordSheet';
import { expandRepeats } from '../../src/domain/importers/common';
import { detectGuitarPro, guitarProToSong, inspectGuitarPro } from '../../src/domain/importers/guitarPro';
import { detectImportFormat, importSong } from '../../src/domain/importers/index';
import { inspectMidi, midiToSong } from '../../src/domain/importers/midi';
import { inspectMusicXml, musicXmlToSong } from '../../src/domain/importers/musicxml';
import type { ImportedNote, ImportedSong, ImportOutcome, TechniqueKind } from '../../src/domain/importers/types';
import { fretToMidi, openMidi } from '../../src/domain/tuning';
import type { StringNumber } from '../../src/domain/score';

// ---------------------------------------------------------------------------------------
// Helpers

function ok(r: ImportOutcome): ImportedSong {
  if (!r.ok) throw new Error(`import failed: ${r.error.code} ${r.error.message}`);
  return r.song;
}

function errCode(r: ImportOutcome | { ok: boolean; error?: { code: string } }): string {
  expect(r.ok).toBe(false);
  return (r as { error: { code: string } }).error.code;
}

const kinds = (n: ImportedNote | undefined): TechniqueKind[] => (n?.techniques ?? []).map((t) => t.kind);
const at = (song: ImportedSong, tick: number) => song.notes.filter((n) => n.startTick === tick);

/** Every note with a string/fret must sound open string + capo + fret (standard tuning unless given). */
function expectConsistentFrets(song: ImportedSong): void {
  for (const n of song.notes) {
    if (n.string === undefined || n.fret === undefined) continue;
    if (n.techniques?.some((t) => t.kind === 'harmonic' || t.kind === 'dead_note')) continue;
    expect(n.midi).toBe(song.tuning.openMidiByString[n.string - 1]! + song.capo + n.fret);
    if (song.tuning.standard) expect(n.midi).toBe(fretToMidi(n.string as StringNumber, n.fret + song.capo));
  }
}

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------
// A tiny Standard MIDI File writer

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  n >>>= 7;
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  return out;
}
const meta = (type: number, data: number[]) => [0xff, type, ...vlq(data.length), ...data];
const utf8 = (s: string) => [...new TextEncoder().encode(s)];
const tempo = (bpm: number) => {
  const us = Math.round(60_000_000 / bpm);
  return meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);
};
const timeSig = (n: number, d: number) => meta(0x58, [n, Math.log2(d), 24, 8]);
const trackName = (s: string) => meta(0x03, utf8(s));
const marker = (s: string) => meta(0x06, utf8(s));
type Ev = [delta: number, bytes: number[]];
function mtrk(events: Ev[], end = true): number[] {
  const body = events.flatMap(([d, b]) => [...vlq(d), ...b]);
  if (end) body.push(...vlq(0), ...meta(0x2f, []));
  return [...ascii('MTrk'), ...u32(body.length), ...body];
}
function smf(format: number, division: number, tracks: number[][]): Uint8Array {
  return new Uint8Array([...ascii('MThd'), ...u32(6), ...u16(format), ...u16(tracks.length), ...u16(division), ...tracks.flat()]);
}
/** Notes on one channel: [key, startTick, durTicks, velocity?] (absolute ticks). */
function noteEvents(channel: number, notes: [number, number, number, number?][], program?: number): Ev[] {
  const raw: { t: number; b: number[] }[] = [];
  if (program !== undefined) raw.push({ t: 0, b: [0xc0 | channel, program] });
  for (const [key, start, dur, vel] of notes) {
    raw.push({ t: start, b: [0x90 | channel, key, vel ?? 96] });
    raw.push({ t: start + dur, b: [0x80 | channel, key, 64] });
  }
  raw.sort((a, b) => a.t - b.t || (a.b[0]! & 0xf0) - (b.b[0]! & 0xf0));
  let last = 0;
  return raw.map((r) => {
    const ev: Ev = [r.t - last, r.b];
    last = r.t;
    return ev;
  });
}

/** Format 0: one track, running status, sysex, a drum note on channel 10. Division 480. */
function format0File(): Uint8Array {
  return smf(0, 480, [
    mtrk([
      [0, trackName('Riff')],
      [0, tempo(100)],
      [0, timeSig(3, 4)],
      [0, [0xc0, 25]],
      [0, [0x90, 40, 100]],
      [480, [45, 90]], // running status: note on A2
      [0, [40, 0]], // running status: velocity 0 = note off E2
      [480, [45, 0]],
      [0, [0xf0, ...vlq(3), 0x7e, 0x7f, 0xf7]], // sysex (cancels running status)
      [0, [0x99, 38, 100]], // drums on channel 10
      [0, [0x90, 50, 80]],
      [240, [0x89, 38, 0]],
      [240, [0x80, 50, 0]],
    ]),
  ]);
}

/** Format 1: conductor, a busy piano, a guitar (program 27) with a chord, and drums. Division 96. */
function format1File(): Uint8Array {
  const bar = 4 * 96;
  const conductor = mtrk([
    [0, trackName('Test Song')],
    [0, tempo(120)],
    [0, timeSig(4, 4)],
    [0, marker('Intro')],
    [4 * bar, marker('Verse')],
    [0, tempo(140)],
  ]);
  const piano = mtrk([[0, trackName('Keys')], ...noteEvents(0, Array.from({ length: 20 }, (_, k) => [60 + (k % 12), k * 48, 48] as [number, number, number]), 0)]);
  const guitar = mtrk([
    [0, trackName('Gtr')],
    ...noteEvents(1, [[52, 0, 96], [55, 96, 96], [57, 192, 96], [52, 288, 96], [59, 288, 96], [64, 288, 96]], 27),
  ]);
  const drums = mtrk([[0, trackName('Kit')], ...noteEvents(9, [[36, 0, 24], [38, 96, 24], [42, 192, 24]])]);
  return smf(1, 96, [conductor, piano, guitar, drums]);
}

// ---------------------------------------------------------------------------------------

describe('MIDI importer', () => {
  it('reads format 0 with running status, sysex, tempo and time signature, converting to PPQ 960', () => {
    const insp = inspectMidi(format0File());
    if (!insp.ok) throw new Error(insp.error.message);
    const { tracks, defaultSelection } = insp.inspection;
    expect(insp.inspection.format).toBe(0);
    expect(insp.inspection.ticksPerQuarter).toBe(480);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({ channel: 1, program: 25, programName: 'Acoustic Guitar (steel)', noteCount: 3, lowMidi: 40, highMidi: 50, isDrums: false, guitarLikely: true, maxPolyphony: 1 });
    expect(tracks[1]).toMatchObject({ channel: 10, isDrums: true, guitarLikely: false, noteCount: 1 });
    expect(defaultSelection).toEqual([0]);
    const song = ok(midiToSong(format0File()));
    expect(song.source).toBe('midi');
    expect(song.ppq).toBe(960);
    expect(song.bpm).toBe(100);
    expect([song.beatsPerBar, song.beatUnit]).toEqual([3, 4]);
    expect(song.title).toBe('Riff');
    expect(song.notes.map((n) => [n.startTick, n.durationTicks, n.midi])).toEqual([[0, 960, 40], [960, 960, 45], [1920, 960, 50]]);
    expect(song.notes[0]!.velocity).toBe(100);
    expect(song.durationTicks % (3 * 960)).toBe(0);
    expect(song.tuning.standard).toBe(true);
  });

  it('never imports channel 10 drums', () => {
    const r = midiToSong(format0File(), [0, 1]);
    const song = ok(r);
    expect(song.notes.every((n) => n.midi !== 38)).toBe(true);
    expect(song.warnings.join(' ')).toMatch(/drum/i);
    expect(errCode(midiToSong(format0File(), [1]))).toBe('no_notes');
  });

  it('reads format 1: picks the GM guitar part, keeps markers as sections and warns about tempo changes', () => {
    const insp = inspectMidi(format1File());
    if (!insp.ok) throw new Error(insp.error.message);
    const names = insp.inspection.tracks.map((t) => t.name);
    expect(names).toEqual(['Keys', 'Gtr', 'Kit']);
    expect(insp.inspection.tracks[1]).toMatchObject({ program: 27, maxPolyphony: 3, trackNumber: 2, channel: 2 });
    expect(insp.inspection.defaultSelection).toEqual([1]);
    const song = ok(midiToSong(format1File()));
    expect(song.title).toBe('Test Song');
    expect(song.bpm).toBe(120);
    expect(song.notes.map((n) => n.midi)).toEqual([52, 55, 57, 52, 59, 64]);
    expect(at(song, 3 * 960).map((n) => n.midi)).toEqual([52, 59, 64]);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Intro' }, { startTick: 4 * 4 * 960, name: 'Verse' }]);
    expect(song.warnings.join(' ')).toMatch(/tempo changes.*140 BPM at bar 5/);
    expect(errCode(midiToSong(format1File(), [7]))).toBe('bad_selection');
  });

  it('falls back to the busiest non-drum part mostly in guitar range', () => {
    const bass = mtrk(noteEvents(0, Array.from({ length: 30 }, (_, k) => [28 + (k % 8), k * 48, 48] as [number, number, number]), 33));
    const lead = mtrk(noteEvents(1, Array.from({ length: 10 }, (_, k) => [62 + (k % 5), k * 96, 96] as [number, number, number]), 73));
    const insp = inspectMidi(smf(1, 96, [bass, lead]));
    if (!insp.ok) throw new Error(insp.error.message);
    expect(insp.inspection.tracks[0]!.guitarLikely).toBe(false);
    expect(insp.inspection.defaultSelection).toEqual([1]);
  });

  it('pairs repeated notes first-on first-off and closes unterminated notes with a warning', () => {
    const t = mtrk([[0, [0x90, 60, 90]], [96, [0x90, 60, 90]], [96, [0x80, 60, 0]], [96, [0x80, 60, 0]], [0, [0x90, 64, 90]], [192, [0xb0, 7, 100]]]);
    const song = ok(midiToSong(smf(0, 96, [t])));
    expect(song.notes.map((n) => [n.startTick, n.durationTicks, n.midi])).toEqual([[0, 1920, 60], [960, 1920, 60], [2880, 1920, 64]]);
    expect(song.warnings.join(' ')).toMatch(/never ended/);
  });

  it('accepts a RIFF RMID wrapper and SMPTE timing', () => {
    const inner = format0File();
    const riff = new Uint8Array([...ascii('RIFF'), ...u32(inner.length + 12), ...ascii('RMID'), ...ascii('data'), ...u32(inner.length), ...inner]);
    expect(ok(midiToSong(riff)).notes).toHaveLength(3);
    const smpteDiv = ((256 - 25) << 8) | 40; // 25 fps × 40 ticks per frame = 1000 ticks per second
    const t = mtrk(noteEvents(0, [[60, 0, 500], [62, 500, 500]]));
    const song = ok(midiToSong(new Uint8Array([...ascii('MThd'), ...u32(6), 0, 0, 0, 1, ...u16(smpteDiv), ...t])));
    expect(song.bpm).toBe(120);
    expect(song.notes.map((n) => n.startTick)).toEqual([0, 960]);
    expect(song.warnings.join(' ')).toMatch(/seconds/);
  });

  it('keeps good tracks when another track is damaged', () => {
    const good = mtrk(noteEvents(0, [[60, 0, 96]], 25));
    const bad = mtrk([[0, [0x40, 0x40]]]); // data bytes with no status byte
    const song = ok(midiToSong(smf(1, 96, [good, bad])));
    expect(song.notes).toHaveLength(1);
    expect(song.warnings.join(' ')).toMatch(/damaged/);
  });

  it('rejects non-MIDI, format 2, oversized and truncated input cleanly', () => {
    expect(errCode(midiToSong(new Uint8Array()))).toBe('empty');
    expect(errCode(midiToSong(new TextEncoder().encode('hello, this is not a midi file')))).toBe('not_midi');
    expect(errCode(midiToSong(new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0])))).toBe('not_midi');
    expect(errCode(midiToSong(smf(2, 96, [mtrk([])])))).toBe('unsupported_format');
    expect(errCode(midiToSong(new Uint8Array(4 * 1024 * 1024 + 1)))).toBe('too_large');
    expect(errCode(inspectMidi(new ArrayBuffer(3)))).toBe('not_midi');
    const full = format1File();
    for (let len = 0; len <= full.length; len++) {
      const r = midiToSong(full.slice(0, len));
      expect(typeof r.ok).toBe('boolean');
    }
  });

  it('survives random byte corruption without throwing', () => {
    const rand = rng(1234);
    const base = format1File();
    for (let k = 0; k < 400; k++) {
      const b = base.slice();
      const flips = 1 + Math.floor(rand() * 8);
      for (let f = 0; f < flips; f++) b[Math.floor(rand() * b.length)] = Math.floor(rand() * 256);
      const r = midiToSong(b);
      expect(typeof r.ok).toBe('boolean');
      if (r.ok) for (const n of r.song.notes) expect(n.durationTicks).toBeGreaterThan(0);
      expect(typeof inspectMidi(b).ok).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------------------

const BASIC_TAB = `Title: Morning Exercise
Tempo: 120

[Intro]
e|-----------------|-----------------|
B|-----------------|-----------------|
G|-----------------|-----------------|
D|-----------------|-----------------|
A|-----------------|-----------------|
E|--0---3---5---7--|--8---10--12-----|

These words are only here to be ignored by the importer

[Verse]
e|--0-------------|
B|--1-------------|
G|--0-------------|
D|--2-------------|
A|--3-------------|
E|----------------|
`;

describe('ASCII tab importer', () => {
  it('reads staves, multi-digit frets and bar lines; strings use 1 = high E', () => {
    const song = ok(asciiTabToSong(BASIC_TAB));
    expect(song.source).toBe('tab');
    expect(song.title).toBe('Morning Exercise');
    expect(song.bpm).toBe(120);
    expect(song.tuning).toMatchObject({ name: 'Standard', standard: true, openMidiByString: [64, 59, 55, 50, 45, 40] });
    const riff = song.notes.filter((n) => n.string === 6);
    expect(riff.map((n) => n.fret)).toEqual([0, 3, 5, 7, 8, 10, 12]);
    expect(riff.map((n) => n.midi)).toEqual([40, 43, 45, 47, 48, 50, 52]);
    // Even spacing → quarter notes; the second bar starts at 3840.
    expect(riff.map((n) => n.startTick)).toEqual([0, 960, 1920, 2880, 3840, 4800, 5760]);
    expectConsistentFrets(song);
    expect(song.warnings[0]).toMatch(/rhythm/i);
  });

  it('treats digits in one column as a chord and stacks staves in order', () => {
    const song = ok(asciiTabToSong(BASIC_TAB));
    const chord = at(song, 2 * 3840);
    expect(chord.map((n) => [n.string, n.fret, n.midi])).toEqual([[5, 3, 48], [4, 2, 52], [3, 0, 55], [2, 1, 60], [1, 0, 64]]);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Intro' }, { startTick: 2 * 3840, name: 'Verse' }]);
    expect(JSON.stringify(song)).not.toMatch(/ignored by the importer/);
  });

  it('groups multi-digit frets with the notes under them', () => {
    const tab = `e|--0--12--|
B|--1--10--|
G|--0--9---|
D|--2--10--|
A|--3--x---|
E|-----x---|`;
    const song = ok(asciiTabToSong(tab));
    const starts = [...new Set(song.notes.map((n) => n.startTick))];
    expect(starts).toHaveLength(2);
    const second = at(song, starts[1]!);
    expect(second.map((n) => n.string).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(second.find((n) => n.string === 1)!.midi).toBe(76);
    expect(second.filter((n) => kinds(n).includes('dead_note'))).toHaveLength(2);
    expect(second.find((n) => n.string === 5)!.fret).toBeUndefined();
  });

  it('reads techniques: h p / \\ b r ~ x PM ( ) <12> t', () => {
    const tab = `e|--------------------------------------<12>------|
B|--------------------5b7r5-----------------------|
G|--------5h7p5--7/9--------9\\7-------------------|
D|---------------------------------------------t7-|
A|-------------------------------x--(3)-----------|
E|--0~~~------------------------------------------|
    PM--`;
    const song = ok(asciiTabToSong(tab));
    const n = (s: number, f: number) => song.notes.filter((x) => x.string === s && x.fret === f);
    const e0 = n(6, 0)[0]!;
    expect(kinds(e0)).toEqual(expect.arrayContaining(['vibrato', 'palm_mute']));
    const g = song.notes.filter((x) => x.string === 3);
    expect(g.map((x) => [x.fret, kinds(x)])).toEqual([
      [5, []], [7, ['hammer_on']], [5, ['pull_off']], [7, []], [9, ['slide_up']], [9, []], [7, ['slide_down']],
    ]);
    const bend = n(2, 5);
    expect(bend).toHaveLength(1);
    expect(bend[0]!.techniques).toEqual([{ kind: 'bend', semitones: 2 }, { kind: 'release' }]);
    expect(song.notes.some((x) => x.string === 2 && x.fret === 7)).toBe(false);
    const dead = song.notes.find((x) => kinds(x).includes('dead_note'))!;
    expect([dead.string, dead.fret, dead.midi]).toEqual([5, undefined, 45]);
    const ghost = n(5, 3)[0]!;
    expect(ghost.velocity).toBeLessThan(80);
    const harm = n(1, 12)[0]!;
    expect(kinds(harm)).toEqual(['harmonic']);
    expect(harm.midi).toBe(76);
    expect(kinds(n(4, 7)[0])).toEqual(['tap']);
    expect(song.notes.filter((x) => kinds(x).includes('palm_mute'))).toHaveLength(1);
  });

  it('expands x2 marks and |: :| repeats', () => {
    const twice = `e|------------------|
B|------------------|
G|------------------|
D|------------------|
A|------------------|
E|--0-------3-------|  x2`;
    const s1 = ok(asciiTabToSong(twice));
    expect(s1.notes.map((n) => [n.startTick, n.fret])).toEqual([[0, 0], [1920, 3], [3840, 0], [5760, 3]]);

    const region = `e|--------|:-------:|--------|
B|--------|:-------:|--------|
G|--------|:-------:|--------|
D|--------|:-------:|--------|
A|--------|:-------:|--------|
E|--0-----|:--3----:|--5-----|
x3`;
    const s2 = ok(asciiTabToSong(region));
    expect(s2.notes.map((n) => [n.startTick, n.fret])).toEqual([[0, 0], [3840, 3], [7680, 3], [11520, 3], [15360, 5]]);
  });

  it('detects drop D from the string names and warns', () => {
    const tab = `e|-----------|
B|-----------|
G|-----------|
D|-----------|
A|-----------|
D|--0--2--3--|`;
    const song = ok(asciiTabToSong(tab));
    expect(song.tuning).toMatchObject({ name: 'Drop D', standard: false, openMidiByString: [64, 59, 55, 50, 45, 38] });
    expect(song.notes.map((n) => n.midi)).toEqual([38, 40, 41]);
    expect(song.warnings.join(' ')).toMatch(/Drop D/);
    expectConsistentFrets(song);
  });

  it('reads a "Tuning:" line, a capo line, staves without names, and a low-string-on-top layout', () => {
    const named = ok(asciiTabToSong(`Tuning: Drop D\nCapo 2\n|-----|\n|-----|\n|-----|\n|-----|\n|-----|\n|--0--|`));
    expect(named.tuning.name).toBe('Drop D');
    expect(named.capo).toBe(2);
    expect(named.notes[0]!.midi).toBe(38 + 2);
    expect(named.warnings.join(' ')).toMatch(/capo on fret 2/);

    const flipped = ok(asciiTabToSong(`E|--0--------|
A|-----2-----|
D|-----------|
G|-----------|
B|-----------|
e|--------3--|`));
    expect(flipped.notes.map((n) => [n.string, n.midi])).toEqual([[6, 40], [5, 47], [1, 67]]);
    expect(flipped.warnings.join(' ')).toMatch(/flipped/);
  });

  it('counts staves and rejects text without tab cleanly', () => {
    expect(countTabStaves(BASIC_TAB)).toBe(2);
    expect(errCode(asciiTabToSong('Just some words.\nNo tab here at all.'))).toBe('no_tab');
    expect(errCode(asciiTabToSong(''))).toBe('empty');
    expect(errCode(asciiTabToSong(42 as unknown as string))).toBe('empty');
    const bass = `G|-----|\nD|-----|\nA|--3--|\nE|-----|`;
    expect(errCode(asciiTabToSong(bass))).toBe('no_tab');
    expect(errCode(asciiTabToSong(`e|-----|\nB|-----|\nG|-----|\nD|-----|\nA|-----|\nE|-----|`))).toBe('no_notes');
  });

  it('places chord names written above a staff', () => {
    const song = ok(asciiTabToSong(`   Em                G
e|-----------------|-----------------|
B|-----------------|-----------------|
G|-----------------|-----------------|
D|-----2-----------|-----------------|
A|--2-----2--------|-----------------|
E|-0-----------0---|--3-----------3--|`));
    expect(song.chords.map((c) => [c.name, c.startTick])).toEqual([['Em', 0], ['G', 3840]]);
  });

  it('never throws on random tab-like text', () => {
    const rand = rng(99);
    const alphabet = 'eBGDAE|-0123456789hpbr/\\~x()<>[]: \n*PMx2';
    for (let k = 0; k < 300; k++) {
      let s = '';
      const len = Math.floor(rand() * 400);
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
      const r = asciiTabToSong(s);
      expect(typeof r.ok).toBe('boolean');
      if (r.ok) expectConsistentFrets(r.song);
    }
    for (let cut = 0; cut < BASIC_TAB.length; cut += 7) expect(typeof asciiTabToSong(BASIC_TAB.slice(0, cut)).ok).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------------------

const LYRIC_SHEET = `Title: Paper Boats
Artist: The Test Band

[Verse 1]
G              C           D
Paper boats are drifting down the gutter
Em             C
Rain keeps tapping on the window

[Chorus]
G    D    Em   C
`;

describe('chord sheet importer', () => {
  it('reads chords over lyrics, drops the lyrics, keeps title, artist and sections', () => {
    const song = ok(chordSheetToSong(LYRIC_SHEET));
    expect(song.source).toBe('chord_sheet');
    expect(song.notes).toEqual([]);
    expect([song.title, song.artist]).toEqual(['Paper Boats', 'The Test Band']);
    expect(song.chords.map((c) => c.name)).toEqual(['G', 'C', 'D', 'Em', 'C', 'G', 'D', 'Em', 'C']);
    const json = JSON.stringify(song);
    for (const word of ['drifting', 'gutter', 'tapping', 'window']) expect(json).not.toContain(word);
    expect(song.warnings.join(' ')).toMatch(/words were left out/);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Verse 1' }, { startTick: 5 * 3840, name: 'Chorus' }]);
  });

  it('spreads chords over a lyric line by column, one bar per chord in total, on beats', () => {
    const song = ok(chordSheetToSong(LYRIC_SHEET));
    const first = song.chords.slice(0, 3);
    expect(first[0]!.startTick).toBe(0);
    for (const c of first) expect(c.startTick % 960).toBe(0);
    expect(first[1]!.startTick).toBeGreaterThan(0);
    expect(first[2]!.startTick).toBeGreaterThan(first[1]!.startTick);
    expect(song.chords[3]!.startTick).toBe(3 * 3840);
    // Chord-only line: one bar each.
    expect(song.chords.slice(5).map((c) => [c.startTick, c.durationTicks])).toEqual([[20 * 960, 3840], [24 * 960, 3840], [28 * 960, 3840], [32 * 960, 3840]]);
  });

  it('reads bar notation with beat marks, % and repeats', () => {
    const song = ok(chordSheetToSong(`| Am . F . | % | C |
| G | D | x2
|: Em | C :| D |`));
    expect(song.chords.map((c) => [c.name, c.startTick, c.durationTicks])).toEqual([
      ['Am', 0, 1920], ['F', 1920, 1920], ['Am', 3840, 1920], ['F', 5760, 1920], ['C', 7680, 3840],
      ['G', 11520, 3840], ['D', 15360, 3840], ['G', 19200, 3840], ['D', 23040, 3840],
      ['Em', 26880, 3840], ['C', 30720, 3840], ['Em', 34560, 3840], ['C', 38400, 3840], ['D', 42240, 3840],
    ]);
  });

  it('reads beat slashes: every token is a beat', () => {
    const song = ok(chordSheetToSong('G / / / C / D /'));
    expect(song.chords.map((c) => [c.name, c.startTick, c.durationTicks])).toEqual([['G', 0, 3840], ['C', 3840, 1920], ['D', 5760, 1920]]);
  });

  it('reads ChordPro directives, sections and inline chords without keeping lyrics', () => {
    const text = `{title: Little Lantern}
{artist: Nobody Famous}
{key: G}
{tempo: 96}
{time: 3/4}
# a comment line
{start_of_verse: Verse 1}
[G]Little lantern [C]glowing by the [G]door
{end_of_verse}
{start_of_chorus}
[D]Hold it [Em]high and [C]carry it [D]home
{end_of_chorus}`;
    expect(looksLikeChordPro(text)).toBe(true);
    const song = ok(chordSheetToSong(text));
    expect([song.title, song.artist, song.bpm, song.beatsPerBar, song.beatUnit]).toEqual(['Little Lantern', 'Nobody Famous', 96, 3, 4]);
    expect(song.chords.map((c) => c.name)).toEqual(['G', 'C', 'G', 'D', 'Em', 'C', 'D']);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Verse 1' }, { startTick: 3 * 2880, name: 'Chorus' }]);
    const json = JSON.stringify(song);
    for (const word of ['glowing', 'carry', 'lantern ', 'comment']) expect(json).not.toContain(word);
  });

  it('detects capo and plain section labels, and warns about unreadable chord names', () => {
    const song = ok(chordSheetToSong(`Capo: 3rd fret
Intro:
Em  G  Hm7  D
Chorus x2
C  G`));
    expect(song.capo).toBe(3);
    expect(song.warnings.join(' ')).toMatch(/shapes you play with the capo on fret 3/);
    expect(song.warnings.join(' ')).toMatch(/Hm7/);
    expect(song.sections.map((s) => s.name)).toEqual(['Intro', 'Chorus']);
    expect(song.chords.map((c) => c.name)).toEqual(['Em', 'G', 'D', 'C', 'G']);
  });

  it('does not mistake lyric lines for chords', () => {
    expect(isChordLine('A day goes by and I wait')).toBe(false);
    expect(isChordLine('Am I the only one')).toBe(false);
    expect(isChordLine('Em   G   D   C')).toBe(true);
    expect(isChordLine('E')).toBe(true);
    expect(errCode(chordSheetToSong('A day goes by\nI wait for you\nEnd of the road'))).toBe('no_chords');
    expect(errCode(chordSheetToSong('   \n  '))).toBe('empty');
  });

  it('never throws on random text', () => {
    const rand = rng(7);
    const alphabet = 'ABCDEFGabcdefg#m7|/.%x2[]{}: \n:soc}title';
    for (let k = 0; k < 300; k++) {
      let s = '';
      const len = Math.floor(rand() * 300);
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
      expect(typeof chordSheetToSong(s).ok).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------------------

const tuningLine = (line: number, step: string, octave: number) => `<staff-tuning line="${line}"><tuning-step>${step}</tuning-step><tuning-octave>${octave}</tuning-octave></staff-tuning>`;
const tabNote = (step: string, octave: number, dur: number, string: number, fret: number, extra = '', technical = '', notations = '', alter = 0) =>
  `<note>${extra}<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch><duration>${dur}</duration><voice>1</voice>` +
  `<notations>${notations}<technical>${technical}<string>${string}</string><fret>${fret}</fret></technical></notations></note>`;

const MUSICXML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test &amp; Tune</work-title></work>
  <identification><creator type="composer">A. Writer</creator></identification>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
    <score-part id="P2"><part-name>Guitar</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1"><attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice></note></measure>
    <measure number="2"><note><pitch><step>D</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice></note></measure>
    <measure number="3"><note><pitch><step>E</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice></note></measure>
    <measure number="4"><note><rest/><duration>6</duration><voice>1</voice></note></measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time>
        <staff-details><staff-lines>6</staff-lines>
          ${tuningLine(1, 'D', 2)}${tuningLine(2, 'A', 2)}${tuningLine(3, 'D', 3)}${tuningLine(4, 'G', 3)}${tuningLine(5, 'B', 3)}${tuningLine(6, 'E', 4)}
        </staff-details>
      </attributes>
      <direction><direction-type><rehearsal>Intro</rehearsal></direction-type><sound tempo="96"/></direction>
      <harmony><root><root-step>D</root-step></root><kind>suspended-fourth</kind>
        <frame><frame-strings>6</frame-strings><frame-frets>4</frame-frets>
          <frame-note><string>1</string><fret>3</fret></frame-note><frame-note><string>2</string><fret>3</fret></frame-note>
          <frame-note><string>3</string><fret>2</fret></frame-note><frame-note><string>4</string><fret>0</fret></frame-note>
        </frame></harmony>
      <!-- a drop-D power chord, then a hammer-on -->
      ${tabNote('D', 2, 2, 6, 0)}
      ${tabNote('A', 2, 2, 5, 0, '<chord/>')}
      ${tabNote('D', 3, 1, 4, 0, '', '<hammer-on type="start">H</hammer-on>')}
      ${tabNote('E', 3, 1, 4, 2, '', '<hammer-on type="stop"/>')}
      <note><rest/><duration>2</duration><voice>1</voice></note>
    </measure>
    <measure number="2">
      <barline location="left"><repeat direction="forward"/></barline>
      ${tabNote('G', 3, 2, 3, 0, '<tie type="start"/>', '', '<tied type="start"/>')}
      ${tabNote('G', 3, 2, 3, 0, '<tie type="stop"/>', '', '<tied type="stop"/>')}
      ${tabNote('B', 3, 2, 2, 0, '', '<bend><bend-alter>1</bend-alter></bend>')}
      <barline location="right"><repeat direction="backward" times="2"/></barline>
    </measure>
    <measure number="3">
      ${tabNote('F', 4, 3, 1, 2, '', '', '<slide type="start"/>', 1)}
      ${tabNote('G', 4, 3, 1, 4, '', '', '<slide type="stop"/>', 1)}
    </measure>
    <measure number="4">
      <note><grace/><pitch><step>A</step><octave>3</octave></pitch><voice>1</voice></note>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>6</duration><notehead>x</notehead><voice>1</voice><notations><technical><string>3</string><fret>2</fret></technical></notations></note>
    </measure>
  </part>
</score-partwise>`;

describe('MusicXML importer', () => {
  it('lists parts and picks the one with tab', () => {
    const r = inspectMusicXml(MUSICXML);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.inspection.title).toBe('Test & Tune');
    expect(r.inspection.parts.map((p) => [p.name, p.hasTab])).toEqual([['Piano', false], ['Guitar', true]]);
    expect(r.inspection.defaultSelection).toEqual([1]);
  });

  it('converts pitches, durations, chords, ties, techniques, tuning, repeats and harmony', () => {
    const song = ok(musicXmlToSong(MUSICXML));
    expect(song.source).toBe('musicxml');
    expect([song.title, song.artist, song.bpm, song.beatsPerBar, song.beatUnit]).toEqual(['Test & Tune', 'A. Writer', 96, 3, 4]);
    expect(song.tuning).toMatchObject({ name: 'Drop D', standard: false });
    const bar = 2880;
    expect(song.notes.map((n) => [n.startTick, n.durationTicks, n.midi, n.string, n.fret, kinds(n).join()])).toEqual([
      [0, 960, 38, 6, 0, ''],
      [0, 960, 45, 5, 0, ''],
      [960, 480, 50, 4, 0, ''],
      [1440, 480, 52, 4, 2, 'hammer_on'],
      [bar, 1920, 55, 3, 0, ''],
      [bar + 1920, 960, 59, 2, 0, 'bend'],
      [2 * bar, 1920, 55, 3, 0, ''],
      [2 * bar + 1920, 960, 59, 2, 0, 'bend'],
      [3 * bar, 1440, 66, 1, 2, ''],
      [3 * bar + 1440, 1440, 68, 1, 4, 'slide_up'],
      [4 * bar, 2880, 57, 3, 2, 'dead_note'],
    ]);
    expect(song.notes.find((n) => kinds(n).includes('bend'))!.techniques![0]).toEqual({ kind: 'bend', semitones: 1 });
    expect(song.chords).toEqual([{ startTick: 0, durationTicks: 5 * bar, name: 'Dsus4', fretsByString: [3, 3, 2, 0, null, null] }]);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Intro' }]);
    expect(song.durationTicks).toBe(5 * bar);
    expect(song.warnings.join(' ')).toMatch(/grace note/);
    expectConsistentFrets(song);
  });

  it('expands first and second endings', () => {
    const m = (n: number, inner: string) => `<measure number="${n}">${inner}<note><pitch><step>C</step><octave>${3 + n}</octave></pitch><duration>4</duration></note></measure>`;
    const xml = `<score-partwise><part-list><score-part id="P1"><part-name>Gtr</part-name></score-part></part-list><part id="P1">
      ${m(1, '<attributes><divisions>1</divisions></attributes>')}
      ${m(2, '<barline location="left"><repeat direction="forward"/></barline>')}
      ${m(3, '<barline location="left"><ending number="1" type="start"/></barline><barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>')}
      ${m(4, '<barline location="left"><ending number="2" type="start"/></barline><barline location="right"><ending number="2" type="discontinue"/></barline>')}
      </part></score-partwise>`;
    const song = ok(musicXmlToSong(xml));
    // Measures 1, 2, 3 (first ending), 2 again, 4 (second ending): C4, C5, C6, C5, C7.
    expect(song.notes.map((n) => n.midi)).toEqual([60, 72, 84, 72, 96]);
    expect(song.warnings.join(' ')).toMatch(/No tempo/);
  });

  it('rejects compressed, timewise and non-MusicXML input cleanly', () => {
    expect(errCode(musicXmlToSong(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0])))).toBe('compressed_musicxml');
    expect(errCode(musicXmlToSong('<score-timewise><measure/></score-timewise>'))).toBe('unsupported_format');
    expect(errCode(musicXmlToSong('<html><body>hi</body></html>'))).toBe('not_musicxml');
    expect(errCode(musicXmlToSong('not xml at all'))).toBe('not_musicxml');
    expect(errCode(musicXmlToSong(''))).toBe('empty');
    for (let cut = 0; cut < MUSICXML.length; cut += 97) expect(typeof musicXmlToSong(MUSICXML.slice(0, cut)).ok).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------------------

/** Build a real .gp file (GP7 format) from original alphaTex content with alphaTab itself. */
async function gp7(tex: string): Promise<Uint8Array> {
  const alphaTab = await import('@coderline/alphatab');
  const settings = new alphaTab.Settings();
  settings.core.logLevel = alphaTab.LogLevel.None;
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(tex, settings);
  return new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), settings);
}

const GP_TEX = `\\title "Pocket Riff" \\artist "Test Writer" \\tempo 110
\\track "Lead" \\instrument 27 \\tuning (E4 B3 G3 D3 A2 D2) \\capo 1 \\chord ("Dsus4" 3 3 2 0 x x)
\\section "Intro" :4 0.6 3.6{h} 5.6 5.5{b (0 4)} |
\\ro 7.4{sl} 9.4 (0.1 1.2 0.3).4{ch "Dsus4"} x.4 |
\\ae (1) \\rc 2 12.1{nh} 3.3{pm} 5.4{v} 5.4 |
\\ae (2) \\tempo 130 :2 3.5{lr} 3.5{t} |
:1 0.6
\\track "Drums" \\instrument percussion \\articulation defaults
:4 42 42 38 42 | 42 42 38 42 | 42 42 38 42 | 42 42 38 42 | :1 36`;

describe('Guitar Pro importer (alphaTab)', () => {
  it('detects formats by their header', async () => {
    const bytes = await gp7(GP_TEX);
    expect(detectGuitarPro(bytes)).toBe('gp7');
    const gp5 = new Uint8Array([24, ...ascii('FICHIER GUITAR PRO v5.00'), 0, 0, 0, 0]);
    expect(detectGuitarPro(gp5)).toBe('gp3-5');
    expect(detectGuitarPro(new Uint8Array([...ascii('BCFZ'), 0, 0, 0, 0]))).toBe('gpx');
    expect(detectGuitarPro(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it('lists tracks and leaves drums out', async () => {
    const r = await inspectGuitarPro(await gp7(GP_TEX));
    if (!r.ok) throw new Error(r.error.message);
    expect(r.inspection.title).toBe('Pocket Riff');
    expect(r.inspection.tracks.map((t) => [t.name, t.isPercussion, t.stringCount])).toEqual([['Lead', false, 6], ['Drums', true, 0]]);
    expect(r.inspection.tracks[0]).toMatchObject({ tuningName: 'Drop D', capo: 1, program: 27, guitarLikely: true });
    expect(r.inspection.defaultSelection).toEqual([0]);
    expect(errCode(await guitarProToSong(await gp7(GP_TEX), [1]))).toBe('no_notes');
  });

  it('converts notes with strings (1 = high E), frets from the capo, techniques, ties, repeats and chords', async () => {
    const song = ok(await guitarProToSong(await gp7(GP_TEX)));
    expect(song.source).toBe('guitar_pro');
    expect([song.title, song.artist, song.bpm]).toEqual(['Pocket Riff', 'Test Writer', 110]);
    expect(song.tuning).toMatchObject({ name: 'Drop D', standard: false, openMidiByString: [64, 59, 55, 50, 45, 38] });
    expect(song.capo).toBe(1);
    expectConsistentFrets(song);
    const bar = 3840;
    const row = (n: ImportedNote) => [n.startTick, n.string, n.fret, n.midi, kinds(n).join()];
    // Bar 1
    expect(song.notes.filter((n) => n.startTick < bar).map(row)).toEqual([
      [0, 6, 0, 39, ''], [960, 6, 3, 42, ''], [1920, 6, 5, 44, 'hammer_on'], [2880, 5, 5, 51, 'bend'],
    ]);
    expect(song.notes.find((n) => kinds(n).includes('bend'))!.techniques).toEqual([{ kind: 'bend', semitones: 2 }]);
    // Bar 2 (repeat start) is played twice, with the first ending in between.
    const bar2 = (start: number) => song.notes.filter((n) => n.startTick >= start && n.startTick < start + bar).map((n) => [n.startTick - start, n.string, n.fret, kinds(n).join()]);
    const expected2 = [[0, 4, 7, ''], [960, 4, 9, 'slide_up'], [1920, 3, 0, ''], [1920, 2, 1, ''], [1920, 1, 0, ''], [2880, 4, 0, 'dead_note']];
    const sortRows = (rows: (string | number | undefined)[][]) => [...rows].sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]));
    expect(sortRows(bar2(bar))).toEqual(sortRows(expected2));
    expect(sortRows(bar2(3 * bar))).toEqual(sortRows(expected2));
    // First ending (once), then second ending, then the last bar.
    expect(song.notes.filter((n) => n.startTick >= 2 * bar && n.startTick < 3 * bar).map(row)).toEqual([
      [2 * bar, 1, 12, 77, 'harmonic'], [2 * bar + 960, 3, 3, 59, 'palm_mute'], [2 * bar + 1920, 4, 5, 56, 'vibrato'], [2 * bar + 2880, 4, 5, 56, ''],
    ]);
    const tied = song.notes.filter((n) => n.startTick >= 4 * bar && n.startTick < 5 * bar);
    expect(tied.map((n) => [n.startTick, n.durationTicks, n.string, n.fret, kinds(n).join()])).toEqual([[4 * bar, 3840, 5, 3, 'let_ring']]);
    expect(song.notes[song.notes.length - 1]).toMatchObject({ startTick: 5 * bar, durationTicks: 3840, string: 6, fret: 0 });
    expect(song.durationTicks).toBe(6 * bar);
    expect(song.sections).toEqual([{ startTick: 0, name: 'Intro' }]);
    expect(song.chords.map((c) => [c.startTick, c.name, c.fretsByString])).toEqual([
      [bar + 1920, 'Dsus4', [3, 3, 2, 0, null, null]], [3 * bar + 1920, 'Dsus4', [3, 3, 2, 0, null, null]],
    ]);
    expect(song.warnings.join(' ')).toMatch(/130 BPM/);
    expect(song.warnings.join(' ')).toMatch(/Drop D/);
  });

  it('rejects non-Guitar-Pro and damaged files cleanly', async () => {
    expect(errCode(await guitarProToSong(new Uint8Array()))).toBe('empty');
    expect(errCode(await guitarProToSong(new TextEncoder().encode('just some text, not a tab file')))).toBe('not_guitar_pro');
    expect(errCode(await guitarProToSong(new Uint8Array([24, ...ascii('FICHIER GUITAR PRO v5.00'), 1, 2, 3])))).toBe('malformed');
    const good = await gp7(GP_TEX);
    for (const cut of [10, 100, 500, Math.floor(good.length / 2), good.length - 20]) {
      const r = await guitarProToSong(good.slice(0, cut));
      expect(typeof r.ok).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------------------

describe('format detection and importSong', () => {
  it('detects each format from content', async () => {
    expect(detectImportFormat(format0File())).toBe('midi');
    expect(detectImportFormat(await gp7(GP_TEX))).toBe('guitar_pro');
    expect(detectImportFormat(MUSICXML)).toBe('musicxml');
    expect(detectImportFormat(new TextEncoder().encode(MUSICXML))).toBe('musicxml');
    expect(detectImportFormat(BASIC_TAB)).toBe('tab');
    expect(detectImportFormat(LYRIC_SHEET)).toBe('chord_sheet');
    expect(detectImportFormat('{title: X}\n[G]la la')).toBe('chord_sheet');
    expect(detectImportFormat(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]), 'song.mxl')).toBe('mxl');
    expect(detectImportFormat('hello world')).toBe('unknown');
    expect(detectImportFormat(new Uint8Array([0, 1, 2, 0, 0, 3, 0, 255]))).toBe('unknown');
  });

  it('routes to the right importer and reports unsupported input', async () => {
    expect(ok(await importSong(format1File(), { fileName: 'a.mid' })).source).toBe('midi');
    expect(ok(await importSong(await gp7(GP_TEX))).source).toBe('guitar_pro');
    expect(ok(await importSong(MUSICXML)).source).toBe('musicxml');
    expect(ok(await importSong(new TextEncoder().encode(BASIC_TAB), { fileName: 'riff.txt' })).source).toBe('tab');
    expect(ok(await importSong(LYRIC_SHEET, { bpm: 72 })).bpm).toBe(72);
    expect(ok(await importSong(format1File(), { trackIndexes: [0] })).notes).toHaveLength(20);
    expect(errCode(await importSong(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0])))).toBe('compressed_musicxml');
    expect(errCode(await importSong('nothing to see here'))).toBe('unsupported_format');
    expect(errCode(await importSong(BASIC_TAB, { format: 'midi' }))).toBe('not_midi');
  });

  it('never rejects on random bytes', async () => {
    const rand = rng(2024);
    for (let k = 0; k < 200; k++) {
      const len = Math.floor(rand() * 300);
      const b = new Uint8Array(len);
      for (let i = 0; i < len; i++) b[i] = Math.floor(rand() * 256);
      if (k % 4 === 0 && len > 4) b.set(ascii('MThd'));
      if (k % 4 === 1 && len > 4) b.set([0x50, 0x4b, 3, 4]);
      const r = await importSong(b);
      expect(typeof r.ok).toBe('boolean');
      expect(typeof musicXmlToSong(b).ok).toBe('boolean');
    }
  });
});

describe('hostile input', () => {
  it('finishes quickly on pathological text (no regex backtracking blow-ups)', async () => {
    const big = (n: number, s: string) => s.repeat(n);
    const inputs = [
      `${big(200_000, ' ')}z`,
      `tempo${big(100_000, ' ')}x`,
      `Chorus${big(50_000, ' ')}(x`,
      `{${big(100_000, ' ')}`,
      big(200_000, '\n'),
      `[${big(50_000, ' ')}]`,
      `e${big(100_000, ' ')}z\n`.repeat(3),
      `E|${big(100_000, '-')}|  x`,
      `drop d ${big(50_000, ' ')} tuning ${big(50_000, ' ')}`,
      `${big(2_000, 'e|----|\n')}`,
      `${big(20_000, 'Em G ')}`,
      `|${big(30_000, ' ')}:`,
    ];
    for (const text of inputs) {
      const started = Date.now();
      expect(typeof asciiTabToSong(text).ok).toBe('boolean');
      expect(typeof chordSheetToSong(text).ok).toBe('boolean');
      expect(typeof (await importSong(text)).ok).toBe('boolean');
      expect(typeof musicXmlToSong(`<score-partwise>${text}</score-partwise>`).ok).toBe('boolean');
      expect(Date.now() - started, JSON.stringify(text.slice(0, 20))).toBeLessThan(5000);
    }
    expect(errCode(asciiTabToSong('x'.repeat(1_000_001)))).toBe('too_large');
  });
});

describe('expandRepeats', () => {
  it('plays repeat sections and alternate endings in order', () => {
    expect(expandRepeats([{}, { repeatStart: true }, { repeatEndTimes: 3 }, {}]).order).toEqual([0, 1, 2, 1, 2, 1, 2, 3]);
    expect(expandRepeats([{}, { repeatEndTimes: 2 }]).order).toEqual([0, 1, 0, 1]);
    expect(expandRepeats([{ repeatStart: true }, { endings: [1], repeatEndTimes: 2 }, { endings: [2] }, {}]).order).toEqual([0, 1, 0, 2, 3]);
    const long = expandRepeats(Array.from({ length: 3000 }, (_, i) => (i === 2999 ? { repeatEndTimes: 16 } : {})), 5000);
    expect(long.truncated).toBe(true);
    expect(long.order).toHaveLength(5000);
  });

  it('keeps openMidi in sync with the importers', () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => openMidi(s as StringNumber))).toEqual([64, 59, 55, 50, 45, 40]);
  });
});
