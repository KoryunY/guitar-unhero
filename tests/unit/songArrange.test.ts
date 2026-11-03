import { describe, expect, it } from 'vitest';
import { buildLevels, partView, skyline, tidyChords, type SongSource } from '../../src/domain/songArrange';
import { analysisToSource, beatGrid, chordName, usesFlats } from '../../src/domain/fromAnalysis';
import { validateScore } from '../../src/domain/validate';
import { isUnreviewedCandidate, PPQ } from '../../src/domain/score';
import { chordMidis } from '../../src/domain/tuning';
import { parseChordName, chordTones } from '../../src/domain/chords';
import type { SongAnalysis } from '../../src/audio/song';

const rights = { status: 'user_declared' as const, author: 'test', license: null, allowedUses: ['local_practice' as const, 'modify' as const], sourceUri: null, evidence: 'test' };
const BAR = 4 * PPQ;

function source(over: Partial<SongSource> = {}): SongSource {
  // An original 8-bar progression in B♭ (a hard key for open shapes) with a simple tune.
  const prog = ['Bb', 'Gm', 'Eb', 'F', 'Bb', 'Gm', 'Cm7', 'F7'];
  const tune = [70, 72, 74, 75, 74, 72, 70, 69, 67, 70, 72, 74, 75, 77, 74, 70];
  return {
    arrangementId: 'song.test',
    title: 'Test tune',
    bpm: 96,
    durationTicks: prog.length * BAR,
    chords: prog.map((name, i) => ({ startTick: i * BAR, durationTicks: BAR, name })),
    notes: tune.map((midi, i) => ({ startTick: i * (BAR / 2) + (i % 3 === 2 ? PPQ / 2 : 0), durationTicks: i % 3 === 2 ? PPQ / 2 : PPQ, midi })),
    sections: [{ startTick: 0, name: 'Verse' }, { startTick: 4 * BAR, name: 'Chorus' }],
    rights,
    method: 'imported',
    createdBy: 'test',
    ...over,
  };
}

describe('any song → easy / medium / full', () => {
  const levels = buildLevels(source());

  it('builds three valid gu-score/2 arrangements', () => {
    expect(levels.map((l) => l.level)).toEqual(['easy', 'medium', 'full']);
    for (const l of levels) {
      const r = validateScore(JSON.parse(JSON.stringify(l.score)));
      expect(r.issues, l.level).toEqual([]);
      expect(l.score.arrangementLevel).toBe(l.level);
      expect(l.score.sections?.map((s) => s.name)).toEqual(['Verse', 'Chorus']);
    }
  });

  it('never changes the key: every level sounds the same chords (capo or not)', () => {
    const easy = levels[0]!;
    for (const l of levels) {
      l.score.chords!.forEach((c, i) => {
        const wanted = parseChordName(source().chords[i]!.name!)!;
        const tones = new Set(chordTones(wanted));
        const sounding = chordMidis(c.frets, l.score.instrument.capo).map((m) => m % 12);
        for (const pc of sounding) expect(tones.has(pc), `${l.level} ${c.name} vs ${wanted.display}`).toBe(true);
        expect(sounding).toContain(wanted.root);
      });
    }
    // B♭ is awkward in open position: easy should reach for a capo with simpler shapes.
    expect(easy.capo).toBeGreaterThan(0);
  });

  it('easy keeps fewer melody notes, all in low frets; full keeps the whole line', () => {
    const [easy, medium, full] = levels;
    expect(full!.score.events.length).toBe(16);
    expect(easy!.score.events.length).toBeLessThan(medium!.score.events.length);
    expect(medium!.score.events.length).toBeLessThanOrEqual(full!.score.events.length);
    for (const e of easy!.score.events) expect(e.fret).toBeLessThanOrEqual(3);
    for (const e of medium!.score.events) expect(e.fret).toBeLessThanOrEqual(5);
    // Melody pitch classes never change (octave shifts only).
    const pcs = new Set(source().notes.map((n) => n.midi % 12));
    for (const e of easy!.score.events) expect(pcs.has(e.pitchMidi % 12)).toBe(true);
  });

  it('strumming gets busier with the level', () => {
    const [easy, medium, full] = levels;
    expect(easy!.score.chords![0]!.pattern).toBeNull();
    expect(medium!.score.chords![0]!.pattern).toBe('D-D-D-D-');
    expect(full!.score.chords![0]!.pattern).toBe('D-DU-UDU');
  });

  it('the chords part has no assessable notes', () => {
    const v = partView(levels[1]!.score, 'chords');
    expect(v.events).toHaveLength(0);
    expect(validateScore(JSON.parse(JSON.stringify(v))).issues).toEqual([]);
  });

  it('a chord sheet without a tune still gives three playable chord levels', () => {
    const ls = buildLevels(source({ notes: [] }));
    for (const l of ls) {
      expect(l.score.events).toHaveLength(0);
      expect(l.score.chords!.length).toBeGreaterThan(0);
      expect(validateScore(JSON.parse(JSON.stringify(l.score))).issues).toEqual([]);
    }
  });

  it('candidates from audio stay candidates at every level until reviewed', () => {
    for (const l of buildLevels(source({ method: 'model_candidate' }))) expect(isUnreviewedCandidate(l.score)).toBe(true);
    for (const l of levels) expect(isUnreviewedCandidate(l.score)).toBe(false);
  });

  it('skyline keeps the top note of each onset and removes overlaps', () => {
    const s = skyline([
      { startTick: 0, durationTicks: 960, midi: 60 },
      { startTick: 0, durationTicks: 960, midi: 64 },
      { startTick: 480, durationTicks: 960, midi: 62 },
    ]);
    expect(s.map((n) => [n.startTick, n.midi, n.durationTicks])).toEqual([[0, 64, 480], [480, 62, 960]]);
  });

  it('tidyChords merges repeats and clips overlaps', () => {
    const t = tidyChords([
      { startTick: 0, durationTicks: 1920, name: 'C' },
      { startTick: 1920, durationTicks: 1920, name: 'C' },
      { startTick: 3000, durationTicks: 1920, name: 'G' },
    ], 8 * PPQ);
    expect(t.map((c) => [c.name, c.startTick, c.durationTicks])).toEqual([['C', 0, 3000], ['G', 3000, 1920]]);
  });
});

