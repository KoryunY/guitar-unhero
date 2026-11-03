/**
 * Retention (master spec §3.4): a skill is `retained` only after a later recall
 * attempt — cues reduced or hidden, real microphone, ≥80 % pitch on assessed notes,
 * ≥70 % coverage — on a different calendar day from an earlier successful attempt.
 */
import type { PracticeSummaryRecord } from '../storage/types';

export type RetentionResult = 'retained' | 'come-back-later' | null;

const day = (iso: string) => iso.slice(0, 10);
const success = (h: PracticeSummaryRecord) => h.inputSource === 'microphone' && (h.stats.pitch.accuracy ?? 0) >= 0.8 && (h.stats.coverage ?? 0) >= 0.7;

export function retentionCheck(latest: PracticeSummaryRecord, earlier: readonly PracticeSummaryRecord[]): RetentionResult {
  if (!success(latest) || (latest.cueLevel ?? 'full') === 'full') return null;
  const earlierDay = earlier.some((h) => h.id !== latest.id && h.arrangementId === latest.arrangementId && success(h) && day(h.finishedAt) < day(latest.finishedAt));
  return earlierDay ? 'retained' : 'come-back-later';
}
