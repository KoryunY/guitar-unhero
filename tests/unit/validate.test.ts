import { describe, expect, it } from 'vitest';
import fixture from '../../Documents/original-exercise.gu-score.json';
import { parseScoreJson, validateScore, practiceRightsIssue } from '../../src/domain/validate';
import { BUNDLED_SCORES } from '../../src/content/scores';

type AnyObj = Record<string, any>;
const clone = (): AnyObj => JSON.parse(JSON.stringify(fixture));

function expectRejected(mutate: (s: AnyObj) => void, code: string) {
  const s = clone();
  mutate(s);
  const r = validateScore(s);
  expect(r.ok).toBe(false);
  const codes = r.issues.map((i) => i.code);
  expect(codes, JSON.stringify(r.issues)).toContain(code);
  r.issues.forEach((i) => expect(i.message.length).toBeGreaterThan(5));
}

describe('gu-score/1 validation', () => {
  it('accepts the supplied original fixture', () => {
    const r = validateScore(clone());
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.score?.events).toHaveLength(8);
  });

  it('accepts every bundled score and they declare local practice', () => {
    for (const s of BUNDLED_SCORES) {
      const r = validateScore(JSON.parse(JSON.stringify(s)));
      expect(r.issues, s.arrangementId).toEqual([]);
      expect(practiceRightsIssue(s)).toBeNull();
    }
  });

  it('rejects pitch/fret inconsistency', () => expectRejected((s) => (s.events[1].pitchMidi = 66), 'semantic.pitch_fret_mismatch'));
  it('rejects duplicate IDs', () => expectRejected((s) => (s.events[1].id = 'n1'), 'semantic.duplicate_id'));
  it('rejects events beyond score bounds', () => expectRejected((s) => (s.durationTicks = 7000), 'semantic.out_of_bounds'));
  it('rejects overlapping notes', () => expectRejected((s) => (s.events[0].durationTicks = 1000), 'semantic.overlap'));
  it('rejects unordered events', () =>
    expectRejected((s) => {
      const [a, b] = [s.events[0], s.events[1]];
      s.events[0] = b;
      s.events[1] = a;
    }, 'semantic.order'));
  it('rejects a finger on an open string', () => expectRejected((s) => (s.events[0].finger = 1), 'schema.type'));
  it('rejects a capo', () => expectRejected((s) => (s.instrument.capo = 2), 'schema.const'));
  it('rejects chord events', () => expectRejected((s) => (s.events[0].kind = 'chord'), 'schema.const'));
  it('rejects tempo changes', () => expectRejected((s) => s.tempoMap.push({ tick: 3840, bpm: 90 }), 'schema.maxItems'));
  it('rejects unknown properties instead of dropping them', () => expectRejected((s) => (s.events[0].technique = 'bend'), 'schema.additionalProperties'));
  it('rejects negative duration', () => expectRejected((s) => (s.events[0].durationTicks = -960), 'schema.minimum'));
  it('rejects malformed date-time (formats enabled)', () => expectRejected((s) => (s.provenance.createdAt = 'yesterday'), 'schema.format'));
  it('rejects frets beyond maxFret', () =>
    expectRejected((s) => {
      s.instrument.maxFret = 12;
      s.events[0].fret = 13;
      s.events[0].pitchMidi = 77;
      s.events[0].finger = 1;
    }, 'semantic.fret_range'));
  it('rejects non-monotonic alignment anchors', () =>
    expectRejected((s) => {
      s.sourceAudio = {
        assetId: 'a1',
        sha256: 'a'.repeat(64),
        durationSec: 30,
        rights: s.rights,
        alignmentStatus: 'candidate',
        anchors: [
          { tick: 0, sourceSec: 1 },
          { tick: 960, sourceSec: 0.5 },
        ],
      };
    }, 'semantic.anchor_monotonic'));
  it('rejects alternate tunings', () => expectRejected((s) => (s.instrument.strings[5].openMidi = 38), 'schema.const'));
  it('rejects 3/4 meter', () => expectRejected((s) => (s.meterMap[0].numerator = 3), 'schema.const'));

  it('rejects malformed JSON text and oversize input with actionable messages', () => {
    const bad = parseScoreJson('{"schemaVersion":');
    expect(bad.ok).toBe(false);
    expect(bad.issues[0]!.code).toBe('json.parse');
    const big = parseScoreJson(JSON.stringify(fixture), 100);
    expect(big.issues[0]!.code).toBe('json.too_large');
  });

  it('rejects non-finite numbers', () => {
    const s = clone();
    s.tempoMap[0].bpm = Number.NaN;
    expect(validateScore(s).issues[0]!.code).toBe('json.non_finite');
  });
});

