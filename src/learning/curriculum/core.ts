/**
 * Curriculum building blocks: lesson/step types, chord-shape helpers and the
 * shared safety wording. `src/learning/lessons.ts` re-exports everything public
 * from here, so existing imports keep working.
 *
 * All lesson text is unreviewed draft content (reviewStatus: 'unreviewed'): it
 * must be reviewed by a qualified guitar teacher before it is presented as a
 * reliable public curriculum.
 */
import type { Finger, StringNumber } from '../../domain/score';
import { openMidi } from '../../domain/tuning';

export interface Diagram {
  /** Strings to highlight (e.g. the string being introduced). */
  highlight: StringNumber[];
  /** Fretted dot, if any. */
  dot?: { string: StringNumber; fret: number; finger: Finger };
  /** Several fretted dots (chord shapes). */
  dots?: { string: StringNumber; fret: number; finger: Finger }[];
  /** Open (o) / do-not-play (x) markers at the nut. */
  markers?: { string: StringNumber; mark: 'o' | 'x' }[];
  caption: string;
  /**
   * Optional: the lowest fret to draw when the shape sits above fret 5. The diagram should then
   * show frets baseFret … baseFret + 4 (with a "5fr"-style label) instead of the nut and frets 1–5.
   * Omitted = start at the nut. Every dot lies inside that five-fret window (tested).
   */
  baseFret?: number;
}

/**
 * A chord shape: frets per string, listed low→high (string 6 → string 1); 'x' = do not play.
 * Names end with the chord symbol in parentheses, e.g. "E major (E)": strum-along bars refer to
 * shapes by that symbol.
 */
export interface ChordShape {
  name: string;
  lowToHigh: ('x' | number)[];
  fingersLowToHigh: Finger[];
}

export interface AttemptSpec {
  targetMidi: number;
  string: StringNumber;
  fret: number;
  finger: Finger;
  required: number;
}

/**
 * Techniques the app demonstrates but never assesses (see CLAUDE.md invariants). A step with
 * `technique` is a demonstration + self-check; any assessed part of it is only a plain picked note.
 */
export type TechniqueKind = 'bend' | 'slide' | 'hammer_on' | 'pull_off' | 'vibrato' | 'palm_mute' | 'double_stop' | 'octaves' | 'thumb_over';

export interface LessonStep {
  id: string;
  title: string;
  kind: 'info' | 'demo' | 'attempt' | 'stop-ringing' | 'practice' | 'choice' | 'quiz' | 'tap-pulse' | 'sequence' | 'strum-along' | 'ear-compare';
  body: string[];
  diagram?: Diagram;
  /** Prepare / press / sound / release cues, shown in order. */
  phases?: { label: string; text: string }[];
  /** Synth demonstration played only on request; assessment is disabled while it plays. */
  demoMidis?: number[];
  demoLabel?: string;
  attempt?: AttemptSpec;
  scoreRef?: string;
  selfCheckLabel?: string;
  /** Practice step defaults. */
  practice?: { mode?: 'wait' | 'fixed' | 'listen'; rate?: 0.5 | 0.75 | 1; cueLevel?: 'full' | 'reduced' | 'none'; loop?: { aTick: number; bTick: number } };
  quiz?: { question: string; options: string[]; answer: number; explain: string };
  pulse?: { bpm: number; beats: number };
  /** Notes to pluck one at a time, in order (chord string checks, echo phrases). */
  sequence?: { targets: AttemptSpec[]; playFirst?: boolean; label: string };
  /**
   * Strum along with chord names per bar (never assessed).
   * - `pattern` (optional): eight slots per bar, one per eighth note "1 & 2 & 3 & 4 &".
   *   'D' = down strum, 'U' = up strum, '-' = the hand keeps moving but misses the strings,
   *   'x' = a muted "chuck" (fretting fingers relaxed so the strings click). Example 'D-DU-UDU'.
   *   Intended rendering: arrows under the beat counter, highlighting the current slot. The body
   *   text always spells the pattern out in words too, so nothing depends on this field.
   * - `feel` (optional): 'shuffle' = swung "long-short" eighths (blues); default straight.
   *   Intended rendering: a small "shuffle feel" label next to the BPM.
   */
  strum?: { bpm: number; bars: string[]; shapes: ChordShape[]; pattern?: string; feel?: 'straight' | 'shuffle' };
  ear?: { rounds: number; pool: number[]; seed: number };
  /**
   * Optional technique annotation for demonstration/self-check steps (bends, slides, legato,
   * vibrato, palm muting, double stops, octaves, thumb-over). Intended rendering: a technique
   * badge plus a small arrow sketch ("string 3: fret 7 → bend up 2 semitones, to the pitch of
   * fret 9") and a "Not assessed — use your ears" label. Never assessed by the app.
   */
  technique?: {
    kind: TechniqueKind;
    /** String the technique happens on (bend, slide, hammer-on, pull-off, vibrato). */
    string?: StringNumber;
    /** Starting fret (0 = open string for hammer-ons/pull-offs). */
    fromFret?: number;
    /** Destination fret (slides, hammer-ons, pull-offs) or the fret whose pitch a bend should reach. */
    toFret?: number;
    /** Bend size in semitones: 1 = half-step bend, 2 = whole-step bend. */
    semitones?: 1 | 2;
    /** Strings sounding together (double stops, octaves). */
    strings?: StringNumber[];
  };
  /**
   * Optional short ASCII tab illustration, one line per string, string 1 (high e) on top,
   * e.g. ['e|-----0-2-|', 'B|---3-----|', ...]. All lines have the same length (≤ 36 characters)
   * so they render in a monospace block on a phone. Illustration only — never assessed.
   */
  tab?: string[];
  /**
   * Optional joke aside for this step. Intended rendering: a small aside under the body, shown
   * only when the voice style is not 'plain'. Never carries instructions — the body always has them.
   */
  funny?: string;
  /**
   * The tuning this step expects. Omitted = standard tuning. 'drop-d' steps ask the learner to
   * lower string 6 to D (the tuner offers a drop-D preset); they never contain assessed targets.
   * Intended rendering: a "Drop D" chip with a link to the tuner's drop-D preset.
   */
  tuning?: 'standard' | 'drop-d';
}

