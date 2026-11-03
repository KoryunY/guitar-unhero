/**
 * The learning path, chapter by chapter. This list is the single source of
 * lesson order: `LESSONS` (src/learning/lessons.ts) follows it and links each
 * lesson's `nextLessonId` to the one after it. Pure data — no imports.
 */

export type ChapterTier = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'hero';

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  tier: ChapterTier;
  ids: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch.getting-started',
    title: 'Getting started',
    subtitle: 'Meet the guitar, make a sound, find the beat.',
    emoji: '🎸',
    tier: 'beginner',
    ids: ['lesson.meet-guitar.v1', 'lesson.high-e.first-sound.v1', 'lesson.pulse.v1', 'lesson.your-hands.v1'],
  },
  {
    id: 'ch.first-piece',
    title: 'Your first piece',
    subtitle: 'Fretted notes, crossing strings and a whole tune — from memory.',
    emoji: '🌅',
    tier: 'beginner',
    ids: ['lesson.high-e.first-frets.v1', 'lesson.b-string.first-frets.v1', 'lesson.crossing.v1', 'lesson.long-notes.v1', 'lesson.first-piece.v1', 'lesson.chunks-memory.v1'],
  },
  {
    id: 'ch.open-chords-1',
    title: 'Open chords I',
    subtitle: 'Em, Am, E, A and D — checked one string at a time.',
    emoji: '✋',
    tier: 'beginner',
    ids: ['lesson.open-strings.v1', 'lesson.em-chord.v1', 'lesson.am-chord.v1', 'lesson.listen-remember.v1', 'lesson.e-major.v1', 'lesson.a-major.v1', 'lesson.d-major.v1'],
  },
  {
    id: 'ch.strumming',
    title: 'Strumming basics',
    subtitle: 'Down strums, down-up, real patterns and faster changes.',
    emoji: '🥁',
    tier: 'beginner',
    ids: ['lesson.strum-downs.v1', 'lesson.strum-down-up.v1', 'lesson.strum-patterns.v1', 'lesson.one-minute-changes.v1', 'lesson.boss-chord-stomp.v1'],
  },
  {
    id: 'ch.open-chords-2',
    title: 'Open chords II',
    subtitle: 'G, C, Dm, sevenths and sus chords.',
    emoji: '🔑',
    tier: 'improver',
    ids: ['lesson.g-major.v1', 'lesson.c-major.v1', 'lesson.d-minor.v1', 'lesson.seventh-chords.v1', 'lesson.sus-chords.v1'],
  },
  {
    id: 'ch.songs',
    title: 'Songs in chords',
    subtitle: 'Chord families, the capo, and fingerpicking.',
    emoji: '🔥',
    tier: 'improver',
    ids: ['lesson.three-chord-trick.v1', 'lesson.four-chord-loop.v1', 'lesson.capo.v1', 'lesson.fingerpicking.v1', 'lesson.travis-picking.v1', 'lesson.boss-campfire.v1'],
  },
  {
    id: 'ch.riffs-power',
    title: 'Riffs & power chords',
    subtitle: 'Low-string riffs, power chords, palm muting and drop D.',
    emoji: '⚡',
    tier: 'improver',
    ids: ['lesson.low-strings.v1', 'lesson.first-riff.v1', 'lesson.power-chords.v1', 'lesson.palm-muting.v1', 'lesson.drop-d.v1', 'lesson.boss-garage-riff.v1'],
  },
  {
    id: 'ch.blues',
    title: 'Pentatonic & blues',
    subtitle: 'Box 1, the 12-bar shuffle and your first licks.',
    emoji: '💙',
    tier: 'intermediate',
    ids: ['lesson.pentatonic-box1.v1', 'lesson.twelve-bar.v1', 'lesson.blues-licks.v1', 'lesson.boss-blues.v1'],
  },
  {
    id: 'ch.lead',
    title: 'Lead techniques',
    subtitle: 'Hammer-ons, pull-offs, slides, bends, vibrato and double stops.',
    emoji: '✨',
    tier: 'intermediate',
    ids: ['lesson.hammer-ons.v1', 'lesson.pull-offs.v1', 'lesson.slides.v1', 'lesson.bends.v1', 'lesson.vibrato.v1', 'lesson.double-stops.v1'],
  },
  {
    id: 'ch.barre',
    title: 'Barre chords',
    subtitle: 'Find the notes, beat the F chord, then move shapes anywhere.',
    emoji: '🏋️',
    tier: 'advanced',
    ids: ['lesson.fretboard-notes.v1', 'lesson.mini-f.v1', 'lesson.boss-f-chord.v1', 'lesson.e-shape-barre.v1', 'lesson.a-shape-barre.v1'],
  },
  {
    id: 'ch.theory',
    title: 'Theory you’ll actually use',
    subtitle: 'Intervals, the major scale, keys, chord tones and CAGED.',
    emoji: '🧠',
    tier: 'advanced',
    ids: ['lesson.intervals.v1', 'lesson.major-scale.v1', 'lesson.keys-chord-tones.v1', 'lesson.caged.v1'],
  },
  {
    id: 'ch.knockoff-hero',
    title: 'Knockoff Hero',
    subtitle: 'Thumb-over bass, chord fills, octaves, the 7♯9 and a bootleg legend etude.',
    emoji: '🟣',
    tier: 'hero',
    ids: ['lesson.thumb-over.v1', 'lesson.chord-fills.v1', 'lesson.double-stop-fills.v1', 'lesson.octaves.v1', 'lesson.seven-sharp-nine.v1', 'lesson.expressive-bends.v1', 'lesson.boss-bootleg-legend.v1'],
  },
  {
    id: 'ch.metal',
    title: 'Metal level',
    subtitle: 'Chugs, gallops, alternate picking, drop D and the final boss.',
    emoji: '🤘',
    tier: 'hero',
    ids: ['lesson.chugs.v1', 'lesson.gallop.v1', 'lesson.alternate-picking.v1', 'lesson.drop-d-riffs.v1', 'lesson.boss-metal.v1'],
  },
];

/** Every lesson ID in path order. */
export const CHAPTER_ORDER: readonly string[] = CHAPTERS.flatMap((c) => c.ids);

/** Review lessons that mix a chapter's skills (fire the `boss_fight` voice event when one starts). */
export const BOSS_FIGHT_IDS: ReadonlySet<string> = new Set([
  'lesson.boss-chord-stomp.v1',
  'lesson.boss-campfire.v1',
  'lesson.boss-garage-riff.v1',
  'lesson.boss-blues.v1',
  'lesson.boss-f-chord.v1',
  'lesson.boss-bootleg-legend.v1',
  'lesson.boss-metal.v1',
]);

export function isBossFight(lessonId: string): boolean {
  return BOSS_FIGHT_IDS.has(lessonId);
}

/** The chapter whose unlocking fires the `metal_unlocked` voice event. */
export const METAL_CHAPTER_ID = 'ch.metal';

export function findChapter(chapterId: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === chapterId);
}

export function chapterOf(lessonId: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.ids.includes(lessonId));
}

/** Completed / total lessons in a chapter. */
export function chapterProgress(chapter: Chapter, completed: ReadonlySet<string>): { done: number; total: number; complete: boolean } {
  const done = chapter.ids.filter((id) => completed.has(id)).length;
  return { done, total: chapter.ids.length, complete: done === chapter.ids.length };
}
