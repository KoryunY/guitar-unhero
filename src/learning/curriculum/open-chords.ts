/**
 * Chapters "Open chords I" (E, A, D), "Strumming basics" and "Open chords II".
 * Chords are only ever checked one string at a time; strummed chords and chord
 * changes are self-checked, never assessed.
 */
import {
  draft, NO_FORCE_STRETCH, REST_HAND, shapeCheck, shapeDemo, SHORT_SESSIONS, SORE_FINGERS, STRUM_NOT_ASSESSED, strumAlong, whatNext,
  type Lesson,
} from './core';
import {
  A7, A_MAJOR, AM, ASUS2, ASUS4, B7, C_MAJOR, D7, D_MAJOR, D_MINOR, DSUS2, DSUS4, E7, E_MAJOR, EM, G_MAJOR,
} from './chords';

const CHORD_EQUIPMENT = ['tuned guitar', 'pick or thumb', 'optional microphone (for the string-by-string check)'];
const STRUM_EQUIPMENT = ['tuned guitar', 'pick (thin or medium) or your thumb'];

// ---------------------------------------------------------------- Open chords I (new)

const E_MAJOR_LESSON = draft({
  lessonId: 'lesson.e-major.v1',
  title: 'E major: A minor’s twin',
  skillId: 'skill.chord.e',
  prerequisiteSkillIds: ['skill.chord.am-change'],
  learningObjective: 'Form E major by moving the Am shape over one string, check each string, and change between Em, E and Am.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string E', 'synthesized G and G♯ comparison'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'All six strings of E rang clearly and I changed between E and Am.',
  successRule: 'Each of the six strings heard at its expected pitch, one at a time, or self-check. Strummed chords and changes are not assessed.',
  fallbacks: ['Self-check', 'Pluck the strings one by one again', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The E major shape', E_MAJOR, [
      'Make your A minor shape. Now move all three fingers over by one string, towards the ceiling, keeping the same frets. That is E major.',
      'Middle finger on string 5 at fret 2, ring finger on string 4 at fret 2, index on string 3 at fret 1. All six strings ring.',
      'Same shape, different strings, different mood: Am sounds thoughtful, E sounds bright.',
    ], {
      phases: [
        { label: 'Prepare', text: 'Make Am, then hover it one string higher.' },
        { label: 'Press', text: 'Index on string 3 first, then middle and ring at fret 2.' },
        { label: 'Sound', text: 'Pluck strings 6 → 1 one at a time.' },
        { label: 'Release', text: 'Relax the hand and shake it loose.' },
      ],
      funny: 'Am and E are the same shape wearing different hats. Guitars love a costume change.',
    }),
    shapeCheck('check', E_MAJOR, [
      'Hold E and pluck strings 6 to 1, one at a time. I listen for each expected note.',
      'If string 3 sounds dull, a finger may be leaning on it — arch your fingers a little more.',
      SORE_FINGERS,
    ]),
    {
      id: 'one-finger',
      title: 'Em → E: one finger',
      kind: 'demo',
      body: [
        'Make Em (middle and ring at fret 2). Add your index finger on string 3, fret 1 — that is E. Lift it — Em again.',
        'Only one note changes, G to G♯, yet the chord goes from dark to bright. That one note is the difference between minor and major.',
      ],
      demoMidis: [55, 56],
      demoLabel: 'Hear the note that changes: G, then G♯',
    },
    strumAlong('em-e', 'Em ↔ E', [
      'Strum once on beat 1 of each bar and let it ring. Add or lift your index finger when the chord changes.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['Em', 'Em', 'E', 'E', 'Em', 'Em', 'E', 'E'], shapes: [EM, E_MAJOR] }),
    strumAlong('am-e', 'Am ↔ E', [
      'Now Am to E: keep the shape and move it across one string. Try to move all three fingers together, like a little stamp.',
      'Start moving right after you strum — you have beats 2, 3 and 4. Strum from string 5 on Am and from string 6 on E.',
    ], { bpm: 50, bars: ['Am', 'Am', 'E', 'E', 'Am', 'Am', 'E', 'E'], shapes: [AM, E_MAJOR] }),
    whatNext('Next: A major — three fingers sharing one fret.'),
  ],
});