export interface Lesson {
  lessonId: string;
  version: number;
  title: string;
  skillId: string;
  prerequisiteSkillIds: string[];
  learningObjective: string;
  estimatedMinutes: string;
  equipment: string[];
  demonstrationAssets: string[];
  steps: LessonStep[];
  scoreRef: string | null;
  supportedAssessments: ('isolated_pitch' | 'attack_time')[];
  selfCheck: string;
  successRule: string;
  fallbacks: string[];
  rights: { author: string; license: null; evidence: string };
  reviewStatus: 'unreviewed' | 'teacher_reviewed';
  teacherReviewer: string | null;
  nextLessonId: string | null;
}

export function chordDiagram(c: ChordShape): Diagram {
  const dots: NonNullable<Diagram['dots']> = [];
  const markers: NonNullable<Diagram['markers']> = [];
  c.lowToHigh.forEach((f, i) => {
    const string = (6 - i) as StringNumber;
    if (f === 'x') markers.push({ string, mark: 'x' });
    else if (f === 0) markers.push({ string, mark: 'o' });
    else dots.push({ string, fret: f, finger: c.fingersLowToHigh[i] ?? null });
  });
  const fretted = dots.map((d) => d.fret);
  const high = fretted.length > 0 && Math.max(...fretted) > 5;
  return {
    highlight: [],
    dots,
    markers,
    caption: `${c.name}: low-to-high ${c.lowToHigh.join(' ')} (strings 6→1). o = play open, x = do not play.`,
    ...(high ? { baseFret: Math.min(...fretted) } : {}),
  };
}

/** The string-by-string pitches of a chord shape, in pluck order 6 → 1 (skipping x). */
export function chordTargets(c: ChordShape): AttemptSpec[] {
  const out: AttemptSpec[] = [];
  c.lowToHigh.forEach((f, i) => {
    if (f === 'x') return;
    const string = (6 - i) as StringNumber;
    out.push({ targetMidi: openMidi(string) + f, string, fret: f, finger: c.fingersLowToHigh[i] ?? null, required: 1 });
  });
  return out;
}

/** The chord symbol a shape is referred to by in strum-along bars: "E major (E)" → "E". */
export function chordSymbol(c: ChordShape): string {
  const m = /\(([^()]+)\)\s*$/.exec(c.name);
  return m ? m[1]! : c.name;
}

/** Sounding pitches of a shape (low → high) for a string-by-string demonstration. */
export function shapeMidis(c: ChordShape): number[] {
  return chordTargets(c).map((t) => t.targetMidi);
}

