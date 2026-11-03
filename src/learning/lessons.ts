/**
 * Original seed lessons (master spec §3.3–3.4). Technique wording is unreviewed
 * draft content: it must be reviewed by a qualified guitar teacher before it is
 * presented as a reliable public curriculum (reviewStatus: 'unreviewed').
 */
import type { Finger, StringNumber } from '../domain/score';
import { midiName, midiToPositions, openMidi, pitchClassName } from '../domain/tuning';

export interface Diagram {
  /** Strings to highlight (e.g. the string being introduced). */
  highlight: StringNumber[];
  /** Fretted dot, if any. */
  dot?: { string: StringNumber; fret: number; finger: Finger };
  caption: string;
}

export interface AttemptSpec {
  targetMidi: number;
  string: StringNumber;
  fret: number;
  finger: Finger;
  required: number;
}

export interface LessonStep {
  id: string;
  title: string;
  kind: 'info' | 'demo' | 'attempt' | 'stop-ringing' | 'practice' | 'choice';
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

const RIGHTS = {
  author: 'Guitar Unhero project (original draft lesson text)',
  license: null,
  evidence: 'Written for this repository; not adapted from a published method book. Not yet teacher-reviewed.',
};

const REST_HAND =
  'If anything hurts, stop and rest. Comfortable, relaxed movement matters more than speed.';

export const LESSONS: readonly Lesson[] = [
  {
    lessonId: 'lesson.high-e.first-sound.v1',
    version: 1,
    title: 'Your first sound: the high E string',
    skillId: 'skill.high-e.open',
    prerequisiteSkillIds: ['skill.guitar.identified', 'skill.tuning.broad'],
    learningObjective: 'Make three deliberate sounds on the high E string, with comfortable pauses.',
    estimatedMinutes: '3–5',
    equipment: ['six-string guitar, broadly tuned', 'pick or a finger', 'optional microphone'],
    demonstrationAssets: ['synthesized E4 pluck (generated in the browser)'],
    scoreRef: 'exercise.high-e-open',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I plucked the thinnest string three times and let it ring.',
    successRule: 'Three recognized E4 attacks, or an explicit self-check when listening is unavailable.',
    fallbacks: ['Self-check without a microphone', 'Listen to the demonstration again', 'Check the input meter in Setup'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.high-e.first-frets.v1',
    steps: [
      {
        id: 'meet-string',
        title: 'Meet string 1 — high E',
        kind: 'info',
        body: [
          'String 1 is the thinnest string. When you hold the guitar to play, it is the string closest to the floor.',
          '“High” describes its pitch, not its position: it makes the highest sound of the six open strings. Its note is E (E4).',
        ],
        diagram: { highlight: [1], caption: 'String 1 — high E (thinnest). Strings are numbered 1 (thinnest) to 6 (thickest).' },
        demoMidis: [64],
        demoLabel: 'Play an E4 reference',
      },
      {
        id: 'pluck-once',
        title: 'Listen first',
        kind: 'demo',
        body: [
          'Keep your fretting hand relaxed — it does not need to touch the strings yet.',
          'Pluck this string once with your pick or a finger, then let it ring. First, listen to how it should sound.',
        ],
        diagram: { highlight: [1], caption: 'Pluck string 1 only. No fingers on the frets.' },
        phases: [
          { label: 'Prepare', text: 'Rest your picking hand near the sound hole or pickups.' },
          { label: 'Sound', text: 'Pluck string 1 once, gently.' },
          { label: 'Let it ring', text: 'Keep your hands still and listen.' },
        ],
        demoMidis: [64],
        demoLabel: 'Hear the demonstration',
      },
      {
        id: 'your-turn',
        title: 'Your turn — three sounds',
        kind: 'attempt',
        body: ['Pluck string 1 once, let it ring, and pause. Do this three times, at your own pace.', REST_HAND],
        diagram: { highlight: [1], caption: 'Open string 1 (E4).' },
        attempt: { targetMidi: 64, string: 1, fret: 0, finger: null, required: 3 },
        demoMidis: [64],
        demoLabel: 'Hear it again',
        selfCheckLabel: 'I plucked it three times (self-check)',
      },
      {
        id: 'stop-ringing',
        title: 'Stop the sound on purpose',
        kind: 'stop-ringing',
        body: [
          'Pluck string 1 and let it ring for a moment.',
          'Then stop the sound deliberately: lightly rest the side of your picking hand, or the fingers of your other hand, on the strings.',
          'Stopping a sound is a real skill — it is how rests become quiet.',
        ],
        diagram: { highlight: [1], caption: 'Touch the string lightly to stop it — no pressing needed.' },
        selfCheckLabel: 'I stopped the sound (self-check)',
      },
      {
        id: 'count-in',
        title: 'With a four-beat count-in',
        kind: 'practice',
        body: [
          'Now play the same sound in time. You will hear four count-in clicks, then pluck on each note as it reaches the line.',
          'Each note is followed by a rest. Use the rest to stop the string or simply relax.',
        ],
        scoreRef: 'exercise.high-e-open',
        selfCheckLabel: 'I played along (self-check)',
      },
      {
        id: 'next',
        title: 'What next?',
        kind: 'choice',
        body: ['Nice work. You made deliberate sounds on your guitar. Choose what to do next — there is no wrong choice.'],
      },
    ],
  },
  {
    lessonId: 'lesson.high-e.first-frets.v1',
    version: 1,
    title: 'First fretted notes on high E',
    skillId: 'skill.high-e.frets-1-3',
    prerequisiteSkillIds: ['skill.high-e.open'],
    learningObjective: 'Play F4 (fret 1) and G4 (fret 3) on string 1, release cleanly, and check the neighbouring string.',
    estimatedMinutes: '5–8',
    equipment: ['six-string guitar, tuned', 'optional microphone'],
    demonstrationAssets: ['synthesized E4/F4/G4 plucks'],
    scoreRef: 'exercise.high-e-frets',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I played E, F and G on string 1.',
    successRule: 'Recognized F4 and G4 attacks, or an explicit self-check.',
    fallbacks: ['Self-check', 'Repeat the demonstration', 'Return to the open string'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.b-string.first-frets.v1',
    steps: [
      {
        id: 'fret-1-intro',
        title: 'Fret 1 gives F',
        kind: 'demo',
        body: [
          'Place your index finger on string 1 just behind the first fret wire — on the side nearer the tuning pegs, not on top of the wire.',
          'Press only as much as you need for a clear sound. Then pluck once, release, and compare it with the open E.',
          'A sound confirms the pitch, not which finger you used — finger numbers here are suggestions.',
        ],
        diagram: { highlight: [1], dot: { string: 1, fret: 1, finger: 1 }, caption: 'String 1, fret 1, suggested finger 1 (index).' },
        phases: [
          { label: 'Prepare', text: 'Hover the index fingertip just behind fret 1.' },
          { label: 'Press', text: 'Press gently until the string touches the fret.' },
          { label: 'Sound', text: 'Pluck string 1 once.' },
          { label: 'Release', text: 'Relax the finger so it stops pressing.' },
        ],
        demoMidis: [64, 65],
        demoLabel: 'Hear open E, then F',
      },
      {
        id: 'fret-1-attempt',
        title: 'Your turn — F',
        kind: 'attempt',
        body: ['Press just behind fret 1 on string 1 and pluck. Do it twice, releasing in between.'],
        diagram: { highlight: [1], dot: { string: 1, fret: 1, finger: 1 }, caption: 'Target: F4 — string 1, fret 1.' },
        attempt: { targetMidi: 65, string: 1, fret: 1, finger: 1, required: 2 },
        demoMidis: [65],
        demoLabel: 'Hear F again',
        selfCheckLabel: 'I played F twice (self-check)',
      },
      {
        id: 'release-open',
        title: 'Release and compare',
        kind: 'attempt',
        body: ['Lift the pressure from your finger and pluck the open string again. You should hear E — lower than F.'],
        diagram: { highlight: [1], caption: 'Open string 1 (E4).' },
        attempt: { targetMidi: 64, string: 1, fret: 0, finger: null, required: 1 },
        selfCheckLabel: 'I heard the open E (self-check)',
      },
      {
        id: 'fret-3-intro',
        title: 'Fret 3 gives G',
        kind: 'demo',
        body: ['Fret 3 gives G4. Many players use the ring finger here, keeping the hand relaxed and the fingertip just behind the third fret wire.'],
        diagram: { highlight: [1], dot: { string: 1, fret: 3, finger: 3 }, caption: 'String 1, fret 3, suggested finger 3 (ring).' },
        phases: [
          { label: 'Prepare', text: 'Hover the ring fingertip just behind fret 3.' },
          { label: 'Press', text: 'Press only as hard as needed.' },
          { label: 'Sound', text: 'Pluck once.' },
          { label: 'Release', text: 'Relax.' },
        ],
        demoMidis: [64, 67],
        demoLabel: 'Hear open E, then G',
      },
      {
        id: 'fret-3-attempt',
        title: 'Your turn — G',
        kind: 'attempt',
        body: ['Press just behind fret 3 on string 1 and pluck. Do it twice.'],
        diagram: { highlight: [1], dot: { string: 1, fret: 3, finger: 3 }, caption: 'Target: G4 — string 1, fret 3.' },
        attempt: { targetMidi: 67, string: 1, fret: 3, finger: 3, required: 2 },
        demoMidis: [67],
        demoLabel: 'Hear G again',
        selfCheckLabel: 'I played G twice (self-check)',
      },
      {
        id: 'adjacent-check',
        title: 'Check the neighbouring string',
        kind: 'attempt',
        body: [
          'Hold fret 1 on string 1 as before. Without moving that finger, pluck string 2 (the next thicker string, B).',
          'If string 2 rings clearly, your fretting finger is probably not leaning on it. If it sounds muffled, try coming down more on the fingertip.',
          'The microphone can hear the B; it cannot see your finger, so this is a listening check, not a measurement of your hand.',
        ],
        diagram: { highlight: [1, 2], dot: { string: 1, fret: 1, finger: 1 }, caption: 'Hold string 1 fret 1, pluck open string 2 (B3).' },
        attempt: { targetMidi: 59, string: 2, fret: 0, finger: null, required: 1 },
        demoMidis: [59],
        demoLabel: 'Hear open B',
        selfCheckLabel: 'String 2 rang clearly (self-check)',
      },
      {
        id: 'practice',
        title: 'Play E–F–G–E in time',
        kind: 'practice',
        body: ['Play the four notes with a rest after each. Wait mode pauses for you at every note.'],
        scoreRef: 'exercise.high-e-frets',
        selfCheckLabel: 'I played along (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Well done. You can repeat, move on to string 2, or finish for today.'] },
    ],
  },
  {
    lessonId: 'lesson.b-string.first-frets.v1',
    version: 1,
    title: 'Move to string 2 (B)',
    skillId: 'skill.b-string.frets-1-3',
    prerequisiteSkillIds: ['skill.high-e.frets-1-3'],
    learningObjective: 'Play B3, C4 and D4 on string 2 and prepare the next finger before it is needed.',
    estimatedMinutes: '5–8',
    equipment: ['six-string guitar, tuned', 'optional microphone'],
    demonstrationAssets: ['synthesized B3/C4/D4 plucks'],
    scoreRef: 'exercise.b-string-frets',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I played B, C and D on string 2.',
    successRule: 'Recognized C4 and D4 attacks, or an explicit self-check.',
    fallbacks: ['Self-check', 'Repeat the demonstration'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: null,
    steps: [
      {
        id: 'meet-b',
        title: 'String 2 is B',
        kind: 'demo',
        body: ['String 2 is next to the high E — one string thicker. Open, it plays B3. Fret 1 gives C4 and fret 3 gives D4: the same finger pattern you used on string 1.'],
        diagram: { highlight: [2], caption: 'String 2 — B3.' },
        demoMidis: [59, 60, 62],
        demoLabel: 'Hear B, C, D',
      },
      {
        id: 'c-attempt',
        title: 'Your turn — C (fret 1)',
        kind: 'attempt',
        body: ['Index finger just behind fret 1 on string 2. Pluck string 2 only.'],
        diagram: { highlight: [2], dot: { string: 2, fret: 1, finger: 1 }, caption: 'Target: C4 — string 2, fret 1.' },
        attempt: { targetMidi: 60, string: 2, fret: 1, finger: 1, required: 2 },
        demoMidis: [60],
        demoLabel: 'Hear C',
        selfCheckLabel: 'I played C twice (self-check)',
      },
      {
        id: 'd-attempt',
        title: 'Your turn — D (fret 3)',
        kind: 'attempt',
        body: ['Ring finger just behind fret 3 on string 2. While the previous note rings, get the next finger ready — preparation is part of playing.'],
        diagram: { highlight: [2], dot: { string: 2, fret: 3, finger: 3 }, caption: 'Target: D4 — string 2, fret 3.' },
        attempt: { targetMidi: 62, string: 2, fret: 3, finger: 3, required: 2 },
        demoMidis: [62],
        demoLabel: 'Hear D',
        selfCheckLabel: 'I played D twice (self-check)',
      },
      {
        id: 'practice',
        title: 'Play B–C–D–B in time',
        kind: 'practice',
        body: ['Four notes with rests. After this you are ready for the two-string exercise in Practice.'],
        scoreRef: 'exercise.b-string-frets',
        selfCheckLabel: 'I played along (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['You can now try “First two strings” in Practice, which moves between string 1 and string 2.'] },
    ],
  },
];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.lessonId === id);
}

export const KNOWN_LESSON_IDS: ReadonlySet<string> = new Set(LESSONS.map((l) => l.lessonId));

/** Specific, evidence-based feedback for a recognized pitch in a single-note attempt. */
export function attemptFeedback(spec: AttemptSpec, heardMidiFloat: number): { correct: boolean; text: string } {
  const heard = Math.round(heardMidiFloat);
  const cents = (heardMidiFloat - spec.targetMidi) * 100;
  const targetName = pitchClassName(spec.targetMidi);
  if (Math.abs(cents) <= 50) return { correct: true, text: `I heard ${targetName}.` };
  const heardName = pitchClassName(heard);
  if (Math.abs(Math.abs(cents) - 1200) <= 60) {
    return { correct: false, text: `That sounded like ${heardName}, but in a different octave than ${midiName(spec.targetMidi)}. I can't be sure — pluck string ${spec.string} once more and let it ring.` };
  }
  const where = spec.fret === 0 ? `the open string ${spec.string}` : `string ${spec.string}, just behind fret ${spec.fret}`;
  // Heard the open pitch of the target string while a fret was expected.
  if (spec.fret > 0 && heard === openMidi(spec.string)) {
    return { correct: false, text: `That sounded like ${heardName} — the open string. The target is ${targetName}: press ${where} before plucking.` };
  }
  // Heard another open string → probably the wrong string.
  const openStrings = ([1, 2, 3, 4, 5, 6] as StringNumber[]).filter((s) => openMidi(s) === heard && s !== spec.string);
  if (openStrings.length && spec.fret === 0) {
    return { correct: false, text: `That sounded like ${heardName}, which is open string ${openStrings[0]}. The target is ${targetName} on ${where}.` };
  }
  const onTarget = midiToPositions(heard).find((p) => p.string === spec.string);
  if (onTarget && spec.fret > 0) {
    return {
      correct: false,
      text: `That sounded like ${heardName}${onTarget.fret > 0 ? ` (fret ${onTarget.fret})` : ''}. The target is ${targetName} — ${heard > spec.targetMidi ? 'a little lower' : 'a little higher'}: ${where}.`,
    };
  }
  return { correct: false, text: `That sounded like ${heardName}. The target is ${targetName} on ${where}.` };
}
