/**
 * Versioned progress export/import (master spec §10.2). Export excludes audio
 * (none is stored) and device identifiers. Import validates byte size, schema
 * and semantic references before replacing local data. Imported records are
 * flagged `imported`; an imported self-report stays a self-report.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import { KNOWN_LESSON_IDS } from '../learning/lessons';
import { DEFAULT_SETTINGS, type ExportManifest, type LessonProgress, type PracticeSummaryRecord, type Settings } from './types';

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const APP_ID = 'guitar-unhero 0.1.0';

const ratio = {
  type: 'object',
  additionalProperties: false,
  required: ['correct', 'assessed', 'accuracy'],
  properties: { correct: { type: 'integer', minimum: 0 }, assessed: { type: 'integer', minimum: 0 }, accuracy: { type: ['number', 'null'], minimum: 0, maximum: 1 } },
};

const evidence = { enum: ['sensor', 'self_reported', 'simulated'] };
const iso = { type: 'string', maxLength: 40 };

const manifestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['format', 'formatVersion', 'exportedAt', 'app', 'settings', 'lessons', 'summaries'],
  properties: {
    format: { const: 'guitar-unhero-progress' },
    formatVersion: { const: 1 },
    exportedAt: iso,
    app: { type: 'string', maxLength: 100 },
    settings: {
      type: 'object',
      additionalProperties: false,
      properties: {
        handedness: { enum: ['right', 'left'] },
        hasGuitar: { type: ['boolean', 'null'] },
        inputMode: { enum: ['microphone', 'simulation', 'none'] },
        deviceId: { type: 'null' },
        outputRoute: { enum: ['headphones', 'speakers', 'unknown'] },
        reducedMotion: { enum: ['system', 'on', 'off'] },
        highContrast: { type: 'boolean' },
        guideLevel: { type: 'number', minimum: 0, maximum: 1 },
        metronomeLevel: { type: 'number', minimum: 0, maximum: 1 },
        referenceLevel: { type: 'number', minimum: 0, maximum: 1 },
        practiceRate: { enum: [0.5, 0.75, 1] },
        practiceMode: { enum: ['listen', 'fixed', 'wait'] },
        guideOn: { type: 'boolean' },
        metronomeOn: { type: 'boolean' },
        lookaheadSec: { type: 'number', minimum: 1, maximum: 6 },
        onboarded: { type: 'boolean' },
        calibration: {
          oneOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              required: ['method', 'offsetMs', 'spreadMs', 'samples', 'deviceId', 'sampleRate', 'outputRoute', 'createdAt'],
              properties: {
                method: { enum: ['loopback', 'manual'] },
                offsetMs: { type: 'number', minimum: -500, maximum: 1000 },
                spreadMs: { type: ['number', 'null'], minimum: 0, maximum: 1000 },
                samples: { type: 'integer', minimum: 0, maximum: 1000 },
                deviceId: { type: 'null' },
                sampleRate: { type: ['number', 'null'] },
                outputRoute: { enum: ['headphones', 'speakers', 'unknown'] },
                createdAt: iso,
              },
            },
          ],
        },
      },
    },
    lessons: {
      type: 'array',
      maxItems: 500,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lessonId', 'lessonVersion', 'completedSteps', 'completedAt', 'completionEvidence', 'skillState'],
        properties: {
          lessonId: { type: 'string', maxLength: 120 },
          lessonVersion: { type: 'integer', minimum: 1 },
          completedSteps: {
            type: 'array',
            maxItems: 200,
            items: { type: 'object', additionalProperties: false, required: ['stepId', 'evidence', 'at'], properties: { stepId: { type: 'string', maxLength: 120 }, evidence, at: iso } },
          },
          completedAt: { type: ['string', 'null'], maxLength: 40 },
          completionEvidence: { oneOf: [{ type: 'null' }, evidence] },
          skillState: { enum: ['unseen', 'introduced', 'practicing', 'demonstrated', 'retained'] },
          imported: { type: 'boolean' },
        },
      },
    },
    summaries: {
      type: 'array',
      maxItems: 5000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'arrangementId', 'arrangementVersion', 'title', 'mode', 'rate', 'loop', 'inputSource', 'simulated', 'calibrated', 'policyVersion', 'stats', 'suggestion', 'startedAt', 'finishedAt'],
        properties: {
          id: { type: 'string', maxLength: 120 },
          arrangementId: { type: 'string', maxLength: 120, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' },
          arrangementVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string', maxLength: 200 },
          mode: { enum: ['listen', 'fixed', 'wait'] },
          rate: { enum: [0.5, 0.75, 1] },
          loop: { oneOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['aTick', 'bTick'], properties: { aTick: { type: 'integer', minimum: 0 }, bTick: { type: 'integer', minimum: 1 } } }] },
          inputSource: { enum: ['microphone', 'simulation', 'none'] },
          simulated: { type: 'boolean' },
          calibrated: { type: 'boolean' },
          policyVersion: { type: 'string', maxLength: 40 },
          suggestion: { type: 'string', maxLength: 2000 },
          startedAt: iso,
          finishedAt: iso,
          imported: { type: 'boolean' },
          stats: {
            type: 'object',
            additionalProperties: false,
            required: ['eligible', 'assessable', 'coverage', 'pitch', 'timing', 'states', 'missed', 'wrongPitch'],
            properties: {
              eligible: { type: 'integer', minimum: 0 },
              assessable: { type: 'integer', minimum: 0 },
              coverage: { type: ['number', 'null'], minimum: 0, maximum: 1 },
              pitch: ratio,
              timing: {
                type: 'object',
                additionalProperties: false,
                required: ['correct', 'assessed', 'accuracy', 'meanErrorMs', 'approximate', 'enabled'],
                properties: { ...ratio.properties, meanErrorMs: { type: ['number', 'null'] }, approximate: { type: 'boolean' }, enabled: { type: 'boolean' } },
              },
              states: {
                type: 'object',
                additionalProperties: false,
                required: ['correct', 'incorrect', 'uncertain', 'not_assessed'],
                properties: { correct: { type: 'integer', minimum: 0 }, incorrect: { type: 'integer', minimum: 0 }, uncertain: { type: 'integer', minimum: 0 }, not_assessed: { type: 'integer', minimum: 0 } },
              },
              missed: { type: 'integer', minimum: 0 },
              wrongPitch: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  },
} as const;

let validator: ReturnType<Ajv2020['compile']> | null = null;
function getValidator() {
  if (!validator) validator = new Ajv2020({ allErrors: true, strict: false }).compile(manifestSchema);
  return validator;
}

export function buildExport(settings: Settings, lessons: LessonProgress[], summaries: PracticeSummaryRecord[], now = new Date()): ExportManifest {
  return {
    format: 'guitar-unhero-progress',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    app: APP_ID,
    // Device IDs are local identifiers; they are not exported.
    settings: { ...settings, deviceId: null, calibration: settings.calibration ? { ...settings.calibration, deviceId: null } : null },
    lessons,
    summaries,
  };
}

export type ImportResult =
  | { ok: true; settings: Settings; lessons: LessonProgress[]; summaries: PracticeSummaryRecord[] }
  | { ok: false; errors: string[] };

export function parseImport(text: string): ImportResult {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_IMPORT_BYTES) return { ok: false, errors: [`The file is ${bytes} bytes; the limit is ${MAX_IMPORT_BYTES}.`] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const v = getValidator();
  if (!v(data)) {
    return { ok: false, errors: (v.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '/'}: ${e.message ?? 'invalid'}`) };
  }
  const m = data as ExportManifest;
  const errors: string[] = [];
  const seenLessons = new Set<string>();
  for (const l of m.lessons) {
    if (!KNOWN_LESSON_IDS.has(l.lessonId)) errors.push(`Unknown lesson "${l.lessonId}".`);
    if (seenLessons.has(l.lessonId)) errors.push(`Lesson "${l.lessonId}" appears twice.`);
    seenLessons.add(l.lessonId);
  }
  const seenSummaries = new Set<string>();
  for (const s of m.summaries) {
    if (seenSummaries.has(s.id)) errors.push(`Summary "${s.id}" appears twice.`);
    seenSummaries.add(s.id);
    if (s.stats.assessable > s.stats.eligible) errors.push(`Summary "${s.id}" has more assessed than eligible notes.`);
    if (s.inputSource === 'simulation' && !s.simulated) errors.push(`Summary "${s.id}" came from simulation but is not labeled simulated.`);
    if (s.loop && s.loop.bTick <= s.loop.aTick) errors.push(`Summary "${s.id}" has an invalid loop.`);
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    settings: { ...DEFAULT_SETTINGS, ...m.settings, deviceId: null },
    lessons: m.lessons.map((l) => ({ ...l, imported: true })),
    summaries: m.summaries.map((s) => ({ ...s, imported: true })),
  };
}
