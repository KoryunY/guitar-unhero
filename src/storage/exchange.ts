/**
 * Versioned progress export/import (master spec §10.2). Export excludes audio
 * (none is stored) and device identifiers. Import validates byte size, schema
 * and semantic references before replacing local data. Imported records are
 * flagged `imported`; an imported self-report stays a self-report.
 * Schema: src/storage/progress-export.schema.json (precompiled).
 */
import { validateManifestSchema } from '../generated/validators.js';
import { KNOWN_LESSON_IDS } from '../learning/lessons';
import { DEFAULT_SETTINGS, type ExportManifest, type LessonProgress, type PracticeSummaryRecord, type Settings } from './types';

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const APP_ID = 'guitar-unhero 0.1.0';

function getValidator() {
  return validateManifestSchema;
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
