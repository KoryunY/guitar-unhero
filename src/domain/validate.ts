/**
 * gu-score/1 validation = JSON Schema (Draft 2020-12, formats enabled) + semantic checks.
 * Unknown properties and unsupported features are rejected, never silently dropped.
 */
import type { ErrorObject } from 'ajv';
import { validateScoreSchema, validateScoreV2Schema } from '../generated/validators.js';
import type { Score } from './score';
import { fretToMidi, isStringNumber } from './tuning';

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; score: Score; issues: [] }
  | { ok: false; score: null; issues: ValidationIssue[] };

export const MAX_SCORE_BYTES = 2 * 1024 * 1024;

/**
 * Precompiled (scripts/gen-validators.mjs) from Documents/gu-score-v1/v2.schema.json
 * with Draft 2020-12 and date-time format checks enabled. No runtime eval.
 */
function getSchemaValidator(value: unknown) {
  const v = value && typeof value === 'object' ? (value as { schemaVersion?: unknown }).schemaVersion : undefined;
  return v === 'gu-score/2' ? validateScoreV2Schema : validateScoreSchema;
}

const HINTS: Record<string, string> = {
  '/instrument/capo': 'Capo needs gu-score/2 (0–9); in gu-score/1 it must be 0.',
  '/meterMap': 'Only a single 4/4 meter at tick 0 is supported in gu-score/1.',
  '/tempoMap': 'Only one constant tempo at tick 0 is supported in gu-score/1.',
  '/instrument/strings': 'Only standard tuning E4 B3 G3 D3 A2 E2 (strings 1→6) is supported.',
  '/ppq': 'PPQ must be 960.',
  '/schemaVersion': 'schemaVersion must be "gu-score/1" or "gu-score/2".',
};

function describeAjvError(e: ErrorObject): ValidationIssue {
  const path = e.instancePath || '/';
  const hintKey = Object.keys(HINTS).find((k) => path === k || path.startsWith(`${k}/`));
  let message: string;
  switch (e.keyword) {
    case 'additionalProperties':
      message = `Unknown or unsupported property "${String((e.params as { additionalProperty?: string }).additionalProperty)}" — it is rejected rather than ignored.`;
      break;
    case 'required':
      message = `Missing required property "${String((e.params as { missingProperty?: string }).missingProperty)}".`;
      break;
    case 'format':
      message = `Value must be a valid ${String((e.params as { format?: string }).format)} (for example 2026-11-03T00:00:00Z).`;
      break;
    case 'const':
    case 'enum':
      message = hintKey ? HINTS[hintKey]! : `Unsupported value: ${e.message ?? 'not allowed'}.`;
      break;
    default:
      message = `${e.message ?? 'invalid value'}${hintKey ? ` — ${HINTS[hintKey]}` : ''}`;
  }
  return { path, code: `schema.${e.keyword}`, message };
}

function hasNonFiniteNumber(value: unknown, path = ''): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : path || '/';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = hasNonFiniteNumber(value[i], `${path}/${i}`);
      if (r) return r;
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const r = hasNonFiniteNumber(v, `${path}/${k}`);
      if (r) return r;
    }
  }
  return null;
}

