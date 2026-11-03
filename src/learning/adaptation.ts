/**
 * Adaptation offers (master spec §3.4): after two phrases with ≥80 % success on
 * assessed events and ≥70 % coverage, offer the next tempo; after two phrases
 * below 60 % with adequate coverage, offer a slower tempo or a smaller loop.
 * Only one dimension changes at a time; nothing changes automatically, and low
 * coverage asks for a setup fix instead of lowering the learner's level.
 */
import type { PracticeSummaryRecord } from '../storage/types';

export type Offer =
  | { kind: 'faster'; rate: 0.75 | 1; text: string }
  | { kind: 'slower'; rate: 0.5 | 0.75; text: string }
  | { kind: 'smaller-loop'; text: string }
  | { kind: 'fewer-cues'; text: string }
  | { kind: 'try-fixed'; text: string }
  | { kind: 'setup'; text: string };

const RATES = [0.5, 0.75, 1] as const;

export function adaptationOffer(history: readonly PracticeSummaryRecord[], current: { arrangementId: string; rate: number; mode: string; cueLevel: string; loop: boolean }): Offer | null {
  // Same arrangement, same mode and rate, real microphone only, most recent first.
  const same = history.filter((h) => h.arrangementId === current.arrangementId && h.mode === current.mode && h.rate === current.rate && h.inputSource === 'microphone' && (h.cueLevel ?? 'full') === current.cueLevel);
  const last2 = same.slice(0, 2);
  if (last2.length < 2) return null;
  if (last2.some((h) => (h.stats.coverage ?? 0) < 0.7)) {
    return { kind: 'setup', text: 'Many notes could not be assessed in your last phrases. Check the microphone in Setup before changing difficulty.' };
  }
  const acc = last2.map((h) => h.stats.pitch.accuracy ?? 0);
  const idx = RATES.indexOf(current.rate as (typeof RATES)[number]);
  if (acc.every((a) => a >= 0.8)) {
    if (current.mode === 'wait') return { kind: 'try-fixed', text: 'Two strong phrases in a row. Try fixed-tempo mode next — the music keeps going.' };
    if (idx >= 0 && idx < RATES.length - 1) {
      const next = RATES[idx + 1] as 0.75 | 1;
      return { kind: 'faster', rate: next, text: `Two strong phrases in a row (≥80 %). Ready to try ${Math.round(next * 100)} %?` };
    }
    if (current.cueLevel === 'full') return { kind: 'fewer-cues', text: 'Two strong phrases at full tempo. Try it with fewer cues (recall).' };
    return null;
  }
  if (acc.every((a) => a < 0.6)) {
    if (idx > 0) {
      const prev = RATES[idx - 1] as 0.5 | 0.75;
      return { kind: 'slower', rate: prev, text: `This passage is tricky at this speed. Try ${Math.round(prev * 100)} % — slower practice is real practice.` };
    }
    if (!current.loop) return { kind: 'smaller-loop', text: 'Try looping just the first bar until it feels easy, then add the next.' };
  }
  return null;
}
