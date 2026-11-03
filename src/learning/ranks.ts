/**
 * Fun ranks along the learning path. A rank is reached when enough lessons are
 * complete (`minLessons`) AND every lesson of its signature chapter(s) is
 * complete. The lesson count is forgiving on purpose: skipping one early lesson
 * never blocks later ranks. Ranks are motivational labels, not assessments —
 * they count completed lessons whatever the evidence (sensor or self-check).
 */
import { CHAPTER_ORDER, CHAPTERS } from './chapters';

export interface Rank {
  id: string;
  title: string;
  /** A joke, shown under the title. Never instructions. */
  blurb: string;
  /** Completed lessons needed (only lessons in the path count). */
  minLessons: number;
  /** Chapters whose lessons must all be complete. */
  requiredChapterIds?: string[];
}

const ALL_LESSONS = CHAPTER_ORDER.length;

export const RANKS: readonly Rank[] = [
  {
    id: 'rank.air-guitar',
    title: 'Air Guitar Apprentice',
    blurb: 'You own a guitar-shaped object and the confidence of a lead singer. Both are a start.',
    minLessons: 0,
  },
  {
    id: 'rank.string-poker',
    title: 'Professional String Poker',
    blurb: 'You have made sounds on purpose. The neighbours have noticed. Nobody has complained. Yet.',
    minLessons: 2,
  },
  {
    id: 'rank.bedroom-rock-star',
    title: 'Bedroom Rock Star (Bedroom Only)',
    blurb: 'You can hold the thing, count to four and find string 1. Wardrobe-mirror world tour: confirmed.',
    minLessons: 4,
    requiredChapterIds: ['ch.getting-started'],
  },
  {
    id: 'rank.morning-steps',
    title: 'Morning Steps Survivor',
    blurb: 'A whole piece, from memory. Wandering minstrels of old would nod at you. Slightly.',
    minLessons: 9,
    requiredChapterIds: ['ch.first-piece'],
  },
  {
    id: 'rank.campfire-menace',
    title: 'Campfire Menace',
    blurb: 'Five chords and a dream. Marshmallows everywhere are no longer safe.',
    minLessons: 15,
    requiredChapterIds: ['ch.open-chords-1'],
  },
  {
    id: 'rank.strum-lord',
    title: 'Strum Lord of the Living Room',
    blurb: 'Your strumming hand has developed opinions. Mostly good ones.',
    minLessons: 20,
    requiredChapterIds: ['ch.strumming'],
  },
  {
    id: 'rank.three-chord-bandit',
    title: 'Three-Chord Bandit',
    blurb: 'Armed with I, IV and V, you could hold up a thousand songs. Please write your own instead.',
    minLessons: 29,
    requiredChapterIds: ['ch.songs'],
  },
  {
    id: 'rank.garage-goblin',
    title: 'Garage Riff Goblin',
    blurb: 'Power chords, palm mutes and a riff. Your garage now has a reputation.',
    minLessons: 35,
    requiredChapterIds: ['ch.riffs-power'],
  },
  {
    id: 'rank.blues-apprentice',
    title: 'Blues Apprentice (Imaginary Problems Edition)',
    blurb: 'Twelve bars, five notes. Your lukewarm coffee is now officially “the blues”.',
    minLessons: 39,
    requiredChapterIds: ['ch.blues'],
  },
  {
    id: 'rank.bend-merchant',
    title: 'Bend Merchant',
    blurb: 'Hammer-ons, pull-offs, slides and bends. The strings fear and respect you.',
    minLessons: 44,
    requiredChapterIds: ['ch.lead'],
  },
  {
    id: 'rank.barre-brawler',
    title: 'Barre Brawler',
    blurb: 'You fought the F chord and the F chord lost. Eventually. After several rounds.',
    minLessons: 49,
    requiredChapterIds: ['ch.barre'],
  },
  {
    id: 'rank.fretboard-navigator',
    title: 'Fretboard Navigator',
    blurb: 'You know where the notes live and why chords hang out together. Theory nerds wave at you now.',
    minLessons: 52,
    requiredChapterIds: ['ch.theory'],
  },
  {
    id: 'rank.knockoff-hero',
    title: 'Knockoff Hero',
    blurb: 'Thumb over the neck, fills between the chords, bends with attitude. Legally distinct from any legend.',
    minLessons: 59,
    requiredChapterIds: ['ch.knockoff-hero'],
  },
  {
    id: 'rank.bootleg-legend',
    title: 'Bootleg Legend, Discount Guitar God',
    blurb: 'Every lesson, every boss. Not technically a god. But the discount is very convincing.',
    minLessons: ALL_LESSONS,
    requiredChapterIds: CHAPTERS.map((c) => c.id),
  },
];

const KNOWN: ReadonlySet<string> = new Set(CHAPTER_ORDER);

function countKnown(completed: ReadonlySet<string>): number {
  let n = 0;
  for (const id of completed) if (KNOWN.has(id)) n++;
  return n;
}

function chapterLessonIds(rank: Rank): string[] {
  return (rank.requiredChapterIds ?? []).flatMap((id) => CHAPTERS.find((c) => c.id === id)?.ids ?? []);
}

/** Has this rank's requirement been met? */
export function rankReached(rank: Rank, completed: ReadonlySet<string>): boolean {
  return countKnown(completed) >= rank.minLessons && chapterLessonIds(rank).every((id) => completed.has(id));
}

/** The highest rank reached for a set of completed lesson IDs. */
export function rankFor(completed: ReadonlySet<string>): Rank {
  for (let i = RANKS.length - 1; i > 0; i--) if (rankReached(RANKS[i]!, completed)) return RANKS[i]!;
  return RANKS[0]!;
}

export interface NextRank {
  rank: Rank;
  /** 0…1 progress from the current rank towards this one (lesson count and chapter lessons, whichever is behind). */
  progress: number;
  /** More completed lessons needed for the lesson-count part. */
  lessonsNeeded: number;
  /** Lessons of the required chapter(s) not completed yet, in path order. */
  missingLessonIds: string[];
}

/** The rank after the current one, with progress towards it; null at the top rank. */
export function nextRank(completed: ReadonlySet<string>): NextRank | null {
  const current = rankFor(completed);
  const next = RANKS[RANKS.indexOf(current) + 1];
  if (!next) return null;
  const count = countKnown(completed);
  const span = next.minLessons - current.minLessons;
  const lessonPart = span <= 0 ? 1 : Math.min(1, Math.max(0, (count - current.minLessons) / span));
  const required = chapterLessonIds(next);
  const missingLessonIds = CHAPTER_ORDER.filter((id) => required.includes(id) && !completed.has(id));
  const chapterPart = required.length ? (required.length - missingLessonIds.length) / required.length : 1;
  return {
    rank: next,
    progress: Math.min(lessonPart, chapterPart),
    lessonsNeeded: Math.max(0, next.minLessons - count),
    missingLessonIds,
  };
}
