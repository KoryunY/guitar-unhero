/**
 * Chapters "Barre chords" (fretboard notes, the small F, the full F boss fight,
 * movable E- and A-shapes, Bm) and "Theory you'll actually use" (intervals,
 * major scale, keys and chord tones, CAGED). Theory always connects to a sound
 * or a movement; quizzes can be retried freely.
 */
import {
  chordDiagram, draft, NO_FORCE_STRETCH, REST_HAND, shapeCheck, shapeDemo, SHORT_SESSIONS, SORE_FINGERS, STRUM_NOT_ASSESSED, strumAlong, target, whatNext,
  type Lesson,
} from './core';
import { A_MAJOR, AM, AM_BARRE, BM, C_BARRE, C_MAJOR, D_MAJOR, F_BARRE, F_SMALL, G_BARRE, G_MAJOR } from './chords';

const BARRE_EQUIPMENT = ['tuned guitar', 'optional microphone (for the string-by-string check)'];

// ---------------------------------------------------------------- Barre chords

const FRETBOARD_NOTES = draft({
  lessonId: 'lesson.fretboard-notes.v1',
  title: 'Notes on strings 6 and 5',
  skillId: 'skill.fretboard.low-notes',
  prerequisiteSkillIds: ['skill.notes.low-strings'],
  learningObjective: 'Name and find the natural notes on strings 6 and 5 up to fret 12 — the roots of every movable chord.',
  estimatedMinutes: '8–10',
  equipment: ['tuned guitar', 'microphone recommended'],
  demonstrationAssets: [],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'I can find G, A, B, C, D and E on string 6, and C, D, E, F, G, A on string 5.',
  successRule: 'Each note heard in order, or self-check; quiz questions answered.',
  fallbacks: ['Self-check', 'Count up from the open string', 'Use the fret markers'],
  steps: [
    {
      id: 'alphabet',
      title: 'The musical alphabet',
      kind: 'info',
      body: [
        'Notes go A B C D E F G, then back to A. Between most neighbours there is an extra note (a sharp ♯ or flat ♭) one fret away — except between B and C, and between E and F, which are only one fret apart.',
        'So along string 6: E (open), F (1), F♯ (2), G (3), G♯ (4), A (5), A♯ (6), B (7), C (8), C♯ (9), D (10), D♯ (11), E (12) — and then it repeats.',
        'The dots on the neck (usually frets 3, 5, 7, 9 and 12) are your landmarks.',
      ],
      funny: 'B–C and E–F skip the in-between note. There is a long historical reason involving medieval monks. You do not need it to rock.',
    },
    {
      id: 'string-6',
      title: 'Landmarks on string 6',
      kind: 'sequence',
      body: ['Find the natural notes on string 6: G (3), A (5), B (7), C (8), D (10), E (12). Say each name out loud as you play it. Any finger is fine.'],
      sequence: { targets: [target(6, 3), target(6, 5), target(6, 7), target(6, 8), target(6, 10), target(6, 12)], label: 'Play' },
      selfCheckLabel: 'I found them (self-check)',
    },
    {
      id: 'string-5',
      title: 'Landmarks on string 5',
      kind: 'sequence',
      body: ['String 5 starts on A: B (2), C (3), D (5), E (7), F (8), G (10), A (12).'],
      sequence: { targets: [target(5, 2), target(5, 3), target(5, 5), target(5, 7), target(5, 8), target(5, 10), target(5, 12)], label: 'Play' },
      selfCheckLabel: 'I found them (self-check)',
    },
    {
      id: 'q1',
      title: 'Quick check: string 6',
      kind: 'quiz',
      body: ['No guitar needed.'],
      quiz: { question: 'What note is at string 6, fret 5?', options: ['G', 'A', 'C'], answer: 1, explain: 'E (open), F (1), F♯ (2), G (3), G♯ (4), A (5).' },
    },
    {
      id: 'q2',
      title: 'Quick check: string 5',
      kind: 'quiz',
      body: ['One more.'],
      quiz: { question: 'You want a C power chord with the root on string 5. Which fret?', options: ['Fret 1', 'Fret 3', 'Fret 8'], answer: 1, explain: 'String 5 is A: A (open), A♯ (1), B (2), C (3). Fret 8 is C on string 6.' },
    },
    whatNext('Next: barre prep — the small F.'),
  ],
});

