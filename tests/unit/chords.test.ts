import { describe, expect, it } from 'vitest';
import {
  chordTones, easiestVoicing, parseChordName, QUALITIES, rankCapoOptions, suggestCapo, thirdInterval, transposeChord, voicingsFor, VOICINGS,
  type ChordQuality, type ParsedChord, type Voicing,
} from '../../src/domain/chords';
import { fretToMidi } from '../../src/domain/tuning';
import type { StringNumber } from '../../src/domain/score';

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Sounding MIDI per string, computed independently from tuning.ts (index 0 = string 1). */
function sounding(v: Voicing, capo = 0): number[] {
  const out: number[] = [];
  v.fretsByString.forEach((f, i) => {
    if (f !== null) out.push(fretToMidi((i + 1) as StringNumber, f + capo));
  });
  return out;
}

function parse(name: string): ParsedChord {
  const c = parseChordName(name);
  if (!c) throw new Error(`could not parse ${name}`);
  return c;
}

/** The checks every voicing must pass, against the chord it claims to be. */
function checkVoicing(v: Voicing, chord: Pick<ParsedChord, 'root' | 'quality' | 'bass'>, capo = 0): void {
  const label = `${v.id} for ${chord.root}/${chord.quality}/${chord.bass}`;
  expect(v.fretsByString, label).toHaveLength(6);
  expect(v.fingers, label).toHaveLength(6);
  const midi = sounding(v, capo);
  expect(midi.length, label).toBeGreaterThanOrEqual(3);
  const pcs = new Set(midi.map(mod12));
  const tones = chordTones(chord);
  for (const pc of pcs) expect(tones, `${label}: pitch class ${pc} is not a chord tone`).toContain(pc);
  expect(pcs.has(mod12(chord.root)), `${label}: root missing`).toBe(true);
  const third = thirdInterval(chord.quality);
  if (third !== null) expect(pcs.has(mod12(chord.root + third)), `${label}: third missing`).toBe(true);
  const lowest = Math.min(...midi);
  if (chord.bass !== null) expect(mod12(lowest), `${label}: bass is not the lowest note`).toBe(mod12(chord.bass));
  else expect(mod12(lowest), `${label}: not in root position`).toBe(mod12(chord.root));
  for (const f of v.fretsByString) if (f !== null) expect(f + capo, label).toBeLessThanOrEqual(15);
  for (const f of v.fretsByString) if (f !== null) expect(f, label).toBeGreaterThanOrEqual(0);
  expect(v.difficulty, label).toBeGreaterThanOrEqual(1);
  expect(v.difficulty, label).toBeLessThanOrEqual(5);
  // Fingers agree with frets: muted ↔ null, open ↔ 0, fretted ↔ a finger; one finger never holds two different frets.
  const fretOfFinger = new Map<unknown, number>();
  v.fretsByString.forEach((f, i) => {
    const finger = v.fingers[i];
    if (f === null) expect(finger, label).toBeNull();
    else if (f === 0) expect(finger, label).toBe(0);
    else {
      expect([1, 2, 3, 4, 'T'], label).toContain(finger);
      const prev = fretOfFinger.get(finger);
      if (prev !== undefined) expect(prev, `${label}: finger ${String(finger)} on two frets`).toBe(f);
      fretOfFinger.set(finger, f);
    }
  });
}

