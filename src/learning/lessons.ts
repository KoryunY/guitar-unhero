/**
 * The curriculum (master spec §3.3–3.5). The 14 seed lessons live here; the rest
 * of the 1.0 path lives in ./curriculum/*.ts, and the order comes from
 * ./chapters.ts. Shared types and chord helpers are defined in
 * ./curriculum/core.ts and re-exported below, so this module stays the public
 * entry point. Technique wording is unreviewed draft content: it must be
 * reviewed by a qualified guitar teacher before it is presented as a reliable
 * public curriculum (reviewStatus: 'unreviewed').
 */
import type { StringNumber } from '../domain/score';
import { midiToPositions, openMidi, pitchClassName } from '../domain/tuning';
import { CHAPTER_ORDER } from './chapters';
import { AM, EM } from './curriculum/chords';
import { BAR, chordDiagram, chordTargets, REST_HAND, RIGHTS, target, type AttemptSpec, type Lesson } from './curriculum/core';
import { OPEN_CHORDS_LESSONS } from './curriculum/open-chords';
import { SONGS_RIFFS_LESSONS } from './curriculum/songs-riffs';
import { BLUES_LEAD_LESSONS } from './curriculum/blues-lead';
import { BARRE_THEORY_LESSONS } from './curriculum/barre-theory';
import { HERO_LESSONS } from './curriculum/hero';