/** A single-note target at a string and fret (standard tuning). */
export function target(string: StringNumber, fret: number, finger: Finger = null): AttemptSpec {
  return { targetMidi: openMidi(string) + fret, string, fret, finger, required: 1 };
}

/**
 * Build an aligned ASCII tab (string 1 on top) from columns; each column maps string → text
 * such as '5', '5h7', '7b9' or 'x'. `lowLabel` names string 6 ('D' in drop D).
 */
export function tabFrom(columns: Partial<Record<StringNumber, string>>[], lowLabel: 'E' | 'D' = 'E'): string[] {
  const width = Math.max(1, ...columns.flatMap((c) => Object.values(c).map((v) => v.length))) + 1;
  const labels: Record<StringNumber, string> = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: lowLabel };
  return ([1, 2, 3, 4, 5, 6] as StringNumber[]).map((s) => `${labels[s]}|-${columns.map((c) => (c[s] ?? '').padEnd(width, '-')).join('')}|`);
}

/** Ticks in one 4/4 bar at PPQ 960. */
export const BAR = 3840;

export const RIGHTS = {
  author: 'Guitar Unhero project (original draft lesson text)',
  license: null,
  evidence: 'Written for this repository; not adapted from a published method book. Not yet teacher-reviewed.',
} as const satisfies Lesson['rights'];

// ---------- shared plain-language safety and honesty lines ----------

export const REST_HAND = 'If anything hurts, stop and rest. Comfortable, relaxed movement matters more than speed.';
export const SORE_FINGERS = 'Sore fingertips are normal in the first weeks. Sharp pain, tingling or numbness are not — stop and rest, and come back another day.';
export const SHORT_SESSIONS = 'Short sessions work best: 10–15 minutes, then shake your hands out and take a break.';
export const NO_FORCE_STRETCH = 'Never force a stretch. If a reach hurts, use the easier version — it is still real guitar.';
export const VOLUME = 'Electric players: keep the amp at a comfortable level, or use headphones turned low. If your ears ring or feel dull afterwards, it was too loud.';
export const STRUM_NOT_ASSESSED = 'Strummed chords and chord changes are not assessed — the microphone cannot reliably tell whether every string sounded. Use your ears and the self-check.';
export const TECHNIQUE_NOT_ASSESSED = 'The app does not assess this technique. It only checks plain picked notes, so listen, compare with the demonstration, and use the self-check.';

/** Fields every new lesson shares; `nextLessonId` is linked from the chapter order in lessons.ts. */
export type LessonDraft = Omit<Lesson, 'version' | 'rights' | 'reviewStatus' | 'teacherReviewer' | 'nextLessonId'>;

export function draft(l: LessonDraft): Lesson {
  return { version: 1, rights: { ...RIGHTS }, reviewStatus: 'unreviewed', teacherReviewer: null, nextLessonId: null, ...l };
}

/** The closing "What next?" step every lesson ends with. */
export function whatNext(text: string): LessonStep {
  return { id: 'next', title: 'What next?', kind: 'choice', body: [text] };
}

/** Show a chord shape and play it string by string. */
export function shapeDemo(id: string, title: string, shape: ChordShape, body: string[], extra: Partial<LessonStep> = {}): LessonStep {
  return { id, title, kind: 'demo', body, diagram: chordDiagram(shape), demoMidis: shapeMidis(shape), demoLabel: `Hear ${chordSymbol(shape)} string by string`, ...extra };
}

/** Check a chord shape one string at a time (each string is a separate single-note check). */
export function shapeCheck(id: string, shape: ChordShape, body: string[], extra: Partial<LessonStep> = {}): LessonStep {
  return {
    id,
    title: `Check ${chordSymbol(shape)} one string at a time`,
    kind: 'sequence',
    body,
    diagram: chordDiagram(shape),
    sequence: { targets: chordTargets(shape), label: 'Pluck' },
    selfCheckLabel: 'Each string rang clearly (self-check)',
    ...extra,
  };
}

/** Strum along with chord names per bar. Never assessed. */
export function strumAlong(
  id: string,
  title: string,
  body: string[],
  strum: NonNullable<LessonStep['strum']>,
  extra: Partial<LessonStep> = {},
): LessonStep {
  const first = strum.shapes.find((s) => chordSymbol(s) === strum.bars[0]) ?? strum.shapes[0]!;
  return { id, title, kind: 'strum-along', body, diagram: chordDiagram(first), strum, selfCheckLabel: 'I played along (self-check)', ...extra };
}