describe('parseChordName', () => {
  const cases: [string, number, ChordQuality, number | null, string][] = [
    ['C', 0, 'maj', null, 'C'],
    ['Cmaj7', 0, 'maj7', null, 'Cmaj7'],
    ['CΔ7', 0, 'maj7', null, 'Cmaj7'],
    ['CM7', 0, 'maj7', null, 'Cmaj7'],
    ['Am7', 9, 'min7', null, 'Am7'],
    ['Amin7', 9, 'min7', null, 'Am7'],
    ['C/G', 0, 'maj', 7, 'C/G'],
    ['D/F#', 2, 'maj', 6, 'D/F#'],
    ['Bb', 10, 'maj', null, 'Bb'],
    ['B♭m', 10, 'min', null, 'Bbm'],
    ['A#m', 10, 'min', null, 'A#m'],
    ['Ebm', 3, 'min', null, 'Ebm'],
    ['F#m7b5', 6, 'm7b5', null, 'F#m7b5'],
    ['F#ø', 6, 'm7b5', null, 'F#m7b5'],
    ['E5', 4, '5', null, 'E5'],
    ['Asus4', 9, 'sus4', null, 'Asus4'],
    ['Asus', 9, 'sus4', null, 'Asus4'],
    ['Dsus2', 2, 'sus2', null, 'Dsus2'],
    ['Cadd9', 0, 'add9', null, 'Cadd9'],
    ['C(add9)', 0, 'add9', null, 'Cadd9'],
    ['Bdim', 11, 'dim', null, 'Bdim'],
    ['E°7', 4, 'dim7', null, 'Edim7'],
    ['Edim7', 4, 'dim7', null, 'Edim7'],
    ['Caug', 0, 'aug', null, 'Caug'],
    ['C+', 0, 'aug', null, 'Caug'],
    ['C6', 0, '6', null, 'C6'],
    ['Am6', 9, 'min6', null, 'Am6'],
    ['G9', 7, '9', null, 'G9'],
    ['E7sus4', 4, '7sus4', null, 'E7sus4'],
    ['G7', 7, '7', null, 'G7'],
    ['Em/D', 4, 'min', 2, 'Em/D'],
    ['(Em)', 4, 'min', null, 'Em'],
  ];
  it.each(cases)('%s', (text, root, quality, bass, display) => {
    const c = parseChordName(text);
    expect(c).not.toBeNull();
    expect(c!.root).toBe(root);
    expect(c!.quality).toBe(quality);
    expect(c!.bass).toBe(bass);
    expect(c!.display).toBe(display);
    expect(c!.note).toBeUndefined();
  });

  it('treats altered and extended chords as the nearest supported chord, with a note', () => {
    const c = parseChordName('D7#9')!;
    expect([c.root, c.quality, c.display]).toEqual([2, '7', 'D7']);
    expect(c.note).toBeTruthy();
    expect(parseChordName('Cmaj9')).toMatchObject({ quality: 'maj7', note: expect.any(String) });
    expect(parseChordName('Am9')).toMatchObject({ quality: 'min7', note: expect.any(String) });
    expect(parseChordName('G13')).toMatchObject({ quality: '7', note: expect.any(String) });
  });

  it('rejects words and malformed names', () => {
    for (const t of ['', ' ', 'H7', 'am', 'Add', 'Be', 'Cab', 'Dad', 'C/H', 'hello', 'Xm', '7', 'Cmajor7th', 'the', 'A day', 'C//G', 'Em/']) {
      expect(parseChordName(t), t).toBeNull();
    }
    expect(parseChordName(42 as unknown as string)).toBeNull();
  });

  it('drops a slash bass equal to the root', () => {
    expect(parseChordName('C/C')).toMatchObject({ bass: null, display: 'C' });
  });
});

describe('chordTones and transposeChord', () => {
  it('lists pitch classes root first, including a slash bass once', () => {
    expect(chordTones(parse('C'))).toEqual([0, 4, 7]);
    expect(chordTones(parse('Am7'))).toEqual([9, 0, 4, 7]);
    expect(chordTones(parse('C/G'))).toEqual([0, 4, 7]);
    expect(chordTones(parse('C/Bb'))).toEqual([0, 4, 7, 10]);
    expect(chordTones(parse('G9'))).toEqual([7, 11, 2, 5, 9]);
  });
  it('moves root and bass together', () => {
    expect(transposeChord(parse('C'), 2).display).toBe('D');
    expect(transposeChord(parse('Am7/G'), 3)).toMatchObject({ root: 0, quality: 'min7', bass: 10, display: 'Cm7/Bb' });
    expect(transposeChord(parse('A'), -2).display).toBe('G');
  });
});

