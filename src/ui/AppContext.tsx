import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { engine } from '../audio/engine';
import type { MicState } from '../audio/mic';
import { calibrationValid } from '../audio/calibration';
import { clearStores, loadLessons, loadSettings, loadSummaries, replaceAll, saveLesson, saveSettings, saveSummary } from '../storage/db';
import { DEFAULT_SETTINGS, type Evidence, type LessonProgress, type PracticeSummaryRecord, type Settings } from '../storage/types';
import { findLesson, LESSONS } from '../learning/lessons';
import { retentionCheck, type RetentionResult } from '../learning/retention';

interface AppApi {
  ready: boolean;
  settings: Settings;
  lessons: Record<string, LessonProgress>;
  summaries: PracticeSummaryRecord[];
  storageError: string | null;
  mic: MicState;
  updateSettings(patch: Partial<Settings>): void;
  recordStep(lessonId: string, stepId: string, evidence: Evidence): void;
  completeLesson(lessonId: string, evidence: Evidence): void;
  addSummary(s: PracticeSummaryRecord): RetentionResult;
  deleteData(which: { progress: boolean; summaries: boolean; settings: boolean }): Promise<void>;
  importData(settings: Settings, lessons: LessonProgress[], summaries: PracticeSummaryRecord[]): Promise<void>;
  /** Valid combined output→input offset in seconds, or null. */
  deltaIO: number | null;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** Strongest evidence wins; a self-report never becomes sensor evidence. */
function strongest(a: Evidence | null, b: Evidence): Evidence {
  const rank: Record<Evidence, number> = { simulated: 0, self_reported: 1, sensor: 2 };
  if (!a) return b;
  return rank[b] > rank[a] ? b : a;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lessons, setLessons] = useState<Record<string, LessonProgress>>({});
  const [summaries, setSummaries] = useState<PracticeSummaryRecord[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [mic, setMic] = useState<MicState>(engine.micState);
  const [trackTick, setTrackTick] = useState(0);
  const lessonsRef = useRef(lessons);
  lessonsRef.current = lessons;

  const fail = (what: string) => (e: unknown) =>
    setStorageError(`Not saved: ${what}. ${(e as Error)?.message ?? ''} Your browser may be blocking storage or be out of space; use Export to keep a copy.`);

  useEffect(() => {
    (async () => {
      try {
        const [s, l, sm] = await Promise.all([loadSettings(), loadLessons(), loadSummaries()]);
        setSettings(s);
        setLessons(Object.fromEntries(l.map((x) => [x.lessonId, x])));
        setSummaries(sm);
      } catch (e) {
        setStorageError(`Saved progress could not be loaded (${(e as Error).message}). The app still works, but progress may not be saved.`);
      }
      setReady(true);
    })();
    return engine.on('mic', (m) => {
      setMic(m);
      setTrackTick((x) => x + 1);
    });
  }, []);

  // Apply display preferences.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    const reduce = settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    root.dataset.motion = reduce ? 'reduce' : 'normal';
    engine.setBusLevel('guide', settings.guideLevel);
    engine.setBusLevel('metronome', settings.metronomeLevel);
    engine.setBusLevel('reference', settings.referenceLevel);
  }, [settings]);

  // Simulation coverage ticker only while simulation is selected.
  useEffect(() => {
    if (settings.inputMode === 'simulation') {
      engine.stopMic();
      engine.startSimulationCoverage();
    } else engine.stopSimulationCoverage();
  }, [settings.inputMode]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).then(() => setStorageError(null), fail('settings'));
      return next;
    });
  }, []);

  const writeLesson = useCallback((p: LessonProgress) => {
    setLessons((prev) => ({ ...prev, [p.lessonId]: p }));
    saveLesson(p).then(() => setStorageError(null), fail('lesson progress'));
  }, []);

  const base = (lessonId: string): LessonProgress =>
    lessonsRef.current[lessonId] ?? {
      lessonId,
      lessonVersion: findLesson(lessonId)?.version ?? 1,
      completedSteps: [],
      completedAt: null,
      completionEvidence: null,
      skillState: 'introduced',
    };

  const recordStep = useCallback((lessonId: string, stepId: string, evidence: Evidence) => {
    const p = base(lessonId);
    const others = p.completedSteps.filter((s) => s.stepId !== stepId);
    const prev = p.completedSteps.find((s) => s.stepId === stepId);
    writeLesson({
      ...p,
      skillState: p.skillState === 'unseen' || p.skillState === 'introduced' ? 'practicing' : p.skillState,
      completedSteps: [...others, { stepId, evidence: strongest(prev?.evidence ?? null, evidence), at: new Date().toISOString() }],
    });
  }, [writeLesson]);

  const completeLesson = useCallback((lessonId: string, evidence: Evidence) => {
    const p = base(lessonId);
    const ev = strongest(p.completionEvidence, evidence);
    writeLesson({
      ...p,
      completedAt: p.completedAt ?? new Date().toISOString(),
      completionEvidence: ev,
      // Only sensor evidence can mark a skill demonstrated; retention needs a later recall attempt (M2).
      skillState: p.skillState === 'retained' ? 'retained' : ev === 'sensor' ? 'demonstrated' : 'practicing',
    });
  }, [writeLesson]);

  const summariesRef = useRef(summaries);
  summariesRef.current = summaries;
  const addSummary = useCallback((s: PracticeSummaryRecord): RetentionResult => {
    const result = retentionCheck(s, summariesRef.current);
    setSummaries((prev) => [s, ...prev]);
    saveSummary(s).then(() => setStorageError(null), fail('practice summary'));
    if (result === 'retained') {
      for (const l of LESSONS.filter((x) => x.scoreRef === s.arrangementId)) {
        const p = lessonsRef.current[l.lessonId] ?? base(l.lessonId);
        writeLesson({ ...p, skillState: 'retained', retainedAt: s.finishedAt });
      }
    }
    return result;
  }, [writeLesson]);

  const deleteData = useCallback(async (which: { progress: boolean; summaries: boolean; settings: boolean }) => {
    const stores = [...(which.progress ? (['lessons'] as const) : []), ...(which.summaries ? (['summaries'] as const) : []), ...(which.settings ? (['settings'] as const) : [])];
    await clearStores([...stores]);
    if (which.progress) setLessons({});
    if (which.summaries) setSummaries([]);
    if (which.settings) setSettings(DEFAULT_SETTINGS);
  }, []);

  const importData = useCallback(async (s: Settings, l: LessonProgress[], sm: PracticeSummaryRecord[]) => {
    await replaceAll(s, l, sm);
    setSettings(s);
    setLessons(Object.fromEntries(l.map((x) => [x.lessonId, x])));
    setSummaries([...sm].sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1)));
  }, []);

  const deltaIO = useMemo(() => {
    void trackTick;
    const cal = settings.calibration;
    const valid = calibrationValid(cal, { deviceId: engine.track?.deviceId ?? settings.deviceId, sampleRate: engine.sampleRate, outputRoute: settings.outputRoute });
    return valid && cal ? cal.offsetMs / 1000 : null;
  }, [settings.calibration, settings.deviceId, settings.outputRoute, trackTick]);

  const api: AppApi = {
    ready, settings, lessons, summaries, storageError, mic,
    updateSettings, recordStep, completeLesson, addSummary, deleteData, importData, deltaIO,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