const A_MAJOR_LESSON = draft({
  lessonId: 'lesson.a-major.v1',
  title: 'A major: three fingers, one fret',
  skillId: 'skill.chord.a',
  prerequisiteSkillIds: ['skill.chord.e'],
  learningObjective: 'Form A major with three fingers at fret 2, check strings 5 → 1, and change between A and E.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string A'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Strings 5 to 1 of A rang clearly and I changed between A and E.',
  successRule: 'Strings 5 → 1 heard at their expected pitches, one at a time, or self-check. Changes are not assessed.',
  fallbacks: ['Self-check', 'Try another fingering', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The A major shape', A_MAJOR, [
      'A major: index on string 4, middle on string 3, ring on string 2 — all at fret 2. Strings 5 and 1 ring open. Do not play string 6.',
      'Three fingers in one fret is a squeeze. Angle them slightly, with the index a little further from the fret than the ring finger. That is normal.',
      'Other fingerings are fine too: middle-ring-index, or (much later) one finger flat across all three strings.',
    ], {
      phases: [
        { label: 'Prepare', text: 'Hover three fingertips over fret 2.' },
        { label: 'Press', text: 'Index (string 4), middle (string 3), ring (string 2).' },
        { label: 'Sound', text: 'Pluck strings 5 → 1 one at a time.' },
        { label: 'Release', text: 'Relax all three together.' },
      ],
      funny: 'Three fingers, one fret. It is like a lift built for two, and everyone is being very polite about it.',
    }),
    shapeCheck('check', A_MAJOR, [
      'Pluck strings 5 to 1 one at a time and skip string 6.',
      'String 1 is the one that usually gets muted. If it does, curl your ring finger so its pad stays off string 1.',
    ]),
    strumAlong('a-e', 'A ↔ E', [
      'Strum from string 5 for A and from string 6 for E. These two chords are best friends; you will meet them together a lot.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 55, bars: ['A', 'A', 'E', 'E', 'A', 'A', 'E', 'E'], shapes: [A_MAJOR, E_MAJOR] }),
    {
      id: 'rest',
      title: 'Shake it out',
      kind: 'info',
      body: [SHORT_SESSIONS, SORE_FINGERS],
      funny: 'Your fingertips are building callouses. It is construction work: expect some grumbling from the site.',
    },
    whatNext('Next: D major, the little triangle.'),
  ],
});

const D_MAJOR_LESSON = draft({
  lessonId: 'lesson.d-major.v1',
  title: 'D major: the little triangle',
  skillId: 'skill.chord.d',
  prerequisiteSkillIds: ['skill.chord.a'],
  learningObjective: 'Form D major on the four thinnest strings, check each one, aim the strum, and change between D, A and E.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string D'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Strings 4 to 1 of D rang clearly and I strummed D, A and E in a loop.',
  successRule: 'Strings 4 → 1 heard at their expected pitches, one at a time, or self-check. Strumming is not assessed.',
  fallbacks: ['Self-check', 'Strum more slowly to aim', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The D major shape', D_MAJOR, [
      'D major uses only the four thinnest strings. Index on string 3 at fret 2, ring on string 2 at fret 3, middle on string 1 at fret 2. Your fingers make a small triangle.',
      'Strum from string 4 (open D). Strings 5 and 6 have an x: leave them out.',
    ], {
      phases: [
        { label: 'Prepare', text: 'Hover the triangle: index, then ring, then middle.' },
        { label: 'Press', text: 'Fingertips upright so string 1 is not touched by the ring finger.' },
        { label: 'Sound', text: 'Pluck strings 4 → 1 one at a time.' },
        { label: 'Release', text: 'Relax.' },
      ],
    }),
    shapeCheck('check', D_MAJOR, [
      'Pluck strings 4, 3, 2, 1. If string 1 is muted, your ring finger may be lying on it — come up onto the fingertip.',
    ]),
    {
      id: 'aiming',
      title: 'Aiming the strum',
      kind: 'info',
      body: [
        'Strumming only four strings takes aim. Start the strum just above string 4 and let it fall through to string 1.',
        'Hitting string 5 or 6 sometimes is normal — aim improves with repetition. Watch the strings for a few strums, then try without looking.',
      ],
      funny: 'Clipping string 6 on a D chord is a rite of passage. Some rites of passage are louder than others.',
    },
    strumAlong('d-a', 'D ↔ A', [
      'One strum per bar: D from string 4, A from string 5.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 55, bars: ['D', 'D', 'A', 'A', 'D', 'D', 'A', 'A'], shapes: [D_MAJOR, A_MAJOR] }),
    strumAlong('d-a-e', 'D, A, E', [
      'Three chords now: D, A, E and back to A. This little loop already sounds like a song.',
      'If a change is too quick, keep strumming the old chord and catch up on the next bar.',
    ], { bpm: 55, bars: ['D', 'D', 'A', 'A', 'E', 'E', 'A', 'A'], shapes: [D_MAJOR, A_MAJOR, E_MAJOR] }),
    whatNext('That completes Open chords I: five chord shapes! Next: proper strumming.'),
  ],
});

// ---------------------------------------------------------------- Strumming basics