describe('voicing library', () => {
  it('has the common open chords with standard shapes', () => {
    const shape = (name: string) => voicingsFor(parse(name)).map((v) => v.fretsByString.map((f) => (f === null ? 'x' : String(f))).reverse().join(''));
    expect(shape('C')).toContain('x32010');
    expect(shape('A')).toContain('x02220');
    expect(shape('G')).toContain('320003');
    expect(shape('E')).toContain('022100');
    expect(shape('D')).toContain('xx0232');
    expect(shape('Am')).toContain('x02210');
    expect(shape('Em')).toContain('022000');
    expect(shape('Dm')).toContain('xx0231');
    expect(shape('F')).toEqual(expect.arrayContaining(['xx3211', '133211']));
    for (const name of ['E7', 'A7', 'D7', 'G7', 'C7', 'B7', 'Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Amaj7', 'Dmaj7', 'Gmaj7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Cadd9', 'E5', 'A5', 'D5']) {
      const v = voicingsFor(parse(name));
      expect(v.length, name).toBeGreaterThan(0);
      expect(v.some((x) => x.shape === 'open' || x.shape === 'power'), name).toBe(true);
    }
  });

  it('stores string 1 (high E) at index 0', () => {
    const c = voicingsFor(parse('C')).find((v) => v.shape === 'open')!;
    expect(c.fretsByString).toEqual([0, 1, 0, 2, 3, null]);
    expect(sounding(c)).toEqual([64, 60, 55, 52, 48]);
  });

  it('every library voicing sounds only its chord tones, with root (and third), within fret 15', () => {
    expect(VOICINGS.length).toBeGreaterThan(200);
    for (const v of VOICINGS) checkVoicing(v, v);
  });

  it('ranks Em/E5 as easiest and the full F barre as hardest', () => {
    expect(voicingsFor(parse('Em'))[0]!.difficulty).toBe(1);
    expect(voicingsFor(parse('E5'))[0]!.difficulty).toBe(1);
    const f = voicingsFor(parse('F'));
    expect(f[0]!.fretsByString).toEqual([1, 1, 2, 3, null, null]);
    const full = f.find((v) => v.fretsByString.join() === [1, 1, 2, 3, 3, 1].join())!;
    expect(full.difficulty).toBe(5);
    expect(full.barre).toMatchObject({ fret: 1, fromString: 6, toString: 1 });
    expect(f.map((v) => v.difficulty).indexOf(5)).toBeGreaterThan(f.indexOf(f[0]!));
  });

  it('has movable E- and A-shape barre chords for maj/min/7/min7 on every root', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of ['maj', 'min', '7', 'min7'] as const) {
        const vs = voicingsFor({ root, quality: q, bass: null });
        expect(vs.some((v) => v.shape === 'e_shape'), `${root} ${q} E shape`).toBe(true);
        expect(vs.some((v) => v.shape === 'a_shape'), `${root} ${q} A shape`).toBe(true);
      }
      expect(voicingsFor({ root, quality: '5', bass: null }).filter((v) => v.shape === 'power').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns valid voicings for every root and quality, easiest first', () => {
    for (let root = 0; root < 12; root++) {
      for (const quality of QUALITIES) {
        const chord = { root, quality, bass: null };
        const vs = voicingsFor(chord);
        expect(vs.length, `${root} ${quality}`).toBeGreaterThan(0);
        for (let i = 1; i < vs.length; i++) expect(vs[i]!.difficulty).toBeGreaterThanOrEqual(vs[i - 1]!.difficulty);
        for (const v of vs) checkVoicing(v, chord);
      }
    }
  });

  it('slash chords put the requested bass lowest', () => {
    const names = ['C/G', 'C/E', 'C/B', 'D/F#', 'D/A', 'G/B', 'G/D', 'A/E', 'A/C#', 'Am/G', 'Am/C', 'Em/D', 'Em/G', 'F/C', 'F/A', 'E/G#', 'Dm/F', 'Dm/A', 'G7/B', 'Bm/A', 'Fmaj7/E'];
    for (const name of names) {
      const chord = parse(name);
      const vs = voicingsFor(chord);
      expect(vs.length, name).toBeGreaterThan(0);
      for (const v of vs) checkVoicing(v, chord);
    }
    // Every root/quality with the third or fifth in the bass: whatever comes back is valid.
    for (let root = 0; root < 12; root++) {
      for (const quality of QUALITIES) {
        for (const iv of [3, 4, 7]) {
          if (!chordTones({ root, quality, bass: null }).includes(mod12(root + iv))) continue;
          const chord = { root, quality, bass: mod12(root + iv) };
          for (const v of voicingsFor(chord)) checkVoicing(v, chord);
        }
      }
    }
    expect(voicingsFor(parse('C/G')).map((v) => v.fretsByString.join())).toContain([0, 1, 0, 2, 3, 3].join());
    expect(voicingsFor(parse('Bm/A')).map((v) => v.fretsByString.join())).toContain([2, 3, 4, 4, 0, null].join());
  });

  it('filters by difficulty and fret', () => {
    for (const v of voicingsFor(parse('Bm'), { maxDifficulty: 3 })) expect(v.difficulty).toBeLessThanOrEqual(3);
    expect(voicingsFor(parse('Bm'), { maxDifficulty: 3 })).toEqual([]);
    for (const v of voicingsFor(parse('G'), { maxFret: 5 })) for (const f of v.fretsByString) if (f !== null) expect(f).toBeLessThanOrEqual(5);
  });
});