const MINI_F = draft({
  lessonId: 'lesson.mini-f.v1',
  title: 'Barre prep: the small F',
  skillId: 'skill.barre.mini-f',
  prerequisiteSkillIds: ['skill.chord.c', 'skill.harmony.four-chord'],
  learningObjective: 'Barre two strings with the index finger in the small F shape, check each string, and change between C and F.',
  estimatedMinutes: '6–8',
  equipment: BARRE_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string F'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'All four strings of the small F rang and I changed between C and F.',
  successRule: 'Strings 4 → 1 heard at their expected pitches, one at a time, or self-check. Changes are not assessed.',
  fallbacks: ['Self-check', 'Use Fmaj7 for now', 'Short tries with rests'],
  steps: [
    {
      id: 'barre',
      title: 'What is a barre?',
      kind: 'info',
      body: [
        'In a barre, one finger (usually the index) presses several strings at the same fret — like a capo made of finger.',
        'Start small: the small F barres only strings 2 and 1. Lay the index finger flat across both at fret 1, roll it slightly onto its bony side (towards the headstock), and keep it close to the fret.',
        NO_FORCE_STRETCH,
      ],
    },
    shapeDemo('shape', 'The small F', F_SMALL, [
      'Index across strings 2 and 1 at fret 1, middle on string 3 at fret 2, ring on string 4 at fret 3. Strum strings 4 → 1.',
      'From Fmaj7 you only need to flatten the index finger over string 1 as well.',
    ]),
    shapeCheck('check', F_SMALL, [
      'Pluck strings 4 → 1. If string 1 buzzes or dies, roll the index a little and move it closer to the fret wire — rather than squeezing harder.',
    ]),
    strumAlong('c-f', 'C ↔ F', ['I–IV in C, now with a real F. Pattern 1.', STRUM_NOT_ASSESSED],
      { bpm: 60, bars: ['C', 'C', 'F', 'F', 'C', 'C', 'F', 'F'], shapes: [C_MAJOR, F_SMALL], pattern: 'D-D-DUDU' }),
    {
      id: 'rest',
      title: 'Rest is part of the workout',
      kind: 'info',
      body: [SHORT_SESSIONS, 'Barres tire the hand quickly at first. Shake out after a minute or so; strength builds over weeks, not minutes.'],
      funny: 'Your index finger has just been promoted to “capo”. It did not ask for this promotion. Be patient with it.',
    },
    whatNext('Next: boss fight — the full F chord.'),
  ],
});

