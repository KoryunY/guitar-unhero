/**
 * Phrase summary and one deterministic next action (master spec §6.5).
 * pitch accuracy = correct pitch / assessable pitch; coverage = assessable / eligible.
 * A zero denominator is reported as null ("not assessed"), never 0%.
 */
import type { NoteEvent } from '../domain/score';
import { midiName } from '../domain/tuning';
import type { Judgment } from './types';

export type InputSource = 'microphone' | 'simulation' | 'none';

export interface Ratio {
  correct: number;
  assessed: number;
  /** null when assessed === 0. */
  accuracy: number | null;
}

export interface PhraseStats {
  eligible: number;
  assessable: number;
  coverage: number | null;
  pitch: Ratio;
  timing: Ratio & { meanErrorMs: number | null; approximate: boolean; enabled: boolean };
  states: Record<'correct' | 'incorrect' | 'uncertain' | 'not_assessed', number>;
  missed: number;
  wrongPitch: number;
}

export interface Suggestion {
  code: string;
  text: string;
}

function ratio(correct: number, assessed: number): Ratio {
  return { correct, assessed, accuracy: assessed > 0 ? correct / assessed : null };
}

export function computeStats(judgments: readonly Judgment[], opts: { rhythmEnabled: boolean; calibrated: boolean }): PhraseStats {
  const states = { correct: 0, incorrect: 0, uncertain: 0, not_assessed: 0 };
  let pc = 0, pa = 0, tc = 0, ta = 0, assessable = 0, missed = 0, wrongPitch = 0;
  const errs: number[] = [];
  for (const j of judgments) {
    states[j.state]++;
    const pAss = j.pitchState === 'correct' || j.pitchState === 'incorrect';
    const tAss = j.rhythmState === 'correct' || j.rhythmState === 'incorrect';
    if (pAss) { pa++; if (j.pitchState === 'correct') pc++; }
    if (tAss) { ta++; if (j.rhythmState === 'correct') tc++; }
    if (pAss || tAss) assessable++;
    if (j.timingErrorMs !== null) errs.push(j.timingErrorMs);
    if (j.reasonCodes.includes('no_attack_detected')) missed++;
    if (j.reasonCodes.includes('wrong_pitch')) wrongPitch++;
  }
  const eligible = judgments.length;
  return {
    eligible,
    assessable,
    coverage: eligible > 0 ? assessable / eligible : null,
    pitch: ratio(pc, pa),
    timing: {
      ...ratio(tc, ta),
      meanErrorMs: errs.length ? Math.round(errs.reduce((s, x) => s + x, 0) / errs.length) : null,
      approximate: !opts.calibrated,
      enabled: opts.rhythmEnabled,
    },
    states,
    missed,
    wrongPitch,
  };
}

function placeText(ev: NoteEvent): string {
  const where = ev.fret === 0 ? 'played open' : `fret ${ev.fret}${ev.finger ? ` (suggested finger ${ev.finger})` : ''}`;
  return `string ${ev.string}, ${where}`;
}

/** One useful next action, based on the most repeated adequately observed issue. */
export function suggestNext(
  judgments: readonly Judgment[],
  stats: PhraseStats,
  ctx: { inputSource: InputSource; rate: number; events: readonly NoteEvent[]; mode: 'fixed' | 'wait' | 'listen' },
): Suggestion {
  if (ctx.mode === 'listen') return { code: 'listen_only', text: 'That was a listening demo, so nothing was assessed. When you are ready, choose wait mode and play along.' };
  if (ctx.inputSource === 'none') {
    return { code: 'listening_off', text: 'Listening was off, so nothing was assessed. Turn on the microphone in Setup for feedback, or keep practising by ear.' };
  }
  if (stats.eligible > 0 && (stats.coverage ?? 0) < 0.5) {
    return { code: 'setup_check', text: 'I could not assess most notes. Check the input meter in Setup (signal, clipping, background noise), then replay the phrase.' };
  }
  const prefix = ctx.inputSource === 'simulation' ? 'Simulation only — not a real assessment. ' : '';
  const byId = new Map(ctx.events.map((e) => [e.id, e]));

  // Most repeated wrong pitch: group by target + observed nearest note.
  const groups = new Map<string, { n: number; j: Judgment }>();
  for (const j of judgments) {
    if (!j.reasonCodes.includes('wrong_pitch') || j.observedMidi === null) continue;
    const k = `${j.targetEventId}:${Math.round(j.observedMidi)}`;
    const g = groups.get(k);
    if (g) g.n++;
    else groups.set(k, { n: 1, j });
  }
  const topWrong = [...groups.values()].sort((a, b) => b.n - a.n)[0];
  const lateEarly = judgments.filter((j) => j.reasonCodes.includes('late') || j.reasonCodes.includes('early'));
  const late = judgments.filter((j) => j.reasonCodes.includes('late')).length;

  const issues: { code: string; weight: number; text: () => string }[] = [];
  if (topWrong) {
    issues.push({
      code: 'wrong_pitch',
      weight: stats.wrongPitch + 0.5,
      text: () => {
        const ev = byId.get(topWrong.j.targetEventId);
        const heard = midiName(Math.round(topWrong.j.observedMidi!));
        const target = midiName(topWrong.j.targetMidi);
        return `That sounded like ${heard}. The target is ${target}${ev ? ` — ${placeText(ev)}` : ''}. Try that note slowly on its own, then replay the phrase.`;
      },
    });
  }
  if (stats.missed > 0) {
    issues.push({
      code: 'missed',
      weight: stats.missed,
      text: () =>
        ctx.mode === 'wait'
          ? 'Some notes were not heard clearly. Pluck each one once, firmly enough to ring, and let the app wait for you.'
          : 'Some notes were not heard. Try wait mode — it pauses at each note until you play it — or slow down to 50%.',
    });
  }
  if (lateEarly.length > 0 && stats.timing.enabled) {
    const mostlyLate = late >= lateEarly.length / 2;
    issues.push({
      code: mostlyLate ? 'late' : 'early',
      weight: lateEarly.length,
      text: () => {
        const slower = ctx.rate > 0.5 ? ` Try ${ctx.rate === 1 ? '75%' : '50%'} tempo.` : '';
        return mostlyLate
          ? `Your notes tended to arrive late${stats.timing.meanErrorMs !== null ? ` (about ${Math.abs(stats.timing.meanErrorMs)} ms on average)` : ''}. Prepare the next finger during the rest, before the beat.${slower}`
          : `Your notes tended to arrive early. Count along with the clicks and pluck on the beat.${slower}`;
      },
    });
  }
  issues.sort((a, b) => b.weight - a.weight);
  const top = issues[0];
  if (top) return { code: top.code, text: prefix + top.text() };

  if (stats.pitch.accuracy !== null && stats.pitch.accuracy >= 0.8 && (stats.coverage ?? 0) >= 0.7) {
    if (ctx.mode === 'wait') return { code: 'try_fixed', text: `${prefix}Nice work. Next, try fixed-tempo mode at 50% so the music keeps going.` };
    if (ctx.rate < 1) return { code: 'faster', text: `${prefix}Nice work. When it feels comfortable twice in a row, try ${ctx.rate === 0.5 ? '75%' : '100%'} tempo.` };
    return { code: 'well_done', text: `${prefix}Nice work. Try it once more while looking at the guitar instead of the screen.` };
  }
  return { code: 'replay', text: `${prefix}Replay the phrase slowly and focus on one clear pluck per note.` };
}