describe('audio analysis → song source', () => {
  const beats = Array.from({ length: 40 }, (_, i) => 0.5 + i * 0.5 + (i > 20 ? (i - 20) * 0.01 : 0));
  const analysis: SongAnalysis = {
    durationSec: 22,
    sampleRate: 22050,
    tuningCents: 0,
    bpm: 120,
    bpmAlternatives: [60, 240],
    beats,
    downbeatIndex: 1,
    beatConfidence: 0.8,
    key: { tonic: 5, mode: 'major' },
    chords: [
      { startSec: beats[1]!, endSec: beats[5]!, root: 5, quality: 'maj', confidence: 0.8 },
      { startSec: beats[5]!, endSec: beats[9]!, root: 10, quality: 'maj', confidence: 0.8 },
      { startSec: beats[9]!, endSec: beats[13]!, root: null, quality: 'N', confidence: 0.2 },
      { startSec: beats[13]!, endSec: beats[17]!, root: 2, quality: 'min', confidence: 0.7 },
    ],
    melody: [
      { startSec: beats[1]!, endSec: beats[2]!, midi: 69, confidence: 0.8 },
      { startSec: beats[2]! + 0.01, endSec: beats[3]!, midi: 70, confidence: 0.8 },
      { startSec: 0.1, endSec: 0.3, midi: 65, confidence: 0.5 },
    ],
    bass: [],
    sections: [{ startSec: beats[1]!, label: 'A' }, { startSec: beats[17]!, label: 'B' }],
    warnings: ['Tempo drifts a little; the beat follows it.'],
  } as unknown as SongAnalysis;

  it('spells chords for the key and maps beats to ticks with anchors', () => {
    expect(usesFlats({ tonic: 5, mode: 'major' })).toBe(true);
    expect(chordName(10, 'maj', true)).toBe('Bb');
    expect(chordName(1, 'min7', false)).toBe('C#m7');
    const grid = beatGrid(analysis);
    expect(grid.tickOf(beats[1]!)).toBe(0); // first downbeat = tick 0
    expect(grid.tickOf(beats[3]!)).toBeCloseTo(2 * PPQ, 6);
    expect(grid.anchors[0]).toEqual({ tick: 0, sourceSec: beats[1] });
    for (let i = 1; i < grid.anchors.length; i++) expect(grid.anchors[i]!.sourceSec).toBeGreaterThan(grid.anchors[i - 1]!.sourceSec);
  });

  it('builds a candidate source; no-chord spans and pickup notes are dropped', () => {
    const { source: src, anchors } = analysisToSource(analysis, {
      arrangementId: 'song.a', title: 'A', rights, createdBy: 'test',
      sourceAudio: { assetId: 'asset1', sha256: 'a'.repeat(64), durationSec: 22, rights }, providerId: 'p', providerVersion: '1',
    });
    expect(src.method).toBe('model_candidate');
    expect(src.chords.map((c) => c.name)).toEqual(['F', 'Bb', 'Dm']);
    expect(src.chords[0]!.startTick).toBe(0);
    expect(src.notes.map((n) => n.midi)).toEqual([69, 70]);
    expect(anchors.length).toBeGreaterThan(10);
    const levels = buildLevels(src);
    for (const l of levels) {
      expect(validateScore(JSON.parse(JSON.stringify(l.score))).issues).toEqual([]);
      expect(isUnreviewedCandidate(l.score)).toBe(true);
    }
  });
});

