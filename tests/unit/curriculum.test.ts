import { describe, expect, it } from 'vitest';
import { BUNDLED_SCORES, findBundledScore } from '../../src/content/scores';
import { validateScore } from '../../src/domain/validate';
import { openMidi } from '../../src/domain/tuning';
import type { StringNumber } from '../../src/domain/score';
import { BOSS_FIGHT_IDS, CHAPTER_ORDER, CHAPTERS, chapterOf, chapterProgress, findChapter, isBossFight, METAL_CHAPTER_ID } from '../../src/learning/chapters';
import { CHORD_SHAPES, E7_SHARP9, EM } from '../../src/learning/curriculum/chords';
import { BAR, tabFrom } from '../../src/learning/curriculum/core';
import { chordDiagram, chordSymbol, chordTargets, findLesson, KNOWN_LESSON_IDS, LESSONS, type ChordShape, type LessonStep } from '../../src/learning/lessons';
import { nextRank, rankFor, rankReached, RANKS } from '../../src/learning/ranks';
import { VOICE_EVENTS, VOICE_STYLES, voiceLine, voiceLines, type VoiceEvent } from '../../src/learning/voice';

const ORIGINAL_14 = [
  'lesson.meet-guitar.v1', 'lesson.high-e.first-sound.v1', 'lesson.pulse.v1', 'lesson.your-hands.v1', 'lesson.high-e.first-frets.v1',
  'lesson.b-string.first-frets.v1', 'lesson.crossing.v1', 'lesson.long-notes.v1', 'lesson.first-piece.v1', 'lesson.chunks-memory.v1',
  'lesson.open-strings.v1', 'lesson.em-chord.v1', 'lesson.am-chord.v1', 'lesson.listen-remember.v1',
];
/** Skills that come from setup rather than a lesson. */
const SETUP_SKILLS = new Set(['skill.tuning.broad']);

const allSteps = (): { lessonId: string; step: LessonStep }[] => LESSONS.flatMap((l) => l.steps.map((step) => ({ lessonId: l.lessonId, step })));