import { readFileSync } from 'node:fs';
describe('precompiled validators', () => {
  it('src/generated/validators.js is up to date with the schemas', async () => {
    // @ts-expect-error untyped script module
    const { generate } = await import('../../scripts/gen-validators.mjs');
    expect(readFileSync(new URL('../../src/generated/validators.js', import.meta.url), 'utf8')).toBe(generate());
  });
});

describe('gu-score/2 validation (chord track, sections, capo, techniques)', () => {
  const v2 = (): AnyObj => ({
    ...clone(),
    schemaVersion: 'gu-score/2',
    sections: [{ tick: 0, name: 'Intro' }, { tick: 3840, name: 'Verse' }],
    chords: [
      { id: 'c1', startTick: 0, durationTicks: 3840, name: 'Em', frets: [0, 0, 0, 2, 2, 0], pattern: 'D-D-DUDU' },
      { id: 'c2', startTick: 3840, durationTicks: 3840, name: 'Am', frets: [0, 1, 2, 2, 0, null], pattern: null },
    ],
  });
  const rejected = (mutate: (s: AnyObj) => void, code: string) => {
    const s = v2();
    mutate(s);
    const r = validateScore(s);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code), JSON.stringify(r.issues)).toContain(code);
  };

  it('accepts chords, sections and techniques', () => {
    const s = v2();
    s.events[0].techniques = [{ kind: 'vibrato' }];
    const r = validateScore(s);
    expect(r.issues).toEqual([]);
  });
  it('still rejects v2 features in a gu-score/1 file', () => {
    const s = v2();
    s.schemaVersion = 'gu-score/1';
    expect(validateScore(s).ok).toBe(false);
  });
  it('accepts a capo when frets are counted from it', () => {
    const s = v2();
    s.instrument.capo = 2;
    for (const e of s.events) e.pitchMidi += 2;
    expect(validateScore(s).issues).toEqual([]);
  });
  it('rejects a capo whose pitches ignore it', () => rejected((s) => (s.instrument.capo = 2), 'semantic.pitch_fret_mismatch'));
  it('rejects overlapping chords', () => rejected((s) => (s.chords[0].durationTicks = 4000), 'semantic.overlap'));
  it('rejects an empty chord', () => rejected((s) => (s.chords[0].frets = [null, null, null, null, null, null]), 'semantic.empty_chord'));
  it('rejects bad strum patterns', () => rejected((s) => (s.chords[0].pattern = 'DXZ'), 'schema.pattern'));
  it('rejects unordered sections', () => rejected((s) => (s.sections[1].tick = 0), 'semantic.order'));
  it('allows a chord-only arrangement but not an empty one', () => {
    const s = v2();
    s.events = [];
    expect(validateScore(s).issues).toEqual([]);
    rejected((x) => { x.events = []; x.chords = []; }, 'semantic.empty');
  });
  it('rejects unknown technique kinds', () => rejected((s) => (s.events[0].techniques = [{ kind: 'windmill' }]), 'schema.enum'));
  it('accepts recordings up to 30 minutes', () => {
    const s = v2();
    s.sourceAudio = { assetId: 'a1', sha256: 'a'.repeat(64), durationSec: 1500, rights: s.rights, alignmentStatus: 'candidate', anchors: [{ tick: 0, sourceSec: 0 }, { tick: 960, sourceSec: 0.5 }] };
    expect(validateScore(s).issues).toEqual([]);
  });
});