import { derive } from '../../src/domain/arrange';
import { importedToSource } from '../../src/domain/fromImport';
import { voiceProgression } from '../../src/domain/voicing';
import { isChordLine } from '../../src/domain/importers/chordSheet';
import { blankScore } from '../../src/domain/edit';
import type { ImportedSong } from '../../src/domain/importers/types';

describe('review fixes (any-song integration)', () => {
  it('an easy version derived from an unreviewed transcription is still never assessed', () => {
    const base = blankScore({ arrangementId: 'cand', title: 'c', bpm: 80, bars: 1, rights });
    const cand = { ...base, role: 'transcription_candidate' as const, provenance: { ...base.provenance, method: 'model_candidate' as const },
      events: [{ id: 'n1', kind: 'note' as const, startTick: 0, durationTicks: 960, pitchMidi: 64, string: 1 as const, fret: 0, finger: null, sourceEventIds: [], assessment: { pitch: true, attack: true, sustain: false as const } }] };
    const d = derive(cand, 'easy-melody');
    expect(d.ok).toBe(true);
    expect(isUnreviewedCandidate(d.score!)).toBe(true);
  });

  const tabSong = (standard: boolean): ImportedSong => ({
    source: 'tab', title: null, artist: null, ppq: 960, bpm: 90, beatsPerBar: 4, beatUnit: 4, durationTicks: 3840,
    notes: [0, 1, 2, 3, 4, 5].map((i) => ({ startTick: 0, durationTicks: 1920, midi: [63, 58, 54, 51, 46, 39][i]!, string: (i + 1) as 1, fret: [0, 0, 1, 2, 2, 0][i]! })),
    chords: [{ startTick: 1920, durationTicks: 1920, name: 'Eb', fretsByString: [0, 0, 0, 2, 2, 0] }],
    sections: [], tuning: { name: standard ? 'standard' : 'half-step down', openMidiByString: [63, 58, 54, 49, 44, 39], standard }, capo: 0, warnings: [],
  });

  it('shapes from a tab in another tuning are not replayed in standard tuning', () => {
    const { source } = importedToSource(tabSong(false), { arrangementId: 'x', title: 'x', rights, createdBy: 't' });
    expect(source.chords.every((c) => !c.fretsByString)).toBe(true);
    expect(source.chords.map((c) => c.name)).toEqual(['Eb']);
    // The simultaneous notes keep their sounding pitches (no standard-tuning shape).
    expect(source.notes.length).toBeGreaterThan(0);
  });

  it('A# and Bb are the same chord when choosing easy shapes', () => {
    const v = voiceProgression(['A#', 'F', 'Bb', 'F'].map((name, i) => ({ startTick: i * 3840, durationTicks: 3840, name })), 'easy');
    expect(v.voiced.every(Boolean)).toBe(true);
    expect(v.voiced[0]!.frets).toEqual(v.voiced[2]!.frets);
  });

  it('a harmonic written at fret 7 is not given the fretted pitch as its target', () => {
    const ls = buildLevels(source({ chords: [], notes: [{ startTick: 0, durationTicks: 960, midi: 74, string: 3, fret: 7, techniques: [{ kind: 'harmonic' }] }] }));
    const full = ls.find((l) => l.level === 'full')!;
    expect(full.score.events[0]!.pitchMidi).toBe(74);
  });

  it('merged chords never run past the end of the song', () => {
    const t = tidyChords([{ startTick: 0, durationTicks: 3840, name: 'C' }, { startTick: 3840, durationTicks: 9000, name: 'C' }], 7680);
    expect(t).toEqual([{ startTick: 0, durationTicks: 7680, name: 'C' }]);
  });

  it('a "Tuning:" line in a tab is not read as chords', () => {
    expect(isChordLine('Tuning: Eb Ab Db Gb Bb Eb')).toBe(false);
    expect(isChordLine('Eb   Ab   Db')).toBe(true);
  });

  it('fret range is checked above the capo', () => {
    const l = buildLevels(source())[0]!;
    const s = JSON.parse(JSON.stringify(l.score));
    s.instrument.maxFret = 4;
    s.instrument.capo = 3;
    s.events = [];
    s.chords = [{ id: 'c1', startTick: 0, durationTicks: 960, name: 'X', frets: [3, null, null, null, null, null], pattern: null }];
    expect(validateScore(s).issues.map((i) => i.code)).toContain('semantic.fret_range');
  });
});
