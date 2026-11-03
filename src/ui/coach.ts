/**
 * UI glue for the coach personality (jokes) and the rank/journey progress.
 * Jokes are always an extra line beside plain instructions.
 */
import { useMemo } from 'react';
import { useApp } from './AppContext';
import { voiceLine, type VoiceEvent } from '../learning/voice';
import { CHAPTERS } from '../learning/chapters';
import { LESSONS } from '../learning/lessons';
import type { LessonProgress, PracticeSummaryRecord } from '../storage/types';

/** One joke for an event, stable for the given seed (so it does not flicker on re-render). */
export function useJoke(event: VoiceEvent | null, seed = 0): string | null {
  const { settings } = useApp();
  return useMemo(() => (event ? voiceLine(event, settings.voice, seed) : null), [event, settings.voice, seed]);
}

export function completedLessonIds(lessons: Record<string, LessonProgress>): Set<string> {
  return new Set(Object.values(lessons).filter((l) => l.completedAt).map((l) => l.lessonId));
}

/** Days in a row (ending today or yesterday) with any practice or lesson activity. */
export function streakDays(summaries: readonly PracticeSummaryRecord[], lessons: Record<string, LessonProgress>, now = new Date()): number {
  const days = new Set<string>([
    ...summaries.map((s) => s.finishedAt.slice(0, 10)),
    ...Object.values(lessons).flatMap((l) => l.completedSteps.map((c) => c.at.slice(0, 10))),
  ]);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const d = new Date(now);
  if (!days.has(key(d))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(key(d))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export function chapterOf(lessonId: string) {
  return CHAPTERS.find((c) => c.ids.includes(lessonId)) ?? null;
}

export function lessonNumber(lessonId: string): number {
  return LESSONS.findIndex((l) => l.lessonId === lessonId) + 1;
}

/** A deterministic per-day seed so the coach says one thing per day per screen. */
export function daySeed(extra = 0): number {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate() + extra * 7;
}