const BOSS_F = draft({
  lessonId: 'lesson.boss-f-chord.v1',
  title: 'Boss fight: the F chord',
  skillId: 'skill.barre.f',
  prerequisiteSkillIds: ['skill.barre.mini-f', 'skill.fretboard.low-notes'],
  learningObjective: 'Build the full six-string F barre with leverage rather than force, troubleshoot dead strings, and use F in a progression.',
  estimatedMinutes: '8–10 (revisit for a minute a day)',
  equipment: BARRE_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string F'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Most strings of the full F rang, and I played C – F – G – C (small F allowed).',
  successRule: 'F strings heard one at a time (any progress counts), or self-check. Strumming is not assessed.',
  fallbacks: ['Small F instead', 'Index barre alone first', 'A minute a day for a week'],
  steps: [
    {
      id: 'legend',
      title: 'The legend of F',
      kind: 'info',
      body: [
        'The full F barre chord has made more people quit guitar than any other chord. You are not going to be one of them, because you are going to be clever about it.',
        'Full F: index flat across all six strings at fret 1; middle on string 3 at fret 2; ring on string 5 at fret 3; little finger on string 4 at fret 3. It is the E shape moved up one fret, with the index finger acting as the nut.',
      ],
      funny: 'The F chord is the final boss of your first guitar year. It has no weak spot. You will win anyway, by stubbornness.',
    },
    {
      id: 'leverage',
      title: 'Win with leverage, not squeezing',
      kind: 'info',
      body: [
        'Thumb low on the back of the neck, roughly behind the middle finger.',
        'Index finger straight and close to the fret, rolled a little onto its harder edge.',
        'Let a little arm weight pull the hand gently back towards you instead of crushing with the thumb.',
        'The index only really needs to press strings 6, 2 and 1 — the other strings are pressed by other fingers.',
        NO_FORCE_STRETCH,
      ],
    },
    shapeDemo('shape', 'The full F', F_BARRE, [
      'Build it in two steps: first the index barre alone (pluck each string), then add the other three fingers.',
    ]),
    shapeCheck('check', F_BARRE, [
      'Pluck strings 6 → 1. Note which strings are muffled, then adjust only that finger. Two or three clear strings today is a real result.',
      'Hold the shape for a few seconds, then release completely. Never hold a barre until it hurts.',
    ]),
    {
      id: 'troubleshoot',
      title: 'Troubleshooting',
      kind: 'info',
      body: [
        'String 2 or 1 dead? A crease of your index finger may sit on it — slide the index up or down a few millimetres.',
        'String 3 dead? The middle finger needs to be more upright.',
        'Strings 5 or 4 buzzing? The ring or little finger needs to be closer to the fret.',
        'Everything buzzing? Rest. Seriously — tired hands make barre chords worse.',
        SORE_FINGERS,
      ],
    },
    strumAlong('song', 'C – F – G – C', [
      'Your reward: F in a real progression. Cannot get the full F clean yet? Use the small F — the boss accepts substitutions.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['C', 'C', 'F', 'F', 'G', 'G', 'C', 'C'], shapes: [C_MAJOR, F_BARRE, G_MAJOR], pattern: 'D-D-DUDU' }),
    whatNext('Boss mostly defeated! Visit F for a minute a day. Next: move this shape anywhere.'),
  ],
});

const E_SHAPE = draft({
  lessonId: 'lesson.e-shape-barre.v1',
  title: 'Movable chords: the E shape',
  skillId: 'skill.barre.e-shape',
  prerequisiteSkillIds: ['skill.barre.f'],
  learningObjective: 'Slide the E-shape barre to name any major chord by its root on string 6, and make it minor by lifting one finger.',
  estimatedMinutes: '6–8',
  equipment: BARRE_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string G and Am barres'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'I played G at fret 3 and Am at fret 5 and slid between them.',
  successRule: 'G barre strings heard one at a time, or self-check. Strumming is not assessed.',
  fallbacks: ['Self-check', 'Partial barre (top four strings)', 'Rest and retry'],
  steps: [
    {
      id: 'idea',
      title: 'One shape, twelve chords',
      kind: 'info',
      body: [
        'Your F is an E-shape barre: the open E chord moved up, with the index finger as the new nut. Slide it, and the root on string 6 names the chord.',
        'Fret 3 = G, fret 5 = A, fret 7 = B, fret 8 = C — straight from your notes on string 6.',
        'Lift the middle finger and it becomes minor (the Em shape): fret 3 = Gm, fret 5 = Am.',
      ],
    },
    shapeDemo('g', 'G at fret 3', G_BARRE, [
      'Same shape as F, two frets higher. Frets get closer together up the neck, so this is often easier than F.',
    ], { funny: 'Plot twist: fret 1 is the hardest place to play this shape. The F chord knew this all along and said nothing.' }),
    shapeCheck('check-g', G_BARRE, ['Pluck 6 → 1 and fix one string at a time.']),
    shapeDemo('am', 'Minor: A minor at fret 5', AM_BARRE, [
      'Lift the middle finger: now the index holds string 3 too. That is the Em shape barred at fret 5 — A minor.',
    ]),
    strumAlong('move', 'Slide it around', [
      'Am at fret 5 (minor shape) to G at fret 3 (major shape): slide down two frets and put the middle finger down.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 64, bars: ['Am', 'Am', 'G', 'G', 'Am', 'Am', 'G', 'G'], shapes: [AM_BARRE, G_BARRE], pattern: 'D-DU-UDU' }),
    whatNext('Next: the A shape, and B minor.'),
  ],
});

const A_SHAPE = draft({
  lessonId: 'lesson.a-shape-barre.v1',
  title: 'Movable chords: the A shape and Bm',
  skillId: 'skill.barre.a-shape',
  prerequisiteSkillIds: ['skill.barre.e-shape'],
  learningObjective: 'Play A-shape barre chords with the root on string 5, including Bm, and use them in I–V–vi–IV in D.',
  estimatedMinutes: '8–10',
  equipment: BARRE_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string Bm and C'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Bm rang string by string and I played D – A – Bm – G.',
  successRule: 'Bm strings heard one at a time, or self-check. Strumming is not assessed.',
  fallbacks: ['Self-check', 'Bm on the top four strings only', 'Rest and retry'],
  steps: [
    {
      id: 'idea',
      title: 'The root on string 5',
      kind: 'info',
      body: [
        'The A chord can be barred too: index across strings 5 to 1 at a fret, with the A shape two frets higher. The root is on string 5.',
        'Fret 2 = B, fret 3 = C, fret 5 = D. The minor version uses the Am shape — B minor at fret 2 is the famous one.',
      ],
    },
    shapeDemo('bm', 'B minor', BM, [
      'Index across strings 5 to 1 at fret 2; ring on string 4 and little finger on string 3, both at fret 4; middle on string 2 at fret 3. Strum 5 → 1.',
      NO_FORCE_STRETCH,
    ]),
    shapeCheck('check-bm', BM, ['Pluck 5 → 1. String 1 (index barre) is the usual problem — roll the index slightly.']),
    shapeDemo('c', 'C at fret 3 (A shape)', C_BARRE, [
      'Major A shape at fret 3: index barre at fret 3, and middle, ring and little fingers on strings 4, 3 and 2 at fret 5.',
      'Some players flatten the ring finger across all three strings instead; string 1 often gets muted that way, and that is fine.',
    ]),
    strumAlong('d-loop', 'The four-chord loop in D', [
      'With Bm you can finally play I–V–vi–IV in D: D – A – Bm – G.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 66, bars: ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G'], shapes: [D_MAJOR, A_MAJOR, BM, G_MAJOR], pattern: 'D-DU-UDU' }),
    whatNext('Barre chords complete! Next: theory you’ll actually use.'),
  ],
});

// ---------------------------------------------------------------- Theory you'll actually use

const INTERVALS = draft({
  lessonId: 'lesson.intervals.v1',
  title: 'Intervals by ear',
  skillId: 'skill.theory.intervals',
  prerequisiteSkillIds: ['skill.ear.basic', 'skill.power-chords'],
  learningObjective: 'Hear and play half steps, whole steps, fifths and octaves, and echo a root–fifth–octave phrase.',
  estimatedMinutes: '6–8',
  equipment: ['headphones recommended', 'guitar for the echo'],
  demonstrationAssets: ['synthesized intervals'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'I can tell a fifth from an octave by ear.',
  successRule: 'Higher/lower ≥4 of 6; interval questions answered; echo heard in order, or self-check.',
  fallbacks: ['Replay the notes', 'Sing them', 'Self-check'],
  steps: [
    {
      id: 'what',
      title: 'Distances between notes',
      kind: 'info',
      body: [
        'An interval is the distance between two notes. On one string, each fret is a semitone (half step); two frets make a whole step.',
        'You already know two intervals by sound: the fifth is your power chord, and the octave is the same note, higher (12 frets up — or two strings over and two frets up).',
      ],
    },
    {
      id: 'warm-up',
      title: 'Higher or lower? (wider range)',
      kind: 'ear-compare',
      body: ['Two notes: which one was higher? No guitar needed.'],
      ear: { rounds: 6, pool: [45, 50, 52, 55, 57, 60, 64], seed: 21 },
    },
    {
      id: 'q-fifth',
      title: 'Fifth or octave? (1)',
      kind: 'quiz',
      body: ['Play the two notes, then answer. Replay as often as you like.'],
      demoMidis: [45, 52],
      demoLabel: 'Play the interval',
      quiz: { question: 'Is that a fifth or an octave?', options: ['A fifth (power chord sound)', 'An octave (same note, higher)'], answer: 0, explain: 'A to E is a fifth — the two notes of an A5 power chord.' },
    },
    {
      id: 'q-octave',
      title: 'Fifth or octave? (2)',
      kind: 'quiz',
      body: ['Another one.'],
      demoMidis: [45, 57],
      demoLabel: 'Play the interval',
      quiz: { question: 'Is that a fifth or an octave?', options: ['A fifth (power chord sound)', 'An octave (same note, higher)'], answer: 1, explain: 'A to A is an octave. It sounds like the same note, only higher.' },
    },
    {
      id: 'q-step',
      title: 'Half step or whole step?',
      kind: 'quiz',
      body: ['Small distances now.'],
      demoMidis: [57, 59],
      demoLabel: 'Play the interval',
      quiz: { question: 'Is that a half step (1 fret) or a whole step (2 frets)?', options: ['Half step', 'Whole step'], answer: 1, explain: 'A to B is a whole step: two frets.' },
      funny: 'If this one is tricky: half steps sound like a shark film. Whole steps sound like the start of a nursery song.',
    },
    {
      id: 'echo',
      title: 'Echo: root, fifth, octave',
      kind: 'sequence',
      body: ['Listen, then play it back: A (open string 5), E (string 4, fret 2), A (string 3, fret 2).'],
      sequence: { targets: [target(5, 0), target(4, 2, 2), target(3, 2, 2)], playFirst: true, label: 'Play' },
      selfCheckLabel: 'I echoed it (self-check)',
    },
    whatNext('Next: the major scale — do-re-mi.'),
  ],
});

const MAJOR_SCALE = draft({
  lessonId: 'lesson.major-scale.v1',
  title: 'The major scale (do-re-mi)',
  skillId: 'skill.theory.major-scale',
  prerequisiteSkillIds: ['skill.theory.intervals'],
  learningObjective: 'Learn the major-scale step pattern and play C major in open position, up and down.',
  estimatedMinutes: '6–8',
  equipment: ['tuned guitar', 'microphone recommended'],
  demonstrationAssets: ['synthesized C major scale'],
  scoreRef: 'scale.c-major-open',
  supportedAssessments: ['isolated_pitch', 'attack_time'],
  selfCheck: 'I can play C major up and down and say where the half steps are.',
  successRule: 'Scale with ≥60 % assessed pitches, or self-check; quiz answered.',
  fallbacks: ['Wait mode', 'Up only', 'Self-check'],
  steps: [
    {
      id: 'formula',
      title: 'The recipe',
      kind: 'info',
      body: [
        'The major scale is do-re-mi-fa-so-la-ti-do. Its recipe of steps: whole, whole, half, whole, whole, whole, half.',
        'Start on C and use only the natural notes (no sharps or flats) and you get exactly that recipe: C D E F G A B C. The half steps fall at E–F and B–C.',
      ],
    },
    {
      id: 'hear',
      title: 'Hear it',
      kind: 'demo',
      body: ['Listen and sing along if you like — you already know this sound.'],
      demoMidis: [48, 50, 52, 53, 55, 57, 59, 60],
      demoLabel: 'Hear C major, do to do',
    },
    {
      id: 'wait',
      title: 'C major in open position',
      kind: 'practice',
      body: ['From C on string 5 (fret 3) up to C on string 2 (fret 1) and back down. “Wait for me” checks each note.'],
      scoreRef: 'scale.c-major-open',
      practice: { mode: 'wait', rate: 1 },
      selfCheckLabel: 'I played it through (self-check)',
    },
    {
      id: 'fixed',
      title: 'In time',
      kind: 'practice',
      body: ['Half speed. Say the note names as you go.', REST_HAND],
      scoreRef: 'scale.c-major-open',
      practice: { mode: 'fixed', rate: 0.5 },
      selfCheckLabel: 'I played it in time (self-check)',
    },
    {
      id: 'q',
      title: 'Quick check',
      kind: 'quiz',
      body: ['No guitar needed.'],
      quiz: { question: 'In the major scale, where are the half steps?', options: ['Between notes 3–4 and 7–8', 'Between notes 1–2 and 5–6', 'There are none'], answer: 0, explain: 'Mi–fa and ti–do: in C, that is E–F and B–C.' },
    },
    whatNext('Next: keys, chord families and chord tones.'),
  ],
});

const KEYS_CHORD_TONES = draft({
  lessonId: 'lesson.keys-chord-tones.v1',
  title: 'Keys, chord families and chord tones',
  skillId: 'skill.theory.keys',
  prerequisiteSkillIds: ['skill.theory.major-scale'],
  learningObjective: 'Build a key’s chord family from its scale, and pick out the chord tones (1, 3, 5) of C and Am.',
  estimatedMinutes: '6–8',
  equipment: ['tuned guitar', 'microphone recommended'],
  demonstrationAssets: [],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'I can name the chords in G and play the notes of a C chord one at a time.',
  successRule: 'Quiz answered; chord tones heard in order, or self-check.',
  fallbacks: ['Self-check', 'Write the scale down first'],
  steps: [
    {
      id: 'family',
      title: 'A key is a family of chords',
      kind: 'info',
      body: [
        'Build a chord on each note of the major scale using only that scale’s notes, and you get the key’s chord family: I ii iii IV V vi vii° — major, minor, minor, major, major, minor, diminished.',
        'In C: C, Dm, Em, F, G, Am, B°. In G: G, Am, Bm, C, D, Em, F♯°.',
        'That is why I–IV–V and I–V–vi–IV work: they are all members of one family.',
      ],
    },
    {
      id: 'q-g',
      title: 'Quick check',
      kind: 'quiz',
      body: ['No guitar needed.'],
      quiz: { question: 'In the key of G, what is the vi chord?', options: ['Em', 'E', 'Am'], answer: 0, explain: 'G (I), Am (ii), Bm (iii), C (IV), D (V), Em (vi).' },
    },
    {
      id: 'tones',
      title: 'Chord tones',
      kind: 'info',
      body: [
        'A major chord is its scale’s 1st, 3rd and 5th notes. C major = C, E, G. Every C chord shape you will ever play is just those three notes arranged differently.',
        'In a solo, landing on a note of the current chord sounds “right”. That is the secret behind melodic solos.',
      ],
      funny: 'Chord tones are the VIP list. Other notes can come to the party, but they should not stay too long.',
    },
    {
      id: 'c-tones',
      title: 'Pick out C, E, G',
      kind: 'sequence',
      body: ['Hold your C chord and pick just the chord tones, low to high: C (string 5, fret 3), E (string 4, fret 2), G (open string 3).'],
      diagram: chordDiagram(C_MAJOR),
      sequence: { targets: [target(5, 3, 3), target(4, 2, 2), target(3, 0)], playFirst: true, label: 'Play' },
      selfCheckLabel: 'I played them (self-check)',
    },
    {
      id: 'am-tones',
      title: 'Am: A, C, E',
      kind: 'sequence',
      body: ['Am = A, C, E. Hold Am and pick: A (open string 5), C (string 2, fret 1), E (open string 1).'],
      diagram: chordDiagram(AM),
      sequence: { targets: [target(5, 0), target(2, 1, 1), target(1, 0)], playFirst: true, label: 'Play' },
      selfCheckLabel: 'I played them (self-check)',
    },
    whatNext('Next: CAGED — a map of the whole neck (an optional route).'),
  ],
});

const CAGED = draft({
  lessonId: 'lesson.caged.v1',
  title: 'CAGED: a map of the neck',
  skillId: 'skill.theory.caged',
  prerequisiteSkillIds: ['skill.barre.a-shape', 'skill.theory.keys'],
  learningObjective: 'See how the five open shapes (C, A, G, E, D) move up the neck, and find one chord in three places.',
  estimatedMinutes: '5–7',
  equipment: ['tuned guitar'],
  demonstrationAssets: ['synthesized C chords'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'I can play C in three places on the neck.',
  successRule: 'Quiz questions answered; playing is self-checked.',
  fallbacks: ['Skip for now — CAGED is optional'],
  steps: [
    {
      id: 'idea',
      title: 'Five shapes, one neck',
      kind: 'info',
      body: [
        'C, A, G, E and D — open chord shapes you know — can each be moved up the neck with a barre, like your E- and A-shape barre chords.',
        'For any chord, the five shapes link up along the neck in the order C-A-G-E-D, each one starting where the last ended. Together they cover the whole fretboard.',
        'This is an optional map, not a rule. Plenty of great players never use the name.',
      ],
      funny: 'CAGED sounds like a heavy-metal band. It is actually a filing system. Then again, the best filing systems are a little bit metal.',
    },
    {
      id: 'c-three',
      title: 'One chord, three places',
      kind: 'demo',
      body: ['C major lives at the nut (C shape), at fret 3 (A shape barre) and at fret 8 (E shape barre). Same three notes — C, E, G — in different positions.'],
      diagram: chordDiagram(C_MAJOR),
      demoMidis: [48, 52, 55, 60, 64],
      demoLabel: 'Hear the open C shape',
    },
    shapeDemo('c-a', 'C with the A shape at fret 3', C_BARRE, ['You have met this one: the A shape barred at fret 3. Then try the E shape at fret 8 — root on string 6.']),
    {
      id: 'q1',
      title: 'Quick check',
      kind: 'quiz',
      body: ['No guitar needed.'],
      quiz: { question: 'You barre the E shape with your index at fret 8. What chord is it?', options: ['A', 'C', 'G'], answer: 1, explain: 'The root is on string 6, fret 8 — that is C.' },
    },
    {
      id: 'q2',
      title: 'Quick check: roots',
      kind: 'quiz',
      body: ['One more.'],
      quiz: { question: 'Which barre shape has its root on string 5?', options: ['The E shape', 'The A shape', 'Neither'], answer: 1, explain: 'A shape: root on string 5. E shape: root on string 6.' },
    },
    whatNext('Theory chapter complete! Next: Knockoff Hero.'),
  ],
});

export const BARRE_THEORY_LESSONS: readonly Lesson[] = [
  FRETBOARD_NOTES, MINI_F, BOSS_F, E_SHAPE, A_SHAPE,
  INTERVALS, MAJOR_SCALE, KEYS_CHORD_TONES, CAGED,
];