describe('easiestVoicing', () => {
  it('uses the exact chord when it is playable', () => {
    const r = easiestVoicing(parse('Cmaj7'))!;
    expect(r.simplified).toBe(false);
    expect(r.simplifications).toEqual([]);
    expect(r.played.display).toBe('Cmaj7');
    expect(r.voicing.fretsByString).toEqual([0, 0, 0, 2, 3, null]);
  });

  it('simplifies the quality only by leaving notes out (9 → 7, add9 → maj, maj7 → maj)', () => {
    const g9 = easiestVoicing(parse('G9'), { maxDifficulty: 3 })!;
    expect(g9.simplified).toBe(true);
    expect(g9.played).toMatchObject({ root: 7, quality: '7' });
    expect(g9.simplifications[0]).toMatch(/G9 is played as G7/);
    expect(easiestVoicing(parse('Dadd9'), { maxDifficulty: 3 })!.played).toMatchObject({ root: 2, quality: 'maj' });
    expect(easiestVoicing(parse('Bmaj7'), { maxDifficulty: 2 })!.played).toMatchObject({ root: 11, quality: '5' });
    expect(easiestVoicing(parse('F#maj7'), { maxDifficulty: 4 })!.played.quality).toBe('maj7');
  });

  it('never changes the root, and simplified chords only drop notes', () => {
    for (let root = 0; root < 12; root++) {
      for (const quality of QUALITIES) {
        for (const maxDifficulty of [1, 2, 3, 4, 5]) {
          const chord: ParsedChord = { root, quality, bass: null, display: `${root}${quality}` };
          const r = easiestVoicing(chord, { maxDifficulty });
          if (maxDifficulty === 5) expect(r, `${root} ${quality}`).not.toBeNull();
          if (!r) continue;
          expect(r.played.root).toBe(root);
          expect(r.voicing.root).toBe(root);
          checkVoicing(r.voicing, r.played);
          const tones = chordTones(chord);
          for (const m of sounding(r.voicing)) expect(tones).toContain(mod12(m));
          expect(r.voicing.difficulty).toBeLessThanOrEqual(maxDifficulty);
        }
      }
    }
  });

  it('keeps a slash bass when possible and reports it when left out', () => {
    const r = easiestVoicing(parse('D/F#'))!;
    expect(r.played.bass).toBe(6);
    expect(mod12(Math.min(...sounding(r.voicing)))).toBe(6);
    const tight = easiestVoicing(parse('C#m/G#'), { maxDifficulty: 1 });
    if (tight) {
      expect(tight.played.root).toBe(1);
      if (tight.played.bass === null) expect(tight.simplifications.join(' ')).toMatch(/bass note/i);
    }
  });
});

describe('suggestCapo', () => {
  const chords = (names: string[]) => names.map(parse);

  it('keeps capo 0 for open-chord songs', () => {
    const s = suggestCapo(chords(['G', 'C', 'D', 'Em', 'G', 'C']));
    expect(s.capo).toBe(0);
    expect(s.shapes.map((x) => x.shapeName)).toEqual(['G', 'C', 'D', 'Em']);
    expect(s.totalDifficulty).toBe(2 + 2 + 2 + 1 + 2 + 2);
  });

  it('finds the capo that turns barre chords into open shapes without changing the key', () => {
    const song = chords(['Bb', 'Eb', 'F', 'Gm']);
    const s = suggestCapo(song);
    expect(s.capo).toBe(3);
    expect(s.shapes.map((x) => x.shapeName)).toEqual(['G', 'C', 'D', 'Em']);
    expect(s.totalDifficulty).toBeLessThan(rankCapoOptions(song).find((r) => r.capo === 0)!.totalDifficulty);
  });

  it('prefers capo 0 when totals tie', () => {
    const ranked = rankCapoOptions(chords(['A7']));
    const zero = ranked.find((r) => r.capo === 0)!;
    const five = ranked.find((r) => r.capo === 5)!;
    expect(five.totalDifficulty).toBe(zero.totalDifficulty);
    expect(suggestCapo(chords(['A7'])).capo).toBe(0);
  });

  it('every suggested shape sounds the original chord with the capo on', () => {
    const songs = [
      ['Bb', 'Eb', 'F', 'Gm'], ['F#m', 'D', 'A', 'E'], ['Ab', 'Db', 'Eb', 'Fm'], ['B', 'E', 'F#', 'G#m'],
      ['C#m', 'A', 'E', 'B'], ['Eb', 'Cm', 'Ab', 'Bb'], ['F', 'Bb', 'C', 'Dm7'], ['Bbmaj7', 'Cm7', 'F7'], ['E', 'B/D#', 'C#m', 'A'],
    ];
    for (const names of songs) {
      for (const s of rankCapoOptions(chords(names), { maxCapo: 7 })) {
        expect(s.capo).toBeGreaterThanOrEqual(0);
        expect(s.capo).toBeLessThanOrEqual(7);
        for (const shape of s.shapes) {
          expect(parseChordName(shape.shapeName)!.root).toBe(mod12(shape.original.root - s.capo));
          if (!shape.voicing) continue;
          const pcs = sounding(shape.voicing, s.capo).map(mod12);
          for (const pc of pcs) expect(chordTones(shape.original), `${names.join(' ')} capo ${s.capo} ${shape.shapeName}`).toContain(pc);
          expect(pcs).toContain(shape.original.root);
          for (const f of shape.voicing.fretsByString) if (f !== null) expect(f + s.capo).toBeLessThanOrEqual(15);
        }
      }
    }
  });
});
