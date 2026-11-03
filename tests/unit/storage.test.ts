import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStores, closeDb, loadLessons, loadSettings, loadSummaries, replaceAll, saveLesson, saveSettings, saveSummary } from '../../src/storage/db';
import { buildExport, parseImport } from '../../src/storage/exchange';
import { DEFAULT_SETTINGS, type LessonProgress, type PracticeSummaryRecord } from '../../src/storage/types';
import { LESSONS, attemptFeedback } from '../../src/learning/lessons';
import { findBundledScore } from '../../src/content/scores';

const lesson: LessonProgress = {
  lessonId: 'lesson.high-e.first-sound.v1', lessonVersion: 1,
  completedSteps: [{ stepId: 'your-turn', evidence: 'self_reported', at: '2026-11-03T10:00:00.000Z' }],
  completedAt: null, completionEvidence: null, skillState: 'practicing',
};
const summary: PracticeSummaryRecord = {
  id: 's1', arrangementId: 'exercise.first-two-strings', arrangementVersion: 1, title: 'x', mode: 'fixed', rate: 0.5, loop: null,
  inputSource: 'simulation', simulated: true, calibrated: false, policyVersion: 'beginner-1',
  stats: { eligible: 8, assessable: 8, coverage: 1, pitch: { correct: 8, assessed: 8, accuracy: 1 }, timing: { correct: 8, assessed: 8, accuracy: 1, meanErrorMs: 3, approximate: true, enabled: true }, states: { correct: 8, incorrect: 0, uncertain: 0, not_assessed: 0 }, missed: 0, wrongPitch: 0 },
  suggestion: 'Simulation only', startedAt: '2026-11-03T10:00:00.000Z', finishedAt: '2026-11-03T10:01:00.000Z',
};

describe('IndexedDB persistence (AC-20)', () => {
  beforeEach(async () => {
    await closeDb();
    indexedDB.deleteDatabase('guitar-unhero');
  });

  it('restores settings, lesson progress and summaries after reopening', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, handedness: 'left', onboarded: true, practiceRate: 0.75 });
    await saveLesson(lesson);
    await saveSummary(summary);
    await closeDb(); // simulate reload
    expect((await loadSettings()).handedness).toBe('left');
    expect((await loadSettings()).practiceRate).toBe(0.75);
    expect(await loadLessons()).toEqual([lesson]);
    expect((await loadSummaries())[0]!.id).toBe('s1');
  });

  it('export → import round-trips and keeps simulation/self-report labels', async () => {
    const exported = buildExport({ ...DEFAULT_SETTINGS, deviceId: 'secret-device', onboarded: true }, [lesson], [summary]);
    expect(exported.settings.deviceId).toBeNull();
    const text = JSON.stringify(exported);
    const r = parseImport(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lessons[0]!.completedSteps[0]!.evidence).toBe('self_reported');
    expect(r.summaries[0]!.simulated).toBe(true);
    expect(r.summaries[0]!.imported).toBe(true);
    await replaceAll(r.settings, r.lessons, r.summaries);
    expect(await loadLessons()).toHaveLength(1);
  });

  it('rejects malformed, oversized, unknown-lesson and relabeled-simulation imports', () => {
    expect(parseImport('nope').ok).toBe(false);
    expect(parseImport('x'.repeat(1024 * 1024 + 1)).ok).toBe(false);
    const base = buildExport(DEFAULT_SETTINGS, [lesson], [summary]);
    const unknown = { ...base, lessons: [{ ...lesson, lessonId: 'lesson.made-up' }] };
    expect(parseImport(JSON.stringify(unknown))).toMatchObject({ ok: false });
    const relabeled = { ...base, summaries: [{ ...summary, simulated: false }] };
    expect(parseImport(JSON.stringify(relabeled))).toMatchObject({ ok: false });
    const extra = { ...base, script: 'alert(1)' };
    expect(parseImport(JSON.stringify(extra))).toMatchObject({ ok: false });
  });

  it('delete clears only the selected stores', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, onboarded: true });
    await saveLesson(lesson);
    await saveSummary(summary);
    await clearStores(['summaries']);
    expect(await loadSummaries()).toHaveLength(0);
    expect(await loadLessons()).toHaveLength(1);
    await clearStores(['lessons', 'settings']);
    expect(await loadLessons()).toHaveLength(0);
    expect((await loadSettings()).onboarded).toBe(false);
  });
});

describe('lesson content', () => {
  it('references only bundled scores and declares unreviewed status honestly', () => {
    for (const l of LESSONS) {
      expect(l.reviewStatus).toBe('unreviewed');
      if (l.scoreRef) expect(findBundledScore(l.scoreRef)).toBeDefined();
      for (const s of l.steps) if (s.scoreRef) expect(findBundledScore(s.scoreRef)).toBeDefined();
      expect(l.steps.at(-1)!.kind).toBe('choice');
    }
    const first = LESSONS[0]!;
    expect(first.lessonId).toBe('lesson.high-e.first-sound.v1');
    expect(first.steps.some((s) => s.kind === 'attempt' && s.selfCheckLabel)).toBe(true);
  });
  it('gives specific observations', () => {
    expect(attemptFeedback({ targetMidi: 64, string: 1, fret: 0, finger: null, required: 3 }, 64.1)).toEqual({ correct: true, text: 'I heard E.' });
    expect(attemptFeedback({ targetMidi: 67, string: 1, fret: 3, finger: 3, required: 2 }, 65).text).toContain('That sounded like F');
    expect(attemptFeedback({ targetMidi: 65, string: 1, fret: 1, finger: 1, required: 2 }, 64).text).toContain('the open string');
    expect(attemptFeedback({ targetMidi: 64, string: 1, fret: 0, finger: null, required: 3 }, 59).text).toContain('open string 2');
  });
});