export type { AttemptSpec, ChordShape, Diagram, Lesson, LessonStep, TechniqueKind } from './curriculum/core';
export { chordDiagram, chordSymbol, chordTargets } from './curriculum/core';
/** Reviewed chord facts from the master specification §3.3 (the full dictionary lives in curriculum/chords.ts). */
export { AM, EM } from './curriculum/chords';

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
          '“High” describes its pitch, not its position: it makes the highest sound of the six open strings. Its note is E. (You may see “E4” — the number just says which E.)',
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
          'First, press “Hear the demonstration” and listen.',
          'Then pluck string 1 once and let it ring.',
        ],
        diagram: { highlight: [1], caption: 'Pluck string 1 only. No fingers on the frets.' },
        phases: [
          { label: 'Prepare', text: 'Rest your picking hand near the sound hole or pickups.' },
          { label: 'Sound', text: 'Pluck string 1 once, gently.' },
          { label: 'Let it ring', text: 'Keep your hands still and listen.' },
        ],
        demoMidis: [64],
        demoLabel: 'Hear the demonstration',
        funny: 'This is the first note of your legend. No pressure. (Genuinely no pressure — there are thousands more.)',
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
        funny: 'Silence: the only note every guitarist can play perfectly from day one. Well, almost.',
      },
      {
        id: 'count-in',
        title: 'With a four-beat count-in',
        kind: 'practice',
        body: [
          'Each row is a string; string 1 is the top row. The number on a note is the fret — 0 means open.',
          'After four clicks, pluck as each note reaches the line. Each note is followed by a rest: use it to quiet the string and keep counting.',
        ],
        scoreRef: 'exercise.high-e-open',
        practice: { mode: 'fixed', rate: 1 },
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
          'Rest your thumb on the back of the neck, behind your fingers. Place your index fingertip on string 1, just behind fret 1 (on the tuning-peg side of the metal wire).',
          'Press only as much as you need for a clear sound. Then pluck once, release, and compare it with the open E.',
          'Short nails help. Sore fingertips are normal at first; sharp pain, tingling or numbness are not — stop and rest.',
          'A sound confirms the pitch, not which finger you used — finger numbers here are suggestions.',
        ],
        diagram: { highlight: [1], dot: { string: 1, fret: 1, finger: 1 }, caption: 'String 1, fret 1, suggested finger 1 (index).' },
        phases: [
          { label: 'Prepare', text: 'Hover the index fingertip just behind fret 1.' },
          { label: 'Press', text: 'Press gently until the string touches the fret.' },
          { label: 'Sound', text: 'Pluck string 1 once.' },
          { label: 'Release', text: 'Ease off, then lift the fingertip just clear of the string.' },
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
        body: ['Lift your finger off the string completely. Then pluck the open string. You should hear E, lower than F.'],
        diagram: { highlight: [1], caption: 'Open string 1 (E4).' },
        attempt: { targetMidi: 64, string: 1, fret: 0, finger: null, required: 1 },
        selfCheckLabel: 'I heard the open E (self-check)',
      },
      {
        id: 'fret-3-intro',
        title: 'Fret 3 gives G',
        kind: 'demo',
        body: [
          'Fret 3 gives G. Use your ring finger. Keep your index finger near fret 1 — your hand stays put and the ring finger reaches.',
          'We skip fret 2 for now.',
        ],
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
          'I can hear the note but can’t see your hand, so listen too.',
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
        body: ['Play the four notes with a rest after each. “Wait for me” pauses at every note until it hears it.'],
        scoreRef: 'exercise.high-e-frets',
        practice: { mode: 'wait', rate: 1 },
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
    nextLessonId: 'lesson.crossing.v1',
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
        body: ['Index finger just behind fret 1 on string 2. Pluck string 2 only — use a small movement so the pick stops before string 1.'],
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
        body: ['Ring finger just behind fret 3 on string 2. Keep your index near fret 1.'],
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
        body: ['Four notes with rests. Next you’ll practise moving between strings 1 and 2.'],
        scoreRef: 'exercise.b-string-frets',
        practice: { mode: 'wait', rate: 1 },
        selfCheckLabel: 'I played along (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: crossing between strings 1 and 2 — the last skill before your first piece.'] },
    ],
  },
];



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
          'Neck and frets: the metal strips across the neck are frets. Frets are counted from the tuning-peg end: fret 1 is nearest the pegs. Pressing a string just behind a fret makes a higher note.',
          'Your fretting hand presses the strings; your picking hand plucks them. (Right-handed players usually fret with the left hand.)',
          'Body and sound hole (or pickups): your picking hand plucks or strums the strings over this area.',
          'Strings are numbered 1 to 6. String 1 is the thinnest and highest-sounding; string 6 is the thickest and lowest.',
        ],
        illustration: 'guitar-parts',
        diagram: { highlight: [1, 6], caption: 'Strings 1 (thinnest, high E) and 6 (thickest, low E).' },
        demoMidis: [64, 40],
        demoLabel: 'Hear string 1, then string 6',
        funny: 'Yes, the “high” string is the one nearest the floor. Guitarists decided this long ago and refuse to discuss it.',
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
          'Sit on a chair without arms. Rest the guitar’s waist on the leg on your picking-hand side (classical players often use the other leg with a footstool).',
          'Keep the guitar upright. To see the strings, lean your head a little rather than tilting the guitar towards you.',
          'Keep your back relaxed and the neck pointing slightly upward. Your fretting hand should not carry the guitar’s weight.',
          'Use a thin or medium pick, or the side of your thumb — both are fine for these lessons.',
          'If anything hurts, stop and rest. Comfortable movement matters more than speed. These instructions are general guidance, not a medical or posture assessment.',
        ],
        diagram: { highlight: [1], caption: 'On screen, string 1 is the top line — the way the neck looks when you glance down at it while playing.' },
      },
      {
        id: 'pick',
        title: 'Holding a pick',
        kind: 'info',
        body: [
          'Hold the pick between the pad of your thumb and the side of your index finger. Let just the tip show, and grip it gently — a loose grip sounds better and tires less.',
          'No pick? The side of your thumb works well for every lesson here.',
        ],
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: tune the guitar (the Tune tab), then make your first sound.'] },
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
    nextLessonId: 'lesson.your-hands.v1',
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
        funny: 'Tapping along to clicks: the one bit of guitar practice you can do on the bus.',
      },
      {
        id: 'play',
        title: 'Three beats and a rest',
        kind: 'practice',
        body: ['Pluck open E on beats 1, 2 and 3 with downstrokes (toward the floor). On beat 4, touch the string to quiet it and keep counting out loud.'],
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
        sequence: { targets: chordTargets(EM), label: 'Pluck' },
        selfCheckLabel: 'Each string rang clearly (self-check)',
      },
      {
        id: 'strum',
        title: 'A gentle strum',
        kind: 'strum-along',
        body: [
          'Hold the pick loosely and let it brush down across all six strings in one smooth move, once per bar on beat 1. Let it ring and keep counting 2, 3, 4.',
          'Strummed chords are not assessed yet — the microphone cannot reliably tell whether every string sounded. Use your ears and the self-check.',
        ],
        diagram: chordDiagram(EM),
        strum: { bpm: 60, bars: ['Em', 'Em', 'Em', 'Em'], shapes: [EM] },
        selfCheckLabel: 'I strummed Em on each bar (self-check)',
        funny: 'Your first chord! Em: two fingers, six strings, maximum moodiness.',
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
    nextLessonId: 'lesson.listen-remember.v1',
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
        sequence: { targets: chordTargets(AM), label: 'Pluck' },
        selfCheckLabel: 'Each played string rang clearly (self-check)',
      },
      {
        id: 'change-prep',
        title: 'How to change shapes',
        kind: 'info',
        body: [
          'From Em to Am, the middle and ring fingers each move one string toward the floor, and the index finger joins on string 2.',
          'Move the fingers together as a shape, slowly. Lift only as much as needed, and start moving right after you strum.',
          'It is normal for changes to feel slow for days. Smooth is better than fast.',
        ],
        diagram: chordDiagram(AM),
      },
      {
        id: 'change',
        title: 'Em ↔ Am, slowly',
        kind: 'strum-along',
        body: ['Strum once on beat 1. When a new chord is next, start moving right after your strum — you have beats 2, 3 and 4. Chord changes are not checked: follow along and self-check.'],
        diagram: chordDiagram(EM),
        strum: { bpm: 50, bars: ['Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'Am', 'Am'], shapes: [EM, AM] },
        selfCheckLabel: 'I made the changes (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: a short ear break — listening and echoing — then more chords.'] },
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
    nextLessonId: 'lesson.chunks-memory.v1',
    steps: [
      {
        id: 'listen',
        title: 'Listen first',
        kind: 'practice',
        body: [
          'Listen to the whole piece. Follow the notes on the lanes: string 1 on top, string 2 below. It uses only notes you know: E, F, G on string 1 and B, C, D on string 2.',
          'A longer note means let it ring: keep counting and don’t pluck again.',
        ],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'listen', rate: 1 },
        selfCheckLabel: 'I listened to it',
      },
      {
        id: 'wait',
        title: 'Play it with the app waiting for you',
        kind: 'practice',
        body: [
          '“Wait for me” stops at every note until it hears it. Take your time — rhythm isn’t checked here. Repeat a bar (in the options) if one spot is tricky.',
          'Going from fret 3 to fret 1? Put finger 1 down early, then lift finger 3.',
        ],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1 },
        selfCheckLabel: 'I played through it (self-check)',
      },
      {
        id: 'fixed',
        title: 'In time, slowly',
        kind: 'practice',
        body: ['Now the music keeps going, at half speed. Count “1 and 2 and” out loud. If you miss a note, keep going and catch the next one. When it goes well twice, the app offers a faster speed.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5 },
        selfCheckLabel: 'I played it in time (self-check)',
      },
      {
        id: 'recall',
        title: 'Fewer hints',
        kind: 'practice',
        body: ['Now the fret numbers are hidden: only the strings show. Trust your ears and your hand.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5, cueLevel: 'reduced' },
        selfCheckLabel: 'I played it with fewer hints (self-check)',
      },
      {
        id: 'memory',
        title: 'From memory',
        kind: 'practice',
        body: ['No notes on screen at all — just the beat. Playing it from memory on a later day marks the piece as remembered.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5, cueLevel: 'none' },
        selfCheckLabel: 'I played it from memory (self-check)',
        funny: 'No notes on screen. Just you, the guitar, and the faint sound of the app holding its breath.',
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
    nextLessonId: 'lesson.e-major.v1',
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
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: E major — your A minor shape, moved over by one string. Keep Morning Steps alive by playing it from memory now and then.'] },
    ],
  },
];


const M2B_LESSONS: Lesson[] = [
  {
    lessonId: 'lesson.your-hands.v1',
    version: 1,
    title: 'Your hands',
    skillId: 'skill.hands.ready',
    prerequisiteSkillIds: ['skill.high-e.open'],
    learningObjective: 'Hold the pick, place the thumb, and hover fingers 1–3 over frets 1–3 without touching the strings.',
    estimatedMinutes: '3–4',
    equipment: ['guitar', 'pick (optional)', 'optional microphone'],
    demonstrationAssets: ['diagrams'],
    scoreRef: null,
    supportedAssessments: ['isolated_pitch'],
    selfCheck: 'My fingers hover without muting the string.',
    successRule: 'Three clear open-E plucks with fingers hovering, or self-check.',
    fallbacks: ['Self-check', 'Short sessions'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.high-e.first-frets.v1',
    steps: [
      {
        id: 'pick',
        title: 'Pick and picking hand',
        kind: 'info',
        body: [
          'Hold the pick between the pad of your thumb and the side of your index finger, with just the tip showing. Grip it gently.',
          'Let your picking forearm rest on the top edge of the guitar body so your hand hangs loosely over the strings.',
        ],
      },
      {
        id: 'fretting',
        title: 'Fretting hand: one finger per fret',
        kind: 'info',
        body: [
          'Rest your thumb on the back of the neck, roughly behind your middle finger. Keep the wrist relaxed and fairly straight.',
          'Hover finger 1 (index) over fret 1, finger 2 over fret 2 and finger 3 over fret 3 — close to the strings but not touching. This is “one finger per fret”.',
          'Short sessions (5–10 minutes) are best at first. Sore fingertips are normal; sharp pain, tingling or numbness are not — stop and rest.',
        ],
        diagram: { highlight: [1], dots: [{ string: 1, fret: 1, finger: 1 }, { string: 1, fret: 2, finger: 2 }, { string: 1, fret: 3, finger: 3 }], caption: 'Fingers 1–3 hovering over frets 1–3 (not pressing).' },
      },
      {
        id: 'hover-check',
        title: 'Hover without touching',
        kind: 'attempt',
        body: ['Keep your fingers hovering and pluck open string 1 three times. If it sounds muffled, a finger is touching the string — lift it a little.'],
        diagram: { highlight: [1], caption: 'Open string 1 while your fingers hover.' },
        attempt: { targetMidi: 64, string: 1, fret: 0, finger: null, required: 3 },
        selfCheckLabel: 'It rang clearly (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: press your first frets on string 1.'] },
    ],
  },
  {
    lessonId: 'lesson.crossing.v1',
    version: 1,
    title: 'Crossing strings 1 and 2',
    skillId: 'skill.crossing.1-2',
    prerequisiteSkillIds: ['skill.b-string.frets-1-3'],
    learningObjective: 'Move between strings 1 and 2 smoothly, preparing the next finger early.',
    estimatedMinutes: '6–8',
    equipment: ['tuned guitar', 'optional microphone'],
    demonstrationAssets: ['synthesized note pairs'],
    scoreRef: 'exercise.first-two-strings',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I can play E→D and C→E without stopping.',
    successRule: 'Each pair heard in order, then the two-string exercise in wait mode.',
    fallbacks: ['Self-check', 'Slower', 'One pair at a time'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.long-notes.v1',
    steps: [
      {
        id: 'e-d',
        title: 'E to D',
        kind: 'sequence',
        body: ['Open string 1 (E), then string 2 at fret 3 (D) with your ring finger. Have the ring finger ready while E rings.'],
        sequence: { targets: [{ targetMidi: 64, string: 1, fret: 0, finger: null, required: 1 }, { targetMidi: 62, string: 2, fret: 3, finger: 3, required: 1 }], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I played E then D (self-check)',
      },
      {
        id: 'c-e',
        title: 'C to E',
        kind: 'sequence',
        body: ['String 2, fret 1 (C), then open string 1 (E). Lift finger 1 as you pluck the open string.'],
        sequence: { targets: [{ targetMidi: 60, string: 2, fret: 1, finger: 1, required: 1 }, { targetMidi: 64, string: 1, fret: 0, finger: null, required: 1 }], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I played C then E (self-check)',
      },
      {
        id: 'd-e-c',
        title: 'D, E, C — the tricky spot',
        kind: 'sequence',
        body: ['This three-note move appears in Morning Steps: D (string 2, fret 3), E (open string 1), C (string 2, fret 1). Put finger 1 down early, while E rings.'],
        sequence: { targets: [{ targetMidi: 62, string: 2, fret: 3, finger: 3, required: 1 }, { targetMidi: 64, string: 1, fret: 0, finger: null, required: 1 }, { targetMidi: 60, string: 2, fret: 1, finger: 1, required: 1 }], playFirst: true, label: 'Play' },
        selfCheckLabel: 'I played D, E, C (self-check)',
      },
      {
        id: 'two-strings',
        title: 'The two-string exercise',
        kind: 'practice',
        body: ['Eight notes across strings 1 and 2. “Wait for me” pauses at each note; when it feels easy, switch to “Keep the beat” in the options.'],
        scoreRef: 'exercise.first-two-strings',
        practice: { mode: 'wait', rate: 1 },
        selfCheckLabel: 'I played it through (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: long notes and rests, then your first piece.'] },
    ],
  },
  {
    lessonId: 'lesson.long-notes.v1',
    version: 1,
    title: 'Long notes and rests',
    skillId: 'skill.rhythm.long-notes',
    prerequisiteSkillIds: ['skill.pulse.quarters'],
    learningObjective: 'Pluck once and let a note ring through two or four counts; keep counting through rests.',
    estimatedMinutes: '4–5',
    equipment: ['guitar', 'optional microphone'],
    demonstrationAssets: ['metronome'],
    scoreRef: 'exercise.long-notes',
    supportedAssessments: ['attack_time', 'isolated_pitch'],
    selfCheck: 'I plucked once per note and kept counting.',
    successRule: 'Attack times in fixed mode, or self-check.',
    fallbacks: ['Count out loud', 'Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.first-piece.v1',
    steps: [
      {
        id: 'counting',
        title: 'How long is a note?',
        kind: 'info',
        body: [
          'A short block is one beat: pluck and count “1”. A longer block lasts two beats: pluck on “1” and let it ring through “2”. The longest lasts a whole bar: “1, 2, 3, 4”.',
          'Pluck only once at the start of each note — the counting does the rest.',
          'On a rest, touch the string to quiet it and keep counting.',
        ],
      },
      {
        id: 'play',
        title: 'Play long notes',
        kind: 'practice',
        body: ['Open E only, so you can focus on counting. Pluck once per note, count out loud, and let long notes ring.'],
        scoreRef: 'exercise.long-notes',
        practice: { mode: 'fixed', rate: 1 },
        selfCheckLabel: 'I counted through (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['You’re ready for your first complete piece.'] },
    ],
  },
  {
    lessonId: 'lesson.chunks-memory.v1',
    version: 1,
    title: 'Learn it in chunks, then from memory',
    skillId: 'skill.piece.morning-steps.memory',
    prerequisiteSkillIds: ['skill.piece.morning-steps'],
    learningObjective: 'Memorise Morning Steps two bars at a time, then play the whole piece without looking.',
    estimatedMinutes: '10 (repeat on a later day)',
    equipment: ['tuned guitar', 'microphone recommended'],
    demonstrationAssets: ['synthesized melody'],
    scoreRef: 'piece.morning-steps',
    supportedAssessments: ['isolated_pitch', 'attack_time'],
    selfCheck: 'I can play Morning Steps without looking.',
    successRule: 'From-memory success with the microphone; retained after a later-day repeat.',
    fallbacks: ['Smaller chunks', 'Wait mode', 'Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.open-strings.v1',
    steps: [
      {
        id: 'bars-1-2-hints',
        title: 'Bars 1–2 with hints',
        kind: 'practice',
        body: ['Play just the first two bars, repeating. Say the note names as you play: “E F G, F E D”.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1, loop: { aTick: 0, bTick: 2 * BAR } },
        selfCheckLabel: 'Bars 1–2 feel easy (self-check)',
      },
      {
        id: 'bars-1-2-memory',
        title: 'Bars 1–2 from memory',
        kind: 'practice',
        body: ['Same two bars — now with no notes on screen.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1, cueLevel: 'none', loop: { aTick: 0, bTick: 2 * BAR } },
        selfCheckLabel: 'I played them from memory (self-check)',
      },
      {
        id: 'bars-3-4-memory',
        title: 'Bars 3–4 from memory',
        kind: 'practice',
        body: ['Bars 3 and 4 (“C D E, rest, D C B”). Listen once with hints if you need to, then hide them.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1, cueLevel: 'reduced', loop: { aTick: 2 * BAR, bTick: 4 * BAR } },
        selfCheckLabel: 'Bars 3–4 from memory (self-check)',
      },
      {
        id: 'quiz-bar-5',
        title: 'Quick check',
        kind: 'quiz',
        body: ['No guitar needed.'],
        quiz: { question: 'Which note starts bar 5?', options: ['B (open string 2)', 'E (open string 1)', 'G (string 1, fret 3)'], answer: 1, explain: 'Bar 5 starts on open E, the same note as bar 1 — the second half begins like the first.' },
      },
      {
        id: 'bars-5-8',
        title: 'Bars 5–8 from memory',
        kind: 'practice',
        body: ['The second half. Start cold from bar 5 — knowing where each half begins is how musicians recover from mistakes.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'wait', rate: 1, cueLevel: 'reduced', loop: { aTick: 4 * BAR, bTick: 8 * BAR } },
        selfCheckLabel: 'Bars 5–8 from memory (self-check)',
      },
      {
        id: 'whole',
        title: 'The whole piece, from memory',
        kind: 'practice',
        body: ['All eight bars, no notes on screen, keeping the beat. Come back tomorrow and do it again — that marks it as remembered.'],
        scoreRef: 'piece.morning-steps',
        practice: { mode: 'fixed', rate: 0.5, cueLevel: 'none' },
        selfCheckLabel: 'I played it all from memory (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['You learned a piece by heart. Next: all six strings, then your first chords.'] },
    ],
  },
  {
    lessonId: 'lesson.open-strings.v1',
    version: 1,
    title: 'All six open strings',
    skillId: 'skill.open-strings.all',
    prerequisiteSkillIds: ['skill.crossing.1-2'],
    learningObjective: 'Name, hear and pluck each open string from 6 to 1, then find them by number.',
    estimatedMinutes: '5',
    equipment: ['tuned guitar', 'optional microphone'],
    demonstrationAssets: ['synthesized open strings'],
    scoreRef: null,
    supportedAssessments: ['isolated_pitch'],
    selfCheck: 'I can find any string by its number.',
    successRule: 'Each open string heard in order, then in mixed order, or self-check.',
    fallbacks: ['Self-check'],
    rights: RIGHTS,
    reviewStatus: 'unreviewed',
    teacherReviewer: null,
    nextLessonId: 'lesson.em-chord.v1',
    steps: [
      {
        id: 'names',
        title: 'Meet the other strings',
        kind: 'demo',
        body: [
          'From thickest to thinnest the open strings are: 6 E (low), 5 A, 4 D, 3 G, 2 B, 1 E (high).',
          'A saying some players use: “Eddie Ate Dynamite, Good Bye Eddie”.',
        ],
        diagram: { highlight: [1, 2, 3, 4, 5, 6], caption: 'All six strings: 1 (thinnest) on top, 6 (thickest) at the bottom.' },
        demoMidis: [40, 45, 50, 55, 59, 64],
        demoLabel: 'Hear strings 6 to 1',
      },
      {
        id: 'six-to-one',
        title: 'Pluck 6 to 1',
        kind: 'sequence',
        body: ['Pluck each open string once, from the thickest (6) to the thinnest (1). Small, controlled movements.'],
        sequence: { targets: ([6, 5, 4, 3, 2, 1] as StringNumber[]).map((n) => ({ targetMidi: openMidi(n), string: n, fret: 0, finger: null, required: 1 })), label: 'Pluck' },
        selfCheckLabel: 'All six rang (self-check)',
      },
      {
        id: 'by-number',
        title: 'Find them by number',
        kind: 'sequence',
        body: ['Now in mixed order: pluck the string with the number shown.'],
        sequence: { targets: ([3, 5, 1, 4, 6, 2] as StringNumber[]).map((n) => ({ targetMidi: openMidi(n), string: n, fret: 0, finger: null, required: 1 })), label: 'Pluck' },
        selfCheckLabel: 'I found them (self-check)',
      },
      { id: 'next', title: 'What next?', kind: 'choice', body: ['Next: your first chord, E minor — you’ll check it one string at a time.'] },
    ],
  },
];

/**
 * Every authored lesson. The order (and so each `nextLessonId`) comes from CHAPTERS
 * (src/learning/chapters.ts). Teacher review: the first complete piece comes before
 * chords (it needs no chord skills).
 */
const AUTHORED: readonly Lesson[] = [
  ...M1_LESSONS,
  ...M2_LESSONS,
  ...M2B_LESSONS,
  ...OPEN_CHORDS_LESSONS,
  ...SONGS_RIFFS_LESSONS,
  ...BLUES_LEAD_LESSONS,
  ...BARRE_THEORY_LESSONS,
  ...HERO_LESSONS,
];

function inChapterOrder(authored: readonly Lesson[], order: readonly string[]): Lesson[] {
  const orphans = authored.filter((l) => !order.includes(l.lessonId)).map((l) => l.lessonId);
  if (orphans.length) throw new Error(`Lessons missing from CHAPTERS: ${orphans.join(', ')}`);
  return order.map((id, i) => {
    const l = authored.find((x) => x.lessonId === id);
    if (!l) throw new Error(`CHAPTERS lists unknown lesson ${id}`);
    return { ...l, nextLessonId: order[i + 1] ?? null };
  });
}

export const LESSONS: readonly Lesson[] = inChapterOrder(AUTHORED, CHAPTER_ORDER);

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.lessonId === id);
}

export const KNOWN_LESSON_IDS: ReadonlySet<string> = new Set(LESSONS.map((l) => l.lessonId));

const STRING_NAMES: Record<StringNumber, string> = {
  1: 'string 1 (high E, thinnest)',
  2: 'string 2 (B)',
  3: 'string 3 (G)',
  4: 'string 4 (D)',
  5: 'string 5 (A)',
  6: 'string 6 (low E, thickest)',
};

/** Specific, evidence-based feedback for a recognized pitch in a single-note attempt. */
export function attemptFeedback(spec: AttemptSpec, heardMidiFloat: number): { correct: boolean; text: string } {
  const heard = Math.round(heardMidiFloat);
  const cents = (heardMidiFloat - spec.targetMidi) * 100;
  const targetName = pitchClassName(spec.targetMidi);
  // Off the nearest semitone by a lot: probably the guitar is out of tune.
  const offTune = Math.abs((heardMidiFloat - heard) * 100) > 35 ? ' It also sounded a little out of tune — a quick visit to Tune may help.' : '';
  if (Math.abs(cents) <= 50) return { correct: true, text: `I heard ${targetName}.${offTune}` };
  const heardName = pitchClassName(heard);
  const targetPlace = spec.fret === 0 ? `open ${STRING_NAMES[spec.string]}` : `${STRING_NAMES[spec.string]}, fret ${spec.fret}`;
  if (Math.abs(Math.abs(cents) - 1200) <= 60) {
    return { correct: false, text: `That sounded like ${heardName}, but ${cents > 0 ? 'higher' : 'lower'} than I expected — I may have misheard. Pluck ${STRING_NAMES[spec.string]} once more and let it ring.` };
  }
  // Fretted note expected, open string heard.
  if (spec.fret > 0 && heard === openMidi(spec.string)) {
    return { correct: false, text: `That sounded like ${heardName} — the open string. The target is ${targetName}: press ${STRING_NAMES[spec.string]} just behind fret ${spec.fret} before plucking.` };
  }
  // Open string expected, a fretted note on the same string heard: something is pressing it.
  if (spec.fret === 0) {
    const fretOnTarget = heard - openMidi(spec.string);
    if (fretOnTarget > 0 && fretOnTarget <= 5) {
      return { correct: false, text: `That sounded like ${heardName} — something may be pressing ${STRING_NAMES[spec.string]}. Make sure no finger touches it, then pluck it open.${offTune}` };
    }
  }
  // Another open string.
  const openOther = ([1, 2, 3, 4, 5, 6] as StringNumber[]).find((s2) => openMidi(s2) === heard && s2 !== spec.string);
  if (openOther) {
    return { correct: false, text: `That sounded like open ${STRING_NAMES[openOther]}. The target is ${targetPlace}.` };
  }
  // Right fret, neighbouring string.
  for (const s2 of [spec.string - 1, spec.string + 1].filter((x) => x >= 1 && x <= 6) as StringNumber[]) {
    if (spec.fret > 0 && openMidi(s2) + spec.fret === heard) {
      return { correct: false, text: `That sounded like ${heardName}: fret ${spec.fret} on ${STRING_NAMES[s2]}, one string away. The target is ${STRING_NAMES[spec.string]}, fret ${spec.fret}.` };
    }
  }
  // Same string, wrong fret: name the fret, not "higher/lower".
  const onTarget = midiToPositions(heard).find((p) => p.string === spec.string);
  if (onTarget && spec.fret > 0) {
    return { correct: false, text: `That sounded like ${heardName}${onTarget.fret > 0 ? ` (fret ${onTarget.fret})` : ''}. The target is ${targetName}: fret ${spec.fret} on ${STRING_NAMES[spec.string]}.${offTune}` };
  }
  return { correct: false, text: `That sounded like ${heardName}. The target is ${targetName}: ${targetPlace}.${offTune}` };
}
