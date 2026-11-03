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