const STRUM_DOWNS = draft({
  lessonId: 'lesson.strum-downs.v1',
  title: 'Down strums on the beat',
  skillId: 'skill.strum.downs',
  prerequisiteSkillIds: ['skill.chord.am-change', 'skill.pulse.quarters'],
  learningObjective: 'Strum steady down strums on every beat with a relaxed arm, and keep them going through a chord change.',
  estimatedMinutes: '5–7',
  equipment: [...STRUM_EQUIPMENT, 'keyboard or touch screen for the tap warm-up'],
  demonstrationAssets: ['metronome clicks'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'I strummed down on every beat and kept going through the changes.',
  successRule: 'Tap warm-up: ≥75 % of taps near a click. Strumming is self-checked (not assessed).',
  fallbacks: ['Count out loud', 'Strum only on beat 1', 'Lower the tempo by tapping first'],
  steps: [
    {
      id: 'motion',
      title: 'The strumming motion',
      kind: 'info',
      body: [
        'Strumming is a relaxed swing from the elbow with a loose wrist — like shaking water off your hand, but slower.',
        'Hold the pick loosely with just the tip showing, and let it brush the strings rather than dig in. If the pick spins in your fingers, grip a little firmer; if your hand aches, grip softer.',
        'A down strum moves towards the floor, from the thickest string the chord uses to the thinnest.',
      ],
      funny: 'If you are strumming from the shoulder like you are starting a lawnmower, the lawnmower is winning.',
    },
    {
      id: 'tap',
      title: 'Feel the beat first',
      kind: 'tap-pulse',
      body: ['Tap along with the clicks first — no guitar needed. Count “1, 2, 3, 4” out loud.'],
      pulse: { bpm: 70, beats: 8 },
      selfCheckLabel: 'I tapped along (self-check)',
    },
    strumAlong('em-quarters', 'Em: four down strums per bar', [
      'Hold Em and strum down once on every click: “1, 2, 3, 4”. Keep the arm moving at an even speed.',
      'Pattern: D D D D — down on every beat. The screen flashes STRUM on beat 1; strum on the other beats too.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 70, bars: ['Em', 'Em', 'Em', 'Em'], shapes: [EM], pattern: 'D-D-D-D-' }),
    strumAlong('em-am', 'Keep strumming through the change', [
      'Same down strums, now changing Em → Am every two bars. Strum from string 5 on Am.',
      'Beginner trick: on beat 4 before a change, lift your fingers early and strum the open strings. It keeps the beat going while your hand travels — professionals do it too.',
    ], { bpm: 60, bars: ['Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'Am', 'Am'], shapes: [EM, AM], pattern: 'D-D-D-D-' }),
    whatNext('Next: down-up strumming — the pendulum.'),
  ],
});

const STRUM_DOWN_UP = draft({
  lessonId: 'lesson.strum-down-up.v1',
  title: 'Down-up: the pendulum',
  skillId: 'skill.strum.eighths',
  prerequisiteSkillIds: ['skill.strum.downs'],
  learningObjective: 'Strum eighth notes — down on the beat, up on “and” — with a hand that never stops moving, including ghost strums.',
  estimatedMinutes: '5–7',
  equipment: STRUM_EQUIPMENT,
  demonstrationAssets: ['metronome clicks'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'My hand kept moving down and up, even on the missed strums.',
  successRule: 'Quiz answered; strumming is self-checked (not assessed).',
  fallbacks: ['Say the pattern out loud', 'Down strums only', 'Slower'],
  steps: [
    {
      id: 'pendulum',
      title: 'The pendulum',
      kind: 'info',
      body: [
        'Count “1 and 2 and 3 and 4 and”. Your hand moves down on the numbers and up on every “and”.',
        'The secret: the hand never stops. It swings down and up like a pendulum the whole time; strums are just the moments the pick touches the strings.',
        'Up strums are lighter and usually catch only the top three or four strings. That is correct — do not try to hit all six on the way up.',
      ],
      funny: 'Your strumming hand is now a pendulum. Pendulums do not take breaks mid-bar. Pendulums are very committed.',
    },
    strumAlong('eighths', 'Eighths on E', [
      'Pattern: D U D U D U D U — down on the numbers, up on the “ands”. Hold E major.',
      'Even and relaxed beats loud and fast.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['E', 'E', 'E', 'E'], shapes: [E_MAJOR], pattern: 'DUDUDUDU' }),
    strumAlong('ghost', 'Ghost strums', [
      'Keep the hand moving, but miss the strings on some strums. Pattern: D - D U D - D U (“-” means the hand moves down but misses).',
      'That missed strum is called a ghost strum. It keeps you in time.',
    ], { bpm: 60, bars: ['A', 'A', 'D', 'D', 'A', 'A', 'D', 'D'], shapes: [A_MAJOR, D_MAJOR], pattern: 'D-DUD-DU' }),
    {
      id: 'quiz-up',
      title: 'Quick check',
      kind: 'quiz',
      body: ['No guitar needed.'],
      quiz: {
        question: 'You are strumming eighths. Which way does your hand move on “and”?',
        options: ['Down', 'Up', 'It stops and waits'],
        answer: 1,
        explain: 'Up on the “ands”, down on the numbers — and it never stops in between.',
      },
    },
    whatNext('Next: three strum patterns that fit a huge number of songs.'),
  ],
});

const STRUM_PATTERNS = draft({
  lessonId: 'lesson.strum-patterns.v1',
  title: 'Three patterns for a thousand songs',
  skillId: 'skill.strum.patterns',
  prerequisiteSkillIds: ['skill.strum.eighths'],
  learningObjective: 'Play three common strum patterns over chord loops, keeping the pendulum going, including a muted “chuck”.',
  estimatedMinutes: '8–10',
  equipment: STRUM_EQUIPMENT,
  demonstrationAssets: ['metronome clicks'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'I can play patterns 1 and 2 without stopping, and pattern 3 slowly.',
  successRule: 'Self-check (strumming is not assessed).',
  fallbacks: ['Go back to pattern 1', 'Say the pattern out loud first', 'One chord only'],
  steps: [
    {
      id: 'how-to-read',
      title: 'Reading a pattern',
      kind: 'info',
      body: [
        'Each pattern has eight slots: “1 & 2 & 3 & 4 &”. D = down, U = up, - = miss (the hand still moves), x = a muted “chuck”.',
        'Say the pattern out loud before you play it. If your mouth can do it, your hand can learn it.',
      ],
      funny: 'Muttering “down, down-up, up-down-up” in public is how guitarists find each other.',
    },
    strumAlong('pattern-1', 'Pattern 1: the starter', [
      'D - D - D U D U: down on 1 and 2, then down-up on 3 and 4.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['D', 'D', 'A', 'A', 'D', 'D', 'A', 'A'], shapes: [D_MAJOR, A_MAJOR], pattern: 'D-D-DUDU' }),
    strumAlong('pattern-2', 'Pattern 2: the classic', [
      'D - D U - U D U: “down, down-up, up-down-up”. The miss on beat 3 is the tricky bit — keep the hand moving down, just miss the strings.',
      'This one turns up in pop, folk and campfire songs everywhere.',
    ], { bpm: 56, bars: ['A', 'A', 'E', 'E', 'A', 'A', 'E', 'E'], shapes: [A_MAJOR, E_MAJOR], pattern: 'D-DU-UDU' }),
    strumAlong('pattern-3', 'Pattern 3: the chuck', [
      'D - x U D - x U: down on 1, chuck on 2, up, down on 3, chuck on 4, up.',
      'For the chuck, let the side of your strumming hand land on the strings as you strum down, so they click instead of ring. A slightly messy chuck still keeps the groove.',
    ], { bpm: 60, bars: ['Em', 'Em', 'Am', 'Am', 'Em', 'Em', 'Am', 'Am'], shapes: [EM, AM], pattern: 'D-xUD-xU' }),
    {
      id: 'choose',
      title: 'Mix and match',
      kind: 'info',
      body: [
        'Every pattern works with any chord. If a pattern feels hard, go back to pattern 1 — simplifying is never wrong.',
        REST_HAND,
      ],
    },
    whatNext('Next: the one-minute changes game.'),
  ],
});

const ONE_MINUTE_CHANGES = draft({
  lessonId: 'lesson.one-minute-changes.v1',
  title: 'One-minute changes',
  skillId: 'skill.chord.changes',
  prerequisiteSkillIds: ['skill.chord.d', 'skill.strum.downs'],
  learningObjective: 'Count and improve how many clean chord changes you can make in one minute for the pairs you find hardest.',
  estimatedMinutes: '5 (repeat daily for a week)',
  equipment: [...STRUM_EQUIPMENT, 'a timer, pen and paper (optional)'],
  demonstrationAssets: ['metronome clicks'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'I counted my changes for at least one chord pair and wrote the number down.',
  successRule: 'Self-check (chord changes are not assessed).',
  fallbacks: ['Practise the change without strumming', 'Pick an easier pair', 'Rest and try tomorrow'],
  steps: [
    {
      id: 'game',
      title: 'The game',
      kind: 'info',
      body: [
        'Pick two chords. Strum one once, change, strum the other once. Count how many changes you make in one minute.',
        'Only clean-ish changes count: the strings you need should ring. Speed comes from relaxed, efficient movement, not from rushing.',
        'Remember your number and try to beat it next time. The app does not check chord changes — this is an honour-system game.',
      ],
      funny: 'It is a race with one runner, who is also the referee, the timekeeper and the crowd.',
    },
    {
      id: 'tips',
      title: 'Change smarter',
      kind: 'info',
      body: [
        'Move the fingers as one shape rather than one at a time, and lift them only a few millimetres.',
        'Look for shared movements: E → Am keeps the same shape, Em → E adds one finger.',
        'Practise the change without strumming first: shape, release, next shape, release — ten times. Then add the strum.',
      ],
    },
    strumAlong('a-d', 'A ↔ D, every bar', [
      'One strum per bar, a new chord every bar. At 64 BPM these 16 bars take about a minute.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 64, bars: ['A', 'D', 'A', 'D', 'A', 'D', 'A', 'D', 'A', 'D', 'A', 'D', 'A', 'D', 'A', 'D'], shapes: [A_MAJOR, D_MAJOR], pattern: 'D-------' }),
    strumAlong('e-a', 'E ↔ A, every bar', [
      'Same game with E and A.',
    ], { bpm: 64, bars: ['E', 'A', 'E', 'A', 'E', 'A', 'E', 'A', 'E', 'A', 'E', 'A', 'E', 'A', 'E', 'A'], shapes: [E_MAJOR, A_MAJOR], pattern: 'D-------' }),
    strumAlong('d-e', 'The tricky pair: D ↔ E', [
      'D and E share nothing, so this is the hard one. Slower tempo; aim for clean, not fast.',
    ], { bpm: 56, bars: ['D', 'E', 'D', 'E', 'D', 'E', 'D', 'E'], shapes: [D_MAJOR, E_MAJOR], pattern: 'D-------' }),
    {
      id: 'rest',
      title: 'Rest and come back',
      kind: 'info',
      body: [
        'A few minutes a day for a week and the numbers go up — often a lot. Then retire that pair and pick a new one.',
        SORE_FINGERS,
      ],
    },
    whatNext('Next: boss fight! A whole song form with everything from this chapter.'),
  ],
});

const VERSE_STOMP = ['A', 'D', 'A', 'E', 'A', 'D', 'E', 'A'];
const CHORUS_STOMP = ['D', 'A', 'E', 'A', 'D', 'A', 'E', 'E'];

const BOSS_CHORD_STOMP = draft({
  lessonId: 'lesson.boss-chord-stomp.v1',
  title: 'Boss fight: the Chord Stomp',
  skillId: 'skill.boss.chord-stomp',
  prerequisiteSkillIds: ['skill.strum.patterns', 'skill.chord.changes'],
  learningObjective: 'Play an original 16-bar song form (verse and chorus) with two strum patterns, and recall the chord order from memory.',
  estimatedMinutes: '8–10',
  equipment: STRUM_EQUIPMENT,
  demonstrationAssets: ['metronome clicks'],
  scoreRef: null,
  supportedAssessments: [],
  selfCheck: 'I played the verse and chorus through without stopping, and answered the recall questions.',
  successRule: 'Recall questions answered; strumming is self-checked (not assessed).',
  fallbacks: ['Use pattern 1 throughout', 'Verse only', 'One strum per bar'],
  steps: [
    {
      id: 'map',
      title: 'The map',
      kind: 'info',
      body: [
        'Verse (8 bars): A | D | A | E | A | D | E | A — pattern 1 (D - D - D U D U).',
        'Chorus (8 bars): D | A | E | A | D | A | E | E — pattern 2 (D - D U - U D U).',
        'Read it once, say the chords out loud in rhythm, then play.',
      ],
      funny: 'This boss is built entirely out of A, D and E — the exact chords you have been training on. Suspicious? No. Planned.',
    },
    strumAlong('verse', 'Verse', ['Pattern 1. Eyes on the next chord name, not your hand.', STRUM_NOT_ASSESSED],
      { bpm: 64, bars: VERSE_STOMP, shapes: [A_MAJOR, D_MAJOR, E_MAJOR], pattern: 'D-D-DUDU' }),
    strumAlong('chorus', 'Chorus', ['Pattern 2. The two bars of E at the end pull you back to the verse.'],
      { bpm: 64, bars: CHORUS_STOMP, shapes: [A_MAJOR, D_MAJOR, E_MAJOR], pattern: 'D-DU-UDU' }),
    {
      id: 'recall-verse',
      title: 'From memory: the verse',
      kind: 'quiz',
      body: ['No peeking at the map.'],
      quiz: { question: 'What is the fourth chord of the verse?', options: ['D', 'E', 'A'], answer: 1, explain: 'A | D | A | E — the verse breathes out on E in bar 4, then comes home to A at the end.' },
    },
    {
      id: 'recall-chorus',
      title: 'From memory: the chorus',
      kind: 'quiz',
      body: ['One more.'],
      quiz: { question: 'How does the chorus end?', options: ['On A', 'On two bars of E', 'On D'], answer: 1, explain: 'Two bars of E leave the chorus hanging, which pulls you back into the verse.' },
    },
    strumAlong('full', 'The whole song', [
      'Verse then chorus, 16 bars. Switch from pattern 1 to pattern 2 at the chorus — or keep pattern 1 throughout; the boss accepts that.',
      'Try to glance at the chord names only when you are lost.',
    ], { bpm: 64, bars: [...VERSE_STOMP, ...CHORUS_STOMP], shapes: [A_MAJOR, D_MAJOR, E_MAJOR], pattern: 'D-D-DUDU' }),
    whatNext('Boss defeated — Strumming basics complete! Next: G, C and more open chords.'),
  ],
});

// ---------------------------------------------------------------- Open chords II

const G_MAJOR_LESSON = draft({
  lessonId: 'lesson.g-major.v1',
  title: 'G major: the big stretch',
  skillId: 'skill.chord.g',
  prerequisiteSkillIds: ['skill.chord.changes'],
  learningObjective: 'Form G major across all six strings, check each string, and change between G, D and Em.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string G'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'All six strings of G rang and I changed between G, D and Em.',
  successRule: 'Each string heard at its expected pitch, one at a time, or self-check. Changes are not assessed.',
  fallbacks: ['Self-check', 'Try the other fingering', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The G major shape', G_MAJOR, [
      'G major uses all six strings. Middle finger on string 6 at fret 3, index on string 5 at fret 2, ring on string 1 at fret 3. Strings 4, 3 and 2 ring open.',
      'The reach from string 6 to string 1 is wide at first. Let your thumb sit a little lower on the back of the neck.',
      'Another common fingering uses ring and little fingers on strings 6 and 1. Both are correct; pick whichever feels better.',
    ], {
      phases: [
        { label: 'Prepare', text: 'Thumb low behind the neck, fingers hovering.' },
        { label: 'Press', text: 'Middle (string 6), index (string 5), ring (string 1).' },
        { label: 'Sound', text: 'Pluck strings 6 → 1 one at a time.' },
        { label: 'Release', text: 'Relax and shake out.' },
      ],
    }),
    shapeCheck('check', G_MAJOR, [
      'Pluck 6 → 1. Strings 4, 3 and 2 are open: if one is muted, a finger is leaning on it — arch more, or tilt the index finger.',
      NO_FORCE_STRETCH,
    ]),
    strumAlong('g-d', 'G ↔ D', ['Pattern 1: D - D - D U D U. Strum all six strings for G, four for D.', STRUM_NOT_ASSESSED],
      { bpm: 60, bars: ['G', 'G', 'D', 'D', 'G', 'G', 'D', 'D'], shapes: [G_MAJOR, D_MAJOR], pattern: 'D-D-DUDU' }),
    strumAlong('g-em', 'G ↔ Em', [
      'Trick: play Em with index and middle (index on string 5, middle on string 4). Then the index finger stays put between G and Em.',
    ], { bpm: 60, bars: ['G', 'G', 'Em', 'Em', 'G', 'G', 'Em', 'Em'], shapes: [G_MAJOR, EM], pattern: 'D-D-DUDU' }),
    whatNext('Next: C major — the diagonal one.'),
  ],
});

const C_MAJOR_LESSON = draft({
  lessonId: 'lesson.c-major.v1',
  title: 'C major: the diagonal',
  skillId: 'skill.chord.c',
  prerequisiteSkillIds: ['skill.chord.g'],
  learningObjective: 'Form C major, check strings 5 → 1, and change to Am (one finger moves) and to G.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string C and Am'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Strings 5 to 1 of C rang and I changed between C, Am and G.',
  successRule: 'Strings 5 → 1 heard at their expected pitches, one at a time, or self-check. Changes are not assessed.',
  fallbacks: ['Self-check', 'Practise Am ↔ C first', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The C major shape', C_MAJOR, [
      'C major: ring on string 5 at fret 3, middle on string 4 at fret 2, index on string 2 at fret 1. Strings 3 and 1 ring open. Do not play string 6.',
      'It is a diagonal shape. Keep the fingertips upright so the open string 3 can ring underneath your fingers.',
    ]),
    shapeCheck('check', C_MAJOR, [
      'Pluck strings 5 → 1. String 3 is the usual victim: if it is muted, the middle finger is leaning on it.',
      NO_FORCE_STRETCH,
    ]),
    {
      id: 'am-c',
      title: 'Am → C: move one finger',
      kind: 'demo',
      body: [
        'Make Am. Now move only your ring finger, from string 3 at fret 2 to string 5 at fret 3. That is C. Index and middle stay exactly where they are.',
        'Chords that share fingers make the easiest changes. Always look for them.',
      ],
      demoMidis: [45, 52, 57, 60, 64, 48, 52, 55, 60, 64],
      demoLabel: 'Hear Am, then C (string by string)',
      funny: 'C and Am are flatmates. They share almost everything, and they argue about one finger.',
    },
    strumAlong('c-am', 'C ↔ Am', ['Pattern 1. Only the ring finger travels.', STRUM_NOT_ASSESSED],
      { bpm: 60, bars: ['C', 'C', 'Am', 'Am', 'C', 'C', 'Am', 'Am'], shapes: [C_MAJOR, AM], pattern: 'D-D-DUDU' }),
    strumAlong('c-g', 'C ↔ G', [
      'C to G is a bigger move: all three fingers travel. Go slowly and land the lowest note first.',
    ], { bpm: 56, bars: ['C', 'C', 'G', 'G', 'C', 'C', 'G', 'G'], shapes: [C_MAJOR, G_MAJOR], pattern: 'D-D-DUDU' }),
    whatNext('Next: D minor — D major’s moody sibling.'),
  ],
});

const D_MINOR_LESSON = draft({
  lessonId: 'lesson.d-minor.v1',
  title: 'D minor: the moody one',
  skillId: 'skill.chord.dm',
  prerequisiteSkillIds: ['skill.chord.d', 'skill.chord.c'],
  learningObjective: 'Form Dm, hear the one-note difference from D, and play the A minor family: Am, Dm, E.',
  estimatedMinutes: '5–7',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string Dm', 'synthesized F♯/F comparison'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'Strings 4 to 1 of Dm rang and I played Am – Dm – E.',
  successRule: 'Strings 4 → 1 heard at their expected pitches, one at a time, or self-check. Changes are not assessed.',
  fallbacks: ['Self-check', 'Switch D ↔ Dm first', 'Change every other bar'],
  steps: [
    shapeDemo('shape', 'The Dm shape', D_MINOR, [
      'Dm: index on string 1 at fret 1, middle on string 3 at fret 2, ring on string 2 at fret 3. Strum strings 4 → 1.',
      'Compare with D major: the note on string 1 moves from fret 2 to fret 1. One fret, whole new mood.',
    ]),
    shapeCheck('check', D_MINOR, ['Pluck strings 4 → 1. The index finger on string 1 needs its very tip so it does not touch string 2.']),
    {
      id: 'major-minor',
      title: 'Hear the difference',
      kind: 'demo',
      body: ['Play D, then Dm. The note that changes (F♯ → F) is the chord’s third, and it decides major (bright) or minor (darker).'],
      demoMidis: [66, 65],
      demoLabel: 'Hear F♯, then F',
      funny: 'Minor chords: for when your guitar wants to stare out of a rainy window.',
    },
    strumAlong('am-dm-e', 'The A minor family: Am, Dm, E', [
      'Am, Dm and E are the core chords of A minor. The E at the end pulls strongly back to Am — listen for it.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['Am', 'Am', 'Dm', 'Dm', 'E', 'E', 'Am', 'Am'], shapes: [AM, D_MINOR, E_MAJOR], pattern: 'D-D-DUDU' }),
    whatNext('Next: seventh chords — the bluesy, restless ones.'),
  ],
});

const SEVENTH_CHORDS = draft({
  lessonId: 'lesson.seventh-chords.v1',
  title: 'Seventh chords: E7, A7, D7, B7',
  skillId: 'skill.chord.sevenths',
  prerequisiteSkillIds: ['skill.chord.e', 'skill.chord.a', 'skill.chord.d'],
  learningObjective: 'Play E7 and A7 by lifting a finger from E and A, learn the D7 and B7 shapes, and strum a bluesy loop.',
  estimatedMinutes: '8–10',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized string-by-string E7, D7 and B7'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'E7 and B7 rang string by string and I strummed the E7–A7–B7 loop.',
  successRule: 'E7 and B7 strings heard one at a time, or self-check. Strumming is not assessed.',
  fallbacks: ['Self-check', 'Leave B7 for another day', 'Use E and A instead of E7 and A7'],
  steps: [
    shapeDemo('what', 'Restless chords: E7 and A7', E7, [
      'A dominant 7 chord adds one extra note to a major chord. It sounds bluesy and restless — it wants to move somewhere.',
      'E7 and A7 are “subtraction” chords: make E and lift your ring finger (string 4 now rings open) — E7. Make A and lift your middle finger off string 3 — A7.',
    ]),
    shapeCheck('check-e7', E7, ['Pluck 6 → 1. The open string 4 is the note that makes the 7.']),
    shapeDemo('d7', 'D7: the triangle flipped', D7, [
      'D7: index on string 2 at fret 1, middle on string 3 at fret 2, ring on string 1 at fret 2. Strum strings 4 → 1.',
      'It looks like the D triangle turned upside down.',
    ]),
    shapeDemo('b7', 'B7: four fingers', B7, [
      'B7: middle on string 5 at fret 2, index on string 4 at fret 1, ring on string 3 at fret 2, little finger on string 1 at fret 2. String 2 rings open; skip string 6.',
      'Place one finger at a time and check, then try placing them together.',
      NO_FORCE_STRETCH,
    ], { funny: 'B7 is the first chord that asks for your little finger. Your little finger has been ignoring the guitar so far. That ends today.' }),
    shapeCheck('check-b7', B7, ['Pluck strings 5 → 1. String 2 must ring open under your fingers.']),
    strumAlong('blues-teaser', 'A bluesy loop', [
      'E7, A7, E7, B7 — a taste of the blues chapter to come. Pattern: D - D U D - D U.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'B7'], shapes: [E7, A7, B7], pattern: 'D-DUD-DU' }),
    whatNext('Next: sus chords — decorations you add with one finger.'),
  ],
});

const SUS_CHORDS = draft({
  lessonId: 'lesson.sus-chords.v1',
  title: 'Sus chords: one-finger decorations',
  skillId: 'skill.chord.sus',
  prerequisiteSkillIds: ['skill.chord.d', 'skill.chord.a'],
  learningObjective: 'Decorate D and A with sus2 and sus4 by adding or lifting one finger, keeping the base shape down.',
  estimatedMinutes: '6–8',
  equipment: CHORD_EQUIPMENT,
  demonstrationAssets: ['synthesized D/Dsus4/Dsus2 and A/Asus4/Asus2 top notes'],
  scoreRef: null,
  supportedAssessments: ['isolated_pitch'],
  selfCheck: 'I decorated D and A with sus4 and sus2 in time.',
  successRule: 'Dsus4 strings heard one at a time, or self-check. Strumming is not assessed.',
  fallbacks: ['Self-check', 'Decorate D only', 'Slower'],
  steps: [
    {
      id: 'sus',
      title: 'Suspended chords',
      kind: 'info',
      body: [
        'A sus chord swaps the chord’s third for a neighbour: sus2 (a step lower) or sus4 (a step higher). It sounds open and unresolved — then you return to the plain chord.',
        'On D and A you can do it with one finger. Players use this trick to make a single chord sound like a whole riff.',
      ],
    },
    shapeDemo('dsus', 'Dsus4 and Dsus2', DSUS4, [
      'From D: add your little finger on string 1, fret 3 — Dsus4. Lift it — D. Now lift your middle finger off string 1 completely — Dsus2 (string 1 rings open).',
    ], { demoMidis: [66, 67, 66, 64], demoLabel: 'Hear D → Dsus4 → D → Dsus2 (string 1 only)' }),
    shapeCheck('check-dsus4', DSUS4, ['Pluck 4 → 1 with Dsus4. The little-finger note (G) on string 1 should ring clearly.']),
    shapeDemo('asus', 'Asus4 and Asus2', ASUS4, [
      'From A: add your little finger on string 2, fret 3 — Asus4. Lift it — A. Lift your ring finger off string 2 — Asus2 (string 2 rings open).',
    ], { demoMidis: [61, 62, 61, 59], demoLabel: 'Hear A → Asus4 → A → Asus2 (string 2 only)' }),
    strumAlong('decorate', 'Decorate D and A', [
      'One bar each: D, Dsus4, D, Dsus2, then A, Asus4, A, Asus2. Keep the base shape down and move only the decorating finger.',
      STRUM_NOT_ASSESSED,
    ], { bpm: 60, bars: ['D', 'Dsus4', 'D', 'Dsus2', 'A', 'Asus4', 'A', 'Asus2'], shapes: [D_MAJOR, DSUS4, DSUS2, A_MAJOR, ASUS4, ASUS2], pattern: 'D-DU-UDU' },
    { funny: 'Sus chords are the guitar raising one eyebrow. Then lowering it. Very dramatic, very cheap.' }),
    whatNext('Open chords II complete! Next: how chords turn into songs.'),
  ],
});

export const OPEN_CHORDS_LESSONS: readonly Lesson[] = [
  E_MAJOR_LESSON, A_MAJOR_LESSON, D_MAJOR_LESSON,
  STRUM_DOWNS, STRUM_DOWN_UP, STRUM_PATTERNS, ONE_MINUTE_CHANGES, BOSS_CHORD_STOMP,
  G_MAJOR_LESSON, C_MAJOR_LESSON, D_MINOR_LESSON, SEVENTH_CHORDS, SUS_CHORDS,
];
