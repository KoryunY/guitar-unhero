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
  /** Several fretted dots (chord shapes). */
  dots?: { string: StringNumber; fret: number; finger: Finger }[];
  /** Open (o) / do-not-play (x) markers at the nut. */
  markers?: { string: StringNumber; mark: 'o' | 'x' }[];
  caption: string;
}

/** A chord shape: frets per string, listed low→high (string 6 → string 1); 'x' = do not play. */
export interface ChordShape {
  name: string;
  lowToHigh: ('x' | number)[];
  fingersLowToHigh: Finger[];
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
  return {
    highlight: [],
    dots,
    markers,
    caption: `${c.name}: low-to-high ${c.lowToHigh.join(' ')} (strings 6→1). o = play open, x = do not play.`,
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

/** Reviewed chord facts from the master specification §3.3. */
export const EM: ChordShape = { name: 'E minor (Em)', lowToHigh: [0, 2, 2, 0, 0, 0], fingersLowToHigh: [null, 2, 3, null, null, null] };
export const AM: ChordShape = { name: 'A minor (Am)', lowToHigh: ['x', 0, 2, 2, 1, 0], fingersLowToHigh: [null, null, 2, 3, 1, null] };

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
  practice?: { mode?: 'wait' | 'fixed' | 'listen'; rate?: 0.5 | 0.75 | 1; cueLevel?: 'full' | 'reduced' | 'none' };
  quiz?: { question: string; options: string[]; answer: number; explain: string };
  pulse?: { bpm: number; beats: number };
  /** Notes to pluck one at a time, in order (chord string checks, echo phrases). */
  sequence?: { targets: AttemptSpec[]; playFirst?: boolean; label: string };
  strum?: { bpm: number; bars: string[]; shapes: ChordShape[] };
  ear?: { rounds: number; pool: number[]; seed: number };
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

const M1_LESSONS: Lesson[] = [
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
    nextLessonId: 'lesson.pulse.v1',
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
    nextLessonId: 'lesson.em-chord.v1',
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


const target = (string: StringNumber, fret: number, finger: Finger = null): AttemptSpec => ({ targetMidi: openMidi(string) + fret, string, fret, finger, required: 1 });

const M2_LESSONS: Lesson[] = [
  {
    lessonId: 'lesson.meet-guitar.v1',
    version: 1,
    title: 'Meet the guitar',
    skillId: 'skill.guitar.identified',
    prerequisiteSkillIds: [],
    learningObjective: 'Name the parts you will use, find strings 1 and 6, and choose a comfortable way to hold the guitar.',
    estimatedMinutes: '3–4',
    equipment: ['guitar optional'],
    demonstrationAssets: ['diagrams', 'synthesized open-string sounds'],
    scoreRef: null,
    supportedAssessments: [],
    selfCheck: 'I can point to string 1 (thinnest) and string 6 (thickest).',
    successRule: 'Answer the two string questions (answers can be retried).',
    fallbacks: ['Re-read the diagram', 'Listen to the high and low E'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.high-e.first-sound.v1',
    steps: [
      {
        id: 'parts',
        title: 'The parts you will use',
        kind: 'info',
        body: [
          'Headstock and tuning pegs: turning a peg tightens or loosens a string, which raises or lowers its pitch.',
          'Neck and frets: the metal strips across the neck are frets. Pressing a string just behind a fret makes a higher note.',
          'Body and sound hole (or pickups): pluck or strum the strings over this area.',
          'Strings are numbered 1 to 6. String 1 is the thinnest and highest-sounding; string 6 is the thickest and lowest.',
        ],
        diagram: { highlight: [1, 6], caption: 'Strings 1 (thinnest, high E) and 6 (thickest, low E).' },
        demoMidis: [64, 40],
        demoLabel: 'Hear string 1, then string 6',
      },
      {
        id: 'quiz-string-1',
        title: 'Quick check: string 1',
        kind: 'quiz',
        body: ['No guitar needed — just pick an answer. You can try again as often as you like.'],
        quiz: {
          question: 'Which string is “string 1”?',
          options: ['The thickest string', 'The thinnest string', 'The middle string'],
          answer: 1,
          explain: 'String 1 is the thinnest, highest-sounding string (high E). When you hold the guitar it is closest to the floor.',
        },
      },
      {
        id: 'quiz-high',
        title: 'Quick check: “high” and “low”',
        kind: 'quiz',
        body: ['Guitarists say “high” and “low” about sound, not position.'],
        quiz: {
          question: 'When you hold the guitar, string 6 is nearest your face. Why is it called the “low” E?',
          options: ['Because it is lowest on the guitar', 'Because it makes the lowest sound', 'Because it is the loosest string'],
          answer: 1,
          explain: '“Low” describes pitch: string 6 makes the lowest sound, even though it sits highest when you hold the guitar.',
        },
      },
      {
        id: 'holding',
        title: 'Holding the guitar',
        kind: 'info',
        body: [
          'Sit on a chair without arms. Rest the guitar’s waist on the leg on your strumming-hand side (classical players often use the other leg with a footstool).',
          'Keep your back relaxed and the neck pointing slightly upward. Your fretting hand should not carry the guitar’s weight.',
          'Use a thin or medium pick, or the side of your thumb — both are fine for these lessons.',
          'If anything hurts, stop and rest. Comfortable movement matters more than speed. These instructions are general guidance, not a medical or posture assessment.',
        ],
        diagram: { highlight: [1], caption: 'Diagrams read like tablature: string 1 on top.' },
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: tune the guitar (Tuner), then make your first sound.'] },
    ],
  },
  {
    lessonId: 'lesson.pulse.v1',
    version: 1,
    title: 'Feel the pulse',
    skillId: 'skill.pulse.quarters',
    prerequisiteSkillIds: ['skill.high-e.open'],
    learningObjective: 'Count four steady beats, tap along with clicks, then play quarter notes and a rest on the open high E.',
    estimatedMinutes: '4–6',
    equipment: ['keyboard or touch screen', 'guitar for the last step'],
    demonstrationAssets: ['metronome clicks'],
    scoreRef: 'exercise.pulse-quarters',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I played three beats and rested on the fourth.',
    successRule: 'Tap test: ≥75 % of taps near a click; guitar step: assessed notes or self-check.',
    fallbacks: ['Count out loud', 'Use wait mode', 'Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.high-e.first-frets.v1',
    steps: [
      {
        id: 'count',
        title: 'Count four',
        kind: 'info',
        body: [
          'Music is organised in steady beats. Here each bar has four: count “1, 2, 3, 4, 1, 2, 3, 4…” at an even speed.',
          'A rest is a beat where you do not play — but you keep counting.',
        ],
      },
      {
        id: 'tap',
        title: 'Tap along',
        kind: 'tap-pulse',
        body: ['Press Start. After four count-in clicks, tap Space (or the big button) on each of the next eight clicks. No guitar needed.'],
        pulse: { bpm: 60, beats: 8 },
        selfCheckLabel: 'I tapped along (self-check)',
      },
      {
        id: 'play',
        title: 'Three beats and a rest',
        kind: 'practice',
        body: ['Pluck the open high E on beats 1, 2 and 3. On beat 4 rest — let the string ring or stop it gently, your choice. Use downstrokes (pluck toward the floor).'],
        scoreRef: 'exercise.pulse-quarters',
        practice: { mode: 'fixed', rate: 1 },
        selfCheckLabel: 'I played the pattern (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next you will press your first frets on string 1.'] },
    ],
  },
  {
    lessonId: 'lesson.em-chord.v1',
    version: 1,
    title: 'Your first chord: E minor',
    skillId: 'skill.chord.em',
    prerequisiteSkillIds: ['skill.b-string.frets-1-3'],
    learningObjective: 'Form Em, check each string separately, then strum it gently.',
    estimatedMinutes: '6–8',
    equipment: ['tuned guitar', 'optional microphone'],
    demonstrationAssets: ['synthesized string-by-string Em'],
    scoreRef: null,
    supportedAssessments: ['isolated_pitch'],
    selfCheck: 'Each string rang clearly and I strummed four times.',
    successRule: 'Each of the six strings heard at its expected pitch (one at a time), or self-check. The full strummed chord is not assessed.',
    fallbacks: ['Self-check', 'Pluck strings one by one again'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.am-chord.v1',
    steps: [
      {
        id: 'shape',
        title: 'The Em shape',
        kind: 'demo',
        body: [
          'Em uses two fingers. A common fingering: middle finger on string 5 at fret 2, ring finger on string 4 at fret 2. All six strings are played.',
          'Fingertips just behind the fret, arched so they don’t touch the neighbouring strings. Press only as much as needed.',
          'Finger numbers are suggestions; other comfortable fingerings are fine.',
        ],
        diagram: chordDiagram(EM),
        phases: [
          { label: 'Prepare', text: 'Hover both fingertips above fret 2.' },
          { label: 'Press', text: 'Place middle (string 5) then ring (string 4).' },
          { label: 'Sound', text: 'Pluck strings 6 → 1 one at a time.' },
          { label: 'Release', text: 'Relax the fingers and shake the hand loose.' },
        ],
        demoMidis: [40, 47, 52, 55, 59, 64],
        demoLabel: 'Hear Em string by string',
      },
      {
        id: 'check',
        title: 'Check each string',
        kind: 'sequence',
        body: [
          'Hold the Em shape and pluck one string at a time, from string 6 down to string 1. I listen for each expected note.',
          'If a string sounds muffled or wrong, adjust that finger and pluck it again. A clear note means that string is sounding — it does not tell me which finger you used.',
        ],
        diagram: chordDiagram(EM),
        sequence: { targets: chordTargets(EM), label: 'Pluck string' },
        selfCheckLabel: 'Each string rang clearly (self-check)',
      },
      {
        id: 'strum',
        title: 'A gentle strum',
        kind: 'strum-along',
        body: [
          'Brush down across all six strings once per bar, on beat 1, and let it ring. Keep counting 2, 3, 4.',
          'Strummed chords are not assessed yet — the microphone cannot reliably tell whether every string sounded. Use your ears and the self-check.',
        ],
        diagram: chordDiagram(EM),
        strum: { bpm: 60, bars: ['Em', 'Em', 'Em', 'Em'], shapes: [EM] },
        selfCheckLabel: 'I strummed Em on each bar (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: A minor, and changing between the two shapes.'] },
    ],
  },
  {
    lessonId: 'lesson.am-chord.v1',
    version: 1,
    title: 'A minor and your first chord change',
    skillId: 'skill.chord.am-change',
    prerequisiteSkillIds: ['skill.chord.em'],
    learningObjective: 'Form Am, check each played string, and change slowly between Em and Am.',
    estimatedMinutes: '8–10',
    equipment: ['tuned guitar', 'optional microphone'],
    demonstrationAssets: ['synthesized string-by-string Am'],
    scoreRef: null,
    supportedAssessments: ['isolated_pitch'],
    selfCheck: 'I changed between Em and Am in time, slowly.',
    successRule: 'Strings 5 → 1 heard at expected pitches, or self-check. Chord changes are not assessed.',
    fallbacks: ['Self-check', 'Change on every other bar', 'Prepare one finger at a time'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.first-piece.v1',
    steps: [
      {
        id: 'shape',
        title: 'The Am shape',
        kind: 'demo',
        body: [
          'Am: index finger on string 2 at fret 1, middle on string 4 at fret 2, ring on string 3 at fret 2. String 5 is played open, string 1 open.',
          'String 6 has an x: do not play it. Start your strum from string 5.',
        ],
        diagram: chordDiagram(AM),
        phases: [
          { label: 'Prepare', text: 'Hover index over string 2 fret 1.' },
          { label: 'Press', text: 'Place index, then middle and ring at fret 2.' },
          { label: 'Sound', text: 'Pluck strings 5 → 1 one at a time.' },
          { label: 'Release', text: 'Relax all three fingers together.' },
        ],
        demoMidis: [45, 52, 57, 60, 64],
        demoLabel: 'Hear Am string by string',
      },
      {
        id: 'check',
        title: 'Check each string',
        kind: 'sequence',
        body: ['Hold Am and pluck strings 5, 4, 3, 2, 1 one at a time. Skip string 6.'],
        diagram: chordDiagram(AM),
        sequence: { targets: chordTargets(AM), label: 'Pluck string' },
        selfCheckLabel: 'Each played string rang clearly (self-check)',
      },
      {
        id: 'change-prep',
        title: 'How to change shapes',
        kind: 'info',
        body: [
          'From Em to Am, the middle and ring fingers each move one string toward the floor, and the index finger joins on string 2.',
          'Move the fingers together as a shape, slowly. Lift only as much as needed. Start preparing during beat 4, before the change.',
          'It is normal for changes to feel slow for days. Smooth beats fast.',
        ],
        diagram: chordDiagram(AM),
      },
      {
        id: 'change',
        title: 'Em ↔ Am, slowly',
        kind: 'strum-along',
        body: ['Strum once on beat 1 of each bar. Change shape during beats 2–4. Chord changes are not assessed — follow along and self-check.'],
        diagram: chordDiagram(EM),
        strum: { bpm: 50, bars: ['Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'Am', 'Am'], shapes: [EM, AM] },
        selfCheckLabel: 'I made the changes (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: put single notes together into your first complete piece.'] },
    ],
  },
  {
    lessonId: 'lesson.first-piece.v1',
    version: 1,
    title: 'Your first complete piece: Morning Steps',
    skillId: 'skill.piece.morning-steps',
    prerequisiteSkillIds: ['skill.high-e.frets-1-3', 'skill.b-string.frets-1-3', 'skill.pulse.quarters'],
    learningObjective: 'Play an original 8-bar melody on strings 1 and 2: listen, play with the app waiting for you, play in time, then play it with fewer cues.',
    estimatedMinutes: '10–15 (over several days)',
    equipment: ['tuned guitar', 'microphone recommended'],
    demonstrationAssets: ['synthesized melody'],
    scoreRef: 'piece.morning-steps',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I can play Morning Steps from memory.',
    successRule: 'Fixed tempo ≥80 % pitch on assessed notes with ≥70 % coverage; retained after a cue-free success on a later day.',
    fallbacks: ['Wait mode', '50 % tempo', 'Loop one bar', 'Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.listen-remember.v1',
    steps: [
      {
        id: 'listen',
        title: 'Listen first',
        kind: 'practice',
        body: ['Listen to the whole piece. Follow the notes on the lanes: string 1 on top, string 2 below. It uses only notes you know: E, F, G on string 1 and B, C, D on string 2.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'listen', rate: 1 },
        selfCheckLabel: 'I listened to it',
      },
      {
        id: 'wait',
        title: 'Play it with the app waiting for you',
        kind: 'practice',
        body: ['Wait mode stops at every note until it hears it. Take your time — rhythm is not graded here. Loop a bar if one spot is tricky.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1 },
        selfCheckLabel: 'I played through it (self-check)',
      },
      {
        id: 'fixed',
        title: 'In time, slowly',
        kind: 'practice',
        body: ['Now the music keeps going at 50 %. Prepare each next finger during the note before it. When two phrases go well, the app will offer the next tempo.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5 },
        selfCheckLabel: 'I played it in time (self-check)',
      },
      {
        id: 'recall',
        title: 'Fewer cues, then from memory',
        kind: 'practice',
        body: [
          'Try it with fret numbers hidden (“reduced”), then with no notes shown at all (“from memory”) — just the beat.',
          'A from-memory success on a later day marks this piece as retained.',
        ],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5, cueLevel: 'reduced' },
        selfCheckLabel: 'I played it from memory (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['You played a complete piece. Come back tomorrow and play it from memory to make it stick.'] },
    ],
  },
  {
    lessonId: 'lesson.listen-remember.v1',
    version: 1,
    title: 'Listen and remember',
    skillId: 'skill.ear.basic',
    prerequisiteSkillIds: ['skill.high-e.frets-1-3'],
    learningObjective: 'Hear which of two notes is higher, and echo short two-note phrases on the guitar.',
    estimatedMinutes: '4–6',
    equipment: ['headphones recommended', 'guitar for echo'],
    demonstrationAssets: ['synthesized notes'],
    scoreRef: null,
    supportedAssessments: ['isolated_pitch'],
    selfCheck: 'I echoed the phrases.',
    successRule: 'Higher/lower: ≥4 of 6; echo: each note heard in order, or self-check.',
    fallbacks: ['Replay the notes', 'Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: null,
    steps: [
      {
        id: 'higher-lower',
        title: 'Higher or lower?',
        kind: 'ear-compare',
        body: ['You will hear two notes. Which one was higher? No guitar needed. Replay as often as you like.'],
        ear: { rounds: 6, pool: [59, 60, 62, 64, 65, 67], seed: 7 },
      },
      {
        id: 'echo-1',
        title: 'Echo: E then G',
        kind: 'sequence',
        body: ['Listen to the two notes, then play them back on string 1: open E, then fret 3.'],
        sequence: { targets: [target(1, 0), target(1, 3, 3)], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I echoed it (self-check)',
      },
      {
        id: 'echo-2',
        title: 'Echo: C then B',
        kind: 'sequence',
        body: ['Now on string 2: fret 1, then open.'],
        sequence: { targets: [target(2, 1, 1), target(2, 0)], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I echoed it (self-check)',
      },
      {
        id: 'echo-3',
        title: 'Echo by ear',
        kind: 'sequence',
        body: ['This time no hint: listen and find the two notes. They are among E, F, G (string 1) and B, C, D (string 2). Use “Show answer” if you need it.'],
        sequence: { targets: [target(1, 1, 1), target(2, 3, 3)], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I found them (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['That completes this set of lessons. Keep Morning Steps alive by playing it from memory now and then.'] },
    ],
  },
];

const ORDER = [
  'lesson.meet-guitar.v1',
  'lesson.high-e.first-sound.v1',
  'lesson.pulse.v1',
  'lesson.high-e.first-frets.v1',
  'lesson.b-string.first-frets.v1',
  'lesson.em-chord.v1',
  'lesson.am-chord.v1',
  'lesson.first-piece.v1',
  'lesson.listen-remember.v1',
];

export const LESSONS: readonly Lesson[] = ORDER.map((id) => [...M1_LESSONS, ...M2_LESSONS].find((l) => l.lessonId === id)!);

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