/** Semantic checks the JSON Schema cannot express. Assumes schema validity. */
export function semanticIssues(score: Score): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  let prev: Score['events'][number] | null = null;

  score.events.forEach((ev, i) => {
    const p = `/events/${i}`;
    if (ids.has(ev.id)) issues.push({ path: `${p}/id`, code: 'semantic.duplicate_id', message: `Duplicate event ID "${ev.id}".` });
    ids.add(ev.id);

    if (!isStringNumber(ev.string)) {
      issues.push({ path: `${p}/string`, code: 'semantic.string', message: `String ${ev.string} is outside 1–6.` });
    } else {
      if (ev.fret + score.instrument.capo > score.instrument.maxFret) {
        issues.push({
          path: `${p}/fret`,
          code: 'semantic.fret_range',
          message: `Fret ${ev.fret} exceeds the instrument's maxFret ${score.instrument.maxFret}.`,
        });
      }
      const capo = score.instrument.capo;
      const expected = fretToMidi(ev.string, ev.fret, capo);
      if (expected !== ev.pitchMidi) {
        issues.push({
          path: `${p}/pitchMidi`,
          code: 'semantic.pitch_fret_mismatch',
          message: `String ${ev.string} fret ${ev.fret}${capo ? ` (capo ${capo})` : ''} sounds MIDI ${expected}, but pitchMidi is ${ev.pitchMidi}.`,
        });
      }
    }
    if (ev.fret === 0 && ev.finger !== null) {
      issues.push({ path: `${p}/finger`, code: 'semantic.open_string_finger', message: 'An open string (fret 0) cannot require a fretting finger.' });
    }
    const end = ev.startTick + ev.durationTicks;
    if (end > score.durationTicks) {
      issues.push({
        path: p,
        code: 'semantic.out_of_bounds',
        message: `Event "${ev.id}" ends at tick ${end}, after the score's durationTicks ${score.durationTicks}.`,
      });
    }
    if (prev) {
      const ordered = prev.startTick < ev.startTick || (prev.startTick === ev.startTick && prev.id < ev.id);
      if (!ordered) {
        issues.push({ path: p, code: 'semantic.order', message: `Events must be ordered by startTick then ID; "${ev.id}" is out of order.` });
      } else if (ev.startTick < prev.startTick + prev.durationTicks) {
        issues.push({
          path: p,
          code: 'semantic.overlap',
          message: `Event "${ev.id}" overlaps "${prev.id}"; gu-score/1 is monophonic (no overlapping notes).`,
        });
      }
    }
    prev = ev;
  });

  score.transformations.forEach((t, i) => {
    t.resultEventIds.forEach((rid) => {
      if (!ids.has(rid)) {
        issues.push({
          path: `/transformations/${i}/resultEventIds`,
          code: 'semantic.dangling_reference',
          message: `Transformation result references unknown event "${rid}".`,
        });
      }
    });
  });

  let prevChord: NonNullable<Score['chords']>[number] | null = null;
  const chordIds = new Set<string>();
  (score.chords ?? []).forEach((c, i) => {
    const p = `/chords/${i}`;
    if (chordIds.has(c.id) || ids.has(c.id)) issues.push({ path: `${p}/id`, code: 'semantic.duplicate_id', message: `Duplicate event ID "${c.id}".` });
    chordIds.add(c.id);
    if (c.frets.every((f) => f === null)) issues.push({ path: `${p}/frets`, code: 'semantic.empty_chord', message: 'A chord must play at least one string.' });
    c.frets.forEach((f, k) => {
      if (f !== null && f + score.instrument.capo > score.instrument.maxFret) issues.push({ path: `${p}/frets/${k}`, code: 'semantic.fret_range', message: `Fret ${f}${score.instrument.capo ? ` above capo ${score.instrument.capo}` : ''} exceeds maxFret ${score.instrument.maxFret}.` });
      const fg = c.fingers?.[k];
      if (fg && (f === null || f === 0)) issues.push({ path: `${p}/fingers/${k}`, code: 'semantic.open_string_finger', message: 'A finger is given for an open or unplayed string.' });
    });
    if (c.startTick + c.durationTicks > score.durationTicks) issues.push({ path: p, code: 'semantic.out_of_bounds', message: `Chord "${c.id}" ends after the score.` });
    if (prevChord) {
      if (c.startTick < prevChord.startTick) issues.push({ path: p, code: 'semantic.order', message: 'Chords must be ordered by startTick.' });
      else if (c.startTick < prevChord.startTick + prevChord.durationTicks) issues.push({ path: p, code: 'semantic.overlap', message: `Chord "${c.id}" overlaps "${prevChord.id}".` });
    }
    prevChord = c;
  });
  (score.sections ?? []).forEach((sec, i) => {
    if (sec.tick > score.durationTicks) issues.push({ path: `/sections/${i}`, code: 'semantic.out_of_bounds', message: 'Section starts after the end of the score.' });
    if (i > 0 && sec.tick <= score.sections![i - 1]!.tick) issues.push({ path: `/sections/${i}`, code: 'semantic.order', message: 'Sections must have increasing ticks.' });
  });
  if (score.events.length === 0 && !(score.chords?.length)) {
    issues.push({ path: '/events', code: 'semantic.empty', message: 'The score has no notes and no chords.' });
  }

  if (score.parent && score.parent.arrangementId === score.arrangementId && score.parent.version >= score.version) {
    issues.push({ path: '/parent', code: 'semantic.parent_version', message: 'A parent version of the same arrangement must be older than this version.' });
  }

  if (score.sourceAudio) {
    const a = score.sourceAudio.anchors;
    for (let i = 1; i < a.length; i++) {
      const prevA = a[i - 1]!;
      const cur = a[i]!;
      if (!(cur.tick > prevA.tick && cur.sourceSec > prevA.sourceSec)) {
        issues.push({
          path: `/sourceAudio/anchors/${i}`,
          code: 'semantic.anchor_monotonic',
          message: 'Alignment anchors must strictly increase in both tick and sourceSec.',
        });
      }
    }
    a.forEach((anc, i) => {
      if (anc.sourceSec > score.sourceAudio!.durationSec || anc.tick > score.durationTicks) {
        issues.push({ path: `/sourceAudio/anchors/${i}`, code: 'semantic.anchor_bounds', message: 'Anchor lies outside the audio or score duration.' });
      }
    });
  }

  return issues;
}

/** Validate an already-parsed value. */
export function validateScore(value: unknown): ValidationResult {
  const nonFinite = hasNonFiniteNumber(value);
  if (nonFinite) {
    return { ok: false, score: null, issues: [{ path: nonFinite, code: 'json.non_finite', message: 'NaN/Infinity are not valid JSON numbers.' }] };
  }
  const validator = getSchemaValidator(value);
  if (!validator(value)) {
    const issues = (validator.errors ?? []).map(describeAjvError);
    return { ok: false, score: null, issues };
  }
  const score = value as Score;
  const issues = semanticIssues(score);
  if (issues.length) return { ok: false, score: null, issues };
  return { ok: true, score, issues: [] };
}

/** Validate untrusted JSON text with a byte limit. */
export function parseScoreJson(text: string, maxBytes = MAX_SCORE_BYTES): ValidationResult {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) {
    return { ok: false, score: null, issues: [{ path: '/', code: 'json.too_large', message: `File is ${bytes} bytes; the limit is ${maxBytes}.` }] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, score: null, issues: [{ path: '/', code: 'json.parse', message: `Not valid JSON: ${(e as Error).message}` }] };
  }
  return validateScore(parsed);
}

/** Practice requires a declared local_practice allowance (a declaration, not a licence check). */
export function practiceRightsIssue(score: Score): string | null {
  if (score.rights.status === 'restricted') return 'This arrangement is marked restricted and cannot be practised.';
  if (!score.rights.allowedUses.includes('local_practice')) return 'Rights metadata does not declare local practice use.';
  return null;
}