// ---------- an independent chord-symbol parser for the chord-tone check ----------
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7#9': [0, 4, 7, 10, 3],
};
function pcOf(note: string): number {
  const base = LETTER_PC[note[0]!]!;
  const acc = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0;
  return (base + acc + 12) % 12;
}
function parseChord(symbol: string): { root: number; bass: number; tones: Set<number> } {
  const m = /^([A-G][#b]?)(maj7|m7|m|7#9|7|5|6|sus2|sus4|)(?:\/([A-G][#b]?))?$/.exec(symbol);
  if (!m) throw new Error(`Unparseable chord symbol "${symbol}"`);
  const root = pcOf(m[1]!);
  const tones = new Set(QUALITY[m[2]!]!.map((i) => (root + i) % 12));
  const bass = m[3] ? pcOf(m[3]) : root;
  tones.add(bass);
  return { root, bass, tones };
}

function checkShape(shape: ChordShape): void {
  expect(shape.lowToHigh, shape.name).toHaveLength(6);
  expect(shape.fingersLowToHigh, shape.name).toHaveLength(6);
  shape.lowToHigh.forEach((f, i) => {
    if (f === 'x' || f === 0) expect(shape.fingersLowToHigh[i], `${shape.name}: open/x strings take no finger`).toBeNull();
  });
  const { root, bass, tones } = parseChord(chordSymbol(shape));
  const sounding = chordTargets(shape).map((t) => t.targetMidi);
  expect(sounding.length, shape.name).toBeGreaterThanOrEqual(2);
  for (const midi of sounding) expect(tones.has(midi % 12), `${shape.name}: MIDI ${midi} is not a chord tone`).toBe(true);
  expect(Math.min(...sounding) % 12, `${shape.name}: lowest note should be the bass`).toBe(bass);
  expect(sounding.some((m) => m % 12 === root), `${shape.name}: root sounds`).toBe(true);
}

describe('curriculum structure', () => {
  it('has 10–13 chapters and ~55–70 lessons, keeping all 14 original lessons', () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(10);
    expect(CHAPTERS.length).toBeLessThanOrEqual(13);
    expect(LESSONS.length).toBeGreaterThanOrEqual(55);
    expect(LESSONS.length).toBeLessThanOrEqual(70);
    for (const id of ORIGINAL_14) expect(findLesson(id), id).toBeDefined();
  });

  it('uses unique lesson, skill and step IDs', () => {
    const ids = LESSONS.map((l) => l.lessonId);
    expect(new Set(ids).size).toBe(ids.length);
    const skills = LESSONS.map((l) => l.skillId);
    expect(new Set(skills).size).toBe(skills.length);
    for (const l of LESSONS) {
      const stepIds = l.steps.map((s) => s.id);
      expect(new Set(stepIds).size, l.lessonId).toBe(stepIds.length);
    }
    expect(KNOWN_LESSON_IDS.size).toBe(LESSONS.length);
  });

  it('every chapter lists only existing lessons and every lesson is in exactly one chapter, in path order', () => {
    const chapterIds = CHAPTERS.map((c) => c.id);
    expect(new Set(chapterIds).size).toBe(chapterIds.length);
    for (const c of CHAPTERS) {
      expect(c.ids.length, c.id).toBeGreaterThan(0);
      expect(c.title && c.subtitle && c.emoji, c.id).toBeTruthy();
      for (const id of c.ids) expect(findLesson(id), `${c.id} → ${id}`).toBeDefined();
    }
    for (const l of LESSONS) expect(CHAPTERS.filter((c) => c.ids.includes(l.lessonId)), l.lessonId).toHaveLength(1);
    expect(CHAPTER_ORDER).toEqual(LESSONS.map((l) => l.lessonId));
    const tiers = ['beginner', 'improver', 'intermediate', 'advanced', 'hero'];
    const tierIdx = CHAPTERS.map((c) => tiers.indexOf(c.tier));
    expect(tierIdx.every((t) => t >= 0)).toBe(true);
    expect([...tierIdx].sort((a, b) => a - b)).toEqual(tierIdx);
  });

  it('chains nextLessonId through the whole path and prerequisites point to skills taught earlier', () => {
    LESSONS.forEach((l, i) => expect(l.nextLessonId, l.lessonId).toBe(LESSONS[i + 1]?.lessonId ?? null));
    const taughtAt = new Map(LESSONS.map((l, i) => [l.skillId, i]));
    LESSONS.forEach((l, i) => {
      for (const p of l.prerequisiteSkillIds) {
        if (SETUP_SKILLS.has(p)) continue;
        expect(taughtAt.has(p), `${l.lessonId}: unknown prerequisite ${p}`).toBe(true);
        expect(taughtAt.get(p)!, `${l.lessonId}: prerequisite ${p} comes later`).toBeLessThan(i);
      }
    });
  });

  it('every lesson is complete, honest about review, and ends with a choice', () => {
    for (const l of LESSONS) {
      expect(l.reviewStatus, l.lessonId).toBe('unreviewed');
      expect(l.teacherReviewer).toBeNull();
      expect(l.learningObjective.length, l.lessonId).toBeGreaterThan(20);
      expect(l.successRule.length, l.lessonId).toBeGreaterThan(5);
      expect(l.selfCheck.length, l.lessonId).toBeGreaterThan(5);
      expect(l.fallbacks.length, l.lessonId).toBeGreaterThan(0);
      expect(l.equipment.length, l.lessonId).toBeGreaterThan(0);
      expect(l.steps.length, l.lessonId).toBeGreaterThanOrEqual(3);
      expect(l.steps.length, l.lessonId).toBeLessThanOrEqual(10);
      expect(l.steps.at(-1)!.kind, l.lessonId).toBe('choice');
      for (const s of l.steps) expect(s.body.length, `${l.lessonId}/${s.id}: instructions live in the body`).toBeGreaterThan(0);
    }
  });

  it('boss fights exist, are lessons, and say so in the title', () => {
    expect(BOSS_FIGHT_IDS.size).toBeGreaterThanOrEqual(5);
    for (const id of BOSS_FIGHT_IDS) {
      expect(findLesson(id), id).toBeDefined();
      expect(findLesson(id)!.title).toMatch(/^(Boss fight|Final boss)/);
      expect(isBossFight(id)).toBe(true);
      // Boss fights include recall: a cue-reduced practice or a quiz.
      expect(findLesson(id)!.steps.some((s) => s.practice?.cueLevel === 'reduced' || s.practice?.cueLevel === 'none' || s.kind === 'quiz' || s.kind === 'sequence'), id).toBe(true);
    }
    expect(findChapter(METAL_CHAPTER_ID)).toBeDefined();
    expect(chapterOf('lesson.em-chord.v1')?.id).toBe('ch.open-chords-1');
    expect(chapterProgress(CHAPTERS[0]!, new Set(CHAPTERS[0]!.ids))).toEqual({ done: CHAPTERS[0]!.ids.length, total: CHAPTERS[0]!.ids.length, complete: true });
  });
});

describe('scores used by lessons', () => {
  it('every scoreRef resolves to a bundled, valid, original, practisable score', () => {
    const refs = new Set<string>();
    for (const l of LESSONS) {
      if (l.scoreRef) refs.add(l.scoreRef);
      for (const s of l.steps) if (s.scoreRef) refs.add(s.scoreRef);
      for (const s of l.steps) if (s.kind === 'practice') expect(s.scoreRef, `${l.lessonId}/${s.id}`).toBeTruthy();
    }
    for (const ref of refs) {
      const score = findBundledScore(ref);
      expect(score, ref).toBeDefined();
      const r = validateScore(JSON.parse(JSON.stringify(score)));
      expect(r.issues, ref).toEqual([]);
      expect(score!.role).toBe('original_exercise');
      expect(score!.rights.status).toBe('user_declared');
      expect(score!.rights.allowedUses).toContain('local_practice');
      expect(score!.tempoMap).toHaveLength(1);
    }
    // No orphan bundled scores.
    for (const s of BUNDLED_SCORES) expect(refs.has(s.arrangementId), `${s.arrangementId} is not used by any lesson`).toBe(true);
  });

  it('wait mode is never used on scores with unassessed (legato) notes, and loops stay inside the score', () => {
    for (const { lessonId, step } of allSteps()) {
      if (step.kind !== 'practice' || !step.scoreRef) continue;
      const score = findBundledScore(step.scoreRef)!;
      if (step.practice?.mode === 'wait') expect(score.events.every((e) => e.assessment.pitch), `${lessonId}/${step.id}`).toBe(true);
      const loop = step.practice?.loop;
      if (loop) {
        expect(loop.aTick % BAR).toBe(0);
        expect(loop.bTick % BAR).toBe(0);
        expect(loop.aTick).toBeLessThan(loop.bTick);
        expect(loop.bTick, `${lessonId}/${step.id}`).toBeLessThanOrEqual(score.durationTicks);
      }
    }
  });
});

describe('chords and targets', () => {
  it('every chord shape sounds only chord tones of its named chord, with the right bass note', () => {
    for (const shape of CHORD_SHAPES) checkShape(shape);
  });

  it('every shape used in a lesson is in the checked dictionary', () => {
    const known = new Set(CHORD_SHAPES);
    for (const { lessonId, step } of allSteps()) {
      for (const sh of step.strum?.shapes ?? []) expect(known.has(sh), `${lessonId}/${step.id}: ${sh.name}`).toBe(true);
    }
  });

  it('every attempt and sequence target pitch matches its string and fret (standard tuning)', () => {
    let n = 0;
    for (const { lessonId, step } of allSteps()) {
      const targets = [...(step.attempt ? [step.attempt] : []), ...(step.sequence?.targets ?? [])];
      if (step.kind === 'attempt') expect(step.attempt, `${lessonId}/${step.id}`).toBeDefined();
      if (step.kind === 'sequence') expect(step.sequence?.targets.length, `${lessonId}/${step.id}`).toBeGreaterThan(0);
      for (const t of targets) {
        n++;
        expect(t.targetMidi, `${lessonId}/${step.id}`).toBe(openMidi(t.string as StringNumber) + t.fret);
        if (t.fret === 0) expect(t.finger).toBeNull();
        expect(t.required).toBeGreaterThanOrEqual(1);
        expect(t.fret).toBeLessThanOrEqual(22);
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('strum-along steps name only listed shapes and use valid patterns', () => {
    for (const { lessonId, step } of allSteps()) {
      if (step.kind !== 'strum-along') continue;
      const strum = step.strum!;
      expect(strum.bars.length).toBeGreaterThan(0);
      for (const b of strum.bars) expect(strum.shapes.some((sh) => sh.name.includes(`(${b})`)), `${lessonId}/${step.id}: ${b}`).toBe(true);
      if (strum.pattern !== undefined) expect(strum.pattern, `${lessonId}/${step.id}`).toMatch(/^[DUx-]{8}$/);
      expect(strum.bpm).toBeGreaterThanOrEqual(40);
      expect(strum.bpm).toBeLessThanOrEqual(160);
    }
  });
});

describe('assessment honesty in lesson data', () => {
  const DEMO_ONLY = new Set(['bend', 'slide', 'hammer_on', 'pull_off', 'vibrato', 'palm_mute', 'double_stop', 'octaves']);

  it('techniques are demonstrated and self-checked, never assessed', () => {
    let n = 0;
    for (const { lessonId, step } of allSteps()) {
      if (!step.technique) continue;
      n++;
      if (DEMO_ONLY.has(step.technique.kind)) expect(['info', 'demo', 'strum-along'], `${lessonId}/${step.id}`).toContain(step.kind);
      if (step.technique.semitones !== undefined) {
        expect(step.technique.kind).toBe('bend');
        expect(step.technique.toFret! - step.technique.fromFret!).toBe(step.technique.semitones);
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it('in lessons with bends, attempts are plain fretted reference notes and say what is checked', () => {
    let n = 0;
    for (const l of LESSONS) {
      if (!l.steps.some((s) => s.technique?.kind === 'bend')) continue;
      for (const s of l.steps.filter((x) => x.kind === 'attempt')) {
        n++;
        expect(s.technique?.kind, `${l.lessonId}/${s.id}`).not.toBe('bend');
        expect(s.body.join(' '), `${l.lessonId}/${s.id}`).toMatch(/plain.*check|check.*plain|I check/i);
      }
    }
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('drop-D steps contain no assessed targets and are followed by a return to standard tuning', () => {
    for (const l of LESSONS) {
      const idx = l.steps.map((s, i) => (s.tuning === 'drop-d' ? i : -1)).filter((i) => i >= 0);
      for (const i of idx) {
        const s = l.steps[i]!;
        expect(['info', 'demo'], `${l.lessonId}/${s.id}`).toContain(s.kind);
        expect(s.attempt ?? s.sequence ?? s.scoreRef).toBeUndefined();
      }
      if (idx.length) {
        const after = l.steps.slice(Math.max(...idx) + 1).filter((s) => s.kind !== 'choice');
        expect(after.some((s) => /standard/i.test(s.body.join(' '))), `${l.lessonId}: retune reminder`).toBe(true);
        expect(l.supportedAssessments, l.lessonId).toEqual([]);
      }
    }
  });

  it('strum-along chord steps say they are not assessed', () => {
    for (const l of LESSONS) {
      if (!l.steps.some((s) => s.kind === 'strum-along')) continue;
      expect(/not assessed|not checked|not scored/i.test(JSON.stringify(l.steps)), l.lessonId).toBe(true);
    }
  });

  it('quizzes, ear steps, pulse steps and demos are well formed', () => {
    for (const { lessonId, step } of allSteps()) {
      if (step.kind === 'quiz') {
        expect(step.quiz!.options[step.quiz!.answer], `${lessonId}/${step.id}`).toBeDefined();
        expect(new Set(step.quiz!.options).size).toBe(step.quiz!.options.length);
      }
      if (step.kind === 'ear-compare') expect(step.ear!.pool.length).toBeGreaterThan(1);
      if (step.kind === 'tap-pulse') expect(step.pulse!.beats).toBeGreaterThan(3);
      for (const m of step.demoMidis ?? []) {
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(36);
        expect(m).toBeLessThanOrEqual(90);
      }
    }
  });

  it('every diagram dot fits a five-fret window (from the nut, or from baseFret)', () => {
    const diagrams = [
      ...allSteps().flatMap(({ lessonId, step }) => (step.diagram ? [{ where: `${lessonId}/${step.id}`, d: step.diagram }] : [])),
      ...CHORD_SHAPES.map((sh) => ({ where: sh.name, d: chordDiagram(sh) })),
    ];
    for (const { where, d } of diagrams) {
      const lo = d.baseFret ?? 1;
      for (const dot of [...(d.dots ?? []), ...(d.dot ? [d.dot] : [])]) {
        expect(dot.fret, where).toBeGreaterThanOrEqual(lo);
        expect(dot.fret, where).toBeLessThanOrEqual(lo + 4);
      }
    }
    expect(chordDiagram(EM).baseFret).toBeUndefined();
    expect(chordDiagram(E7_SHARP9).baseFret).toBe(6);
  });

  it('ASCII tabs are aligned, six strings, phone-width', () => {
    let n = 0;
    for (const { lessonId, step } of allSteps()) {
      if (!step.tab) continue;
      n++;
      expect(step.tab, `${lessonId}/${step.id}`).toHaveLength(6);
      const len = step.tab[0]!.length;
      for (const line of step.tab) {
        expect(line.length, `${lessonId}/${step.id}`).toBe(len);
        expect(line).toMatch(/^[eBGDAE]\|-.*\|$/);
      }
      expect(len).toBeLessThanOrEqual(36);
    }
    expect(n).toBeGreaterThan(5);
    expect(tabFrom([{ 3: '5h7' }], 'D')[5]).toBe('D|-----|');
  });

  it('keeps the safety basics: rest/pain reminders in every chapter, volume advice for electric chapters, never “push through”', () => {
    for (const c of CHAPTERS) {
      const text = JSON.stringify(c.ids.map((id) => findLesson(id)!.steps));
      expect(/rest|hurt|pain|break/i.test(text), c.id).toBe(true);
    }
    for (const id of ['ch.riffs-power', 'ch.metal']) {
      const text = JSON.stringify(findChapter(id)!.ids.map((x) => findLesson(x)!.steps));
      expect(text, id).toContain('comfortable level');
    }
    const all = JSON.stringify(LESSONS);
    for (const m of all.matchAll(/push through/gi)) expect(all.slice(Math.max(0, m.index! - 12), m.index!)).toMatch(/not\s*$/);
  });
});

describe('humor voice', () => {
  it('every event has at least six lines in funny and metal, and plain is always null', () => {
    const exhaustive: Record<VoiceEvent, true> = {
      first_launch: true, welcome_back: true, lesson_start: true, lesson_complete: true, step_correct: true, step_wrong: true,
      streak_3: true, streak_10: true, uncertain: true, mic_off: true, tuner_in_tune: true, tuner_far: true, tuner_start: true,
      practice_great: true, practice_ok: true, practice_rough: true, rank_up: true, chapter_complete: true, boss_fight: true,
      rest_break: true, empty_songs: true, song_imported: true, chord_change: true, metal_unlocked: true, sore_fingers: true,
    };
    expect([...VOICE_EVENTS].sort()).toEqual(Object.keys(exhaustive).sort());
    for (const e of VOICE_EVENTS) {
      for (const style of ['funny', 'metal'] as const) {
        const lines = voiceLines(e, style);
        expect(lines.length, `${e}/${style}`).toBeGreaterThanOrEqual(6);
        expect(new Set(lines).size, `${e}/${style}: duplicates`).toBe(lines.length);
        for (const line of lines) expect(line.trim().length).toBeGreaterThan(3);
        expect(lines).toContain(voiceLine(e, style, 3));
        expect(voiceLine(e, style, 2)).toBe(voiceLine(e, style, 2 + lines.length));
      }
      expect(voiceLine(e, 'plain')).toBeNull();
      expect(voiceLine(e, 'plain', 1)).toBeNull();
      expect(voiceLines(e, 'plain')).toEqual([]);
    }
    expect(VOICE_STYLES.map((s) => s.id)).toEqual(['plain', 'funny', 'metal']);
  });

  it('roasts the guitar, never the learner', () => {
    const all = VOICE_EVENTS.flatMap((e) => [...voiceLines(e, 'funny'), ...voiceLines(e, 'metal')]).join('\n');
    expect(all).not.toMatch(/\b(you suck|idiot|stupid|loser|dumb|useless|pathetic)\b/i);
    // Metal has its ALL-CAPS bursts.
    const metal = VOICE_EVENTS.flatMap((e) => voiceLines(e, 'metal'));
    expect(metal.filter((l) => /\b[A-Z]{4,}\b/.test(l)).length).toBeGreaterThan(metal.length / 2);
  });
});

describe('ranks', () => {
  const all = new Set(LESSONS.map((l) => l.lessonId));

  it('are ordered, unique and refer to real chapters', () => {
    expect(RANKS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(RANKS.map((r) => r.id)).size).toBe(RANKS.length);
    let lastMin = -1;
    let lastChapter = -1;
    for (const r of RANKS) {
      expect(r.minLessons, r.id).toBeGreaterThanOrEqual(lastMin);
      lastMin = r.minLessons;
      expect(r.blurb.length).toBeGreaterThan(10);
      const idx = Math.max(-1, ...(r.requiredChapterIds ?? []).map((id) => CHAPTERS.findIndex((c) => c.id === id)));
      for (const id of r.requiredChapterIds ?? []) expect(findChapter(id), `${r.id} → ${id}`).toBeDefined();
      expect(idx, r.id).toBeGreaterThanOrEqual(lastChapter);
      lastChapter = idx;
    }
    expect(RANKS[0]!.minLessons).toBe(0);
    expect(RANKS.at(-1)!.minLessons).toBe(LESSONS.length);
  });

  it('rankFor works at zero and at all lessons, and nextRank reports progress', () => {
    expect(rankFor(new Set())).toBe(RANKS[0]);
    expect(rankFor(all)).toBe(RANKS.at(-1));
    expect(nextRank(all)).toBeNull();
    const first = nextRank(new Set())!;
    expect(first.rank).toBe(RANKS[1]);
    expect(first.progress).toBe(0);
    expect(first.lessonsNeeded).toBe(RANKS[1]!.minLessons);
    // Unknown lesson IDs never count.
    expect(rankFor(new Set(['lesson.made-up', 'lesson.also-made-up', 'x', 'y', 'z']))).toBe(RANKS[0]);
  });

  it('climbs monotonically through every rank when lessons are completed in path order', () => {
    const done = new Set<string>();
    let last = 0;
    const seen = new Set<string>([rankFor(done).id]);
    for (const id of CHAPTER_ORDER) {
      done.add(id);
      const r = rankFor(done);
      const i = RANKS.indexOf(r);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
      seen.add(r.id);
      const nx = nextRank(done);
      if (nx) {
        expect(nx.progress).toBeGreaterThanOrEqual(0);
        expect(nx.progress).toBeLessThanOrEqual(1);
      }
    }
    expect(seen.size).toBe(RANKS.length);
    for (const r of RANKS) expect(rankReached(r, all), r.id).toBe(true);
  });

  it('is forgiving: one skipped early lesson does not block a later chapter rank', () => {
    const done = new Set(CHAPTER_ORDER.slice(0, CHAPTER_ORDER.indexOf('lesson.boss-garage-riff.v1') + 1));
    done.delete('lesson.listen-remember.v1');
    expect(rankFor(done).id).toBe('rank.garage-goblin');
  });
});
