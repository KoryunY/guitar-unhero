/**
 * Humor voice. A voice line is an optional EXTRA line shown next to the plain
 * instruction or status text — never a replacement for it, so no line carries
 * information the learner needs. 'plain' means no joke at all (null).
 *
 * 'funny': warm, dry, self-deprecating app humour.
 * 'metal': over the top, ALL-CAPS bursts, mild swearing; it roasts the guitar,
 * the amp, the microphone or the universe — never the learner. No slurs, no
 * sexual content, no jokes about nationality or ethnicity. Safety lines (rest,
 * pain, volume) stay on the side of stopping and resting.
 */

export type VoiceStyle = 'plain' | 'funny' | 'metal';

export type VoiceEvent =
  | 'first_launch'
  | 'welcome_back'
  | 'lesson_start'
  | 'lesson_complete'
  | 'step_correct'
  | 'step_wrong'
  | 'streak_3'
  | 'streak_10'
  | 'uncertain'
  | 'mic_off'
  | 'tuner_in_tune'
  | 'tuner_far'
  | 'tuner_start'
  | 'practice_great'
  | 'practice_ok'
  | 'practice_rough'
  | 'rank_up'
  | 'chapter_complete'
  | 'boss_fight'
  | 'rest_break'
  | 'empty_songs'
  | 'song_imported'
  | 'chord_change'
  | 'metal_unlocked'
  | 'sore_fingers';

export const VOICE_EVENTS: readonly VoiceEvent[] = [
  'first_launch', 'welcome_back', 'lesson_start', 'lesson_complete', 'step_correct', 'step_wrong', 'streak_3', 'streak_10',
  'uncertain', 'mic_off', 'tuner_in_tune', 'tuner_far', 'tuner_start', 'practice_great', 'practice_ok', 'practice_rough',
  'rank_up', 'chapter_complete', 'boss_fight', 'rest_break', 'empty_songs', 'song_imported', 'chord_change', 'metal_unlocked',
  'sore_fingers',
];

/** For a Settings picker. */
export const VOICE_STYLES: readonly { id: VoiceStyle; label: string; description: string }[] = [
  { id: 'plain', label: 'Plain', description: 'Just the instructions. No jokes.' },
  { id: 'funny', label: 'Funny', description: 'A dry, friendly joke now and then, next to the instructions.' },
  { id: 'metal', label: 'Metal', description: 'LOUD. Over the top. Mild swearing. Roasts the guitar, never you.' },
];

type Lines = Record<VoiceEvent, readonly string[]>;

const FUNNY: Lines = {
  first_launch: [
    'Hi. I am an app that listens to you play guitar. I promise to be nicer about it than your neighbours.',
    'Welcome! Statistically, this guitar has spent most of its life as a very expensive coat rack. Today, that changes.',
    'No experience needed. I had none either, and look at me now: an app.',
    'Every guitar legend started out unable to play anything. You are already level with them on that.',
    'Let’s begin. Bring a guitar, some patience and at least one finger.',
    'Hello! I will be your teacher, your metronome and your very quiet fan.',
    'Welcome. Seatbelts are optional. Tuning is not.',
  ],
  welcome_back: [
    'You’re back! The guitar pretended not to miss you. It did.',
    'Welcome back. Your fingers remember more than you think. Your strings, less so.',
    'Oh hey, it’s you. I kept your progress warm.',
    'Back again? Excellent. Consistency beats talent, and talent is quietly furious about it.',
    'Welcome back. I haven’t changed a bit. I’m software.',
    'Good to see you. A few minutes today is how legends are slowly assembled.',
  ],
  lesson_start: [
    'New lesson. Small steps — nobody is timing you. Not even me.',
    'Here we go. Slow is smooth, smooth is fast, fast is for later.',
    'Lesson time. Your guitar has been briefed.',
    'If this feels clumsy at first, that is the feeling of learning. Annoying, but correct.',
    'Sitting comfortably? Guitar in tune? Snacks safely out of reach of the strings?',
    'A fresh lesson. Like a fresh set of strings, but free.',
  ],
  lesson_complete: [
    'Lesson complete. Your guitar is visibly impressed. (It is hard to tell with guitars.)',
    'Done! That is one more thing you can do than yesterday.',
    'Finished. I would give you a sticker, but I am an app. Imagine a very shiny sticker.',
    'Lesson complete. Go on, tell someone. They will not understand, but tell them.',
    'Nice work. Your future self says thanks.',
    'That’s a wrap. Somewhere, a metronome is proud of you.',
  ],
  step_correct: [
    'Yes! That’s the one.',
    'Nailed it. Figuratively. Please keep nails away from the guitar.',
    'Correct. I am trying to stay professional, but: yay.',
    'That’s it. Do that again and it becomes a habit.',
    'Spot on. The microphone and I agree, which is rare.',
    'Correct. Beautiful comes later; correct comes first.',
  ],
  step_wrong: [
    'Close! Wrong note, right attitude.',
    'Not quite. That note was perfectly nice; it just belongs to a different lesson.',
    'Nope — but that is how every right note starts its career.',
    'Almost. Guitars have a lot of notes, and only some of them are in this lesson.',
    'Not that one. No harm done; the guitar has already forgotten.',
    'Missed it. Totally normal. Even I miss things, and I am made of rules.',
  ],
  streak_3: [
    'Three in a row! That’s a pattern, and patterns are how skills happen.',
    'Three right. Careful, you are starting to look like a guitarist.',
    'Hat trick! Please do not throw a hat at the guitar.',
    'Three for three. I’m cautiously thrilled.',
    'Three in a row. Your hands are learning while you are not looking.',
    'Streak of three. I’d do a little dance, but I have no legs.',
  ],
  streak_10: [
    'Ten in a row! I need to sit down. I am always sitting down. I’m software.',
    'Ten straight. At this point the guitar is just agreeing with you.',
    'Ten! That is not luck any more; that’s practice paying rent.',
    'Ten in a row. Somebody frame this moment.',
    'A ten-note streak. Your fingers clearly read the lesson too.',
    'Ten! Please remember me when you’re famous.',
  ],
  uncertain: [
    'I heard something, but I couldn’t tell what. That one is on me, not you.',
    'My ears are only a microphone. One more pluck?',
    'That was a mystery note. Mysteries never count against you.',
    'I didn’t catch that one clearly. No penalty, just another go.',
    'That sound was a bit blurry to me. Not a miss — I simply don’t know.',
    'I’m not sure what that was. Neither of us is in trouble.',
  ],
  mic_off: [
    'The microphone is off, so I am just here for moral support.',
    'I can’t hear you right now. I trust you.',
    'Mic off. Honour system activated.',
    'Listening is off. I’ll be over here, being a very supportive screen.',
    'No mic, no problem. You are the judge for now. A fair one, I assume.',
    'I’m not listening at the moment, which is the most polite thing an app can say.',
  ],
  tuner_in_tune: [
    'In tune! Enjoy it; strings are not famous for their loyalty.',
    'Perfect. That string is now officially well-adjusted.',
    'In tune. One string down, emotionally.',
    'Spot on. That is the sound of a string doing its job.',
    'Tuned. Your future self, playing chords, thanks you.',
    'In tune. Tiny turns: the secret nobody tells you.',
  ],
  tuner_far: [
    'That’s quite far off. Strings are dramatic; small turns calm them down.',
    'Way out of tune. Guitars do this purely to get attention.',
    'Pretty far. A classic: turning the peg of a different string. We have all done it.',
    'Not close yet. Turn a little, pluck, listen. Repeat. Very zen.',
    'That string has wandered off. Let’s bring it home gently.',
    'Far off. Guitars dislike weather, travel and, apparently, sitting still.',
  ],
  tuner_start: [
    'Let’s tune. The least glamorous part of guitar, and the most important.',
    'Tuning time. Every great performance starts with someone frowning at a peg.',
    'Playing out of tune is like baking with salt instead of sugar. Technically food.',
    'A quick tune-up. Your ears will thank you, and so will mine.',
    'Tuning: the guitar version of brushing your teeth.',
    'Let’s get these six strings agreeing with each other. Diplomacy time.',
  ],
  practice_great: [
    'That was great. I’d clap, but — again — no hands.',
    'Excellent run. The guitar is purring. Guitars can’t purr. And yet.',
    'Brilliant. Save some talent for tomorrow.',
    'That went really well. The neighbours may now be fans. Possibly.',
    'Great playing. If anyone asks, you have “always been musical”.',
    'Superb. Adding this to my list of favourite runs. You are on it twice.',
  ],
  practice_ok: [
    'Solid run. A few wobbles — which is exactly where the learning lives.',
    'Good! Not perfect, which is fine; perfect is boring anyway.',
    'Decent. Another go or two and it’ll be smooth.',
    'Nice. Some notes went their own way, but the plan held.',
    'Pretty good. Your hands are catching up with your brain.',
    'That was the honest kind of okay that turns into good.',
  ],
  practice_rough: [
    'That one was rough. It happens to everyone, especially the people who get good.',
    'Tricky run. Slow is not a punishment; it is a cheat code.',
    'That was a wrestling match and the guitar won this round. Rematch?',
    'Rough patch. Your brain is rewiring; please excuse the construction noise.',
    'Not your best, and that is allowed. Even legends have rehearsals.',
    'Messy! Messy is where skills are made. Tidy comes later.',
  ],
  rank_up: [
    'New rank! Please update your business cards.',
    'You ranked up. I have informed absolutely nobody, but I am proud.',
    'Promotion! Comes with no salary but excellent vibes.',
    'Rank up! Your guitar would like to be addressed by its new title too.',
    'New title unlocked. You have earned the right to be slightly smug.',
    'Rank up. The committee (me) voted unanimously.',
  ],
  chapter_complete: [
    'Chapter complete! If this were a book you could put it down. It isn’t.',
    'That’s a whole chapter. Take a bow — mind the headstock.',
    'Chapter done. You now know things you didn’t know you didn’t know.',
    'Another chapter in the bag. The bag is getting heavy. Good sign.',
    'Chapter complete. A small party has been scheduled in your honour. It’s you, playing guitar.',
    'End of chapter. Your fingertips have filed a report: “tougher”.',
  ],
  boss_fight: [
    'Boss fight! Don’t panic: this boss is made entirely of things you have practised.',
    'A boss appears. It looks scary, but it is mostly bluff and a few chords.',
    'Boss fight. Slow is allowed, retries are unlimited. The boss knows this and is worried.',
    'This is a review lesson wearing a cape. You’ve got this.',
    'Boss time! The boss has no health bar, and you have unlimited lives.',
    'Here comes the boss. It has been told you are quite good now.',
  ],
  rest_break: [
    'Break time. Shake your hands out; they have been working hard.',
    'Rest your fingers. A lot of learning settles in during the breaks — free practice!',
    'Short break. The guitar can wait; it is very patient.',
    'Pause. Drink some water. Guitars don’t need to, but you do.',
    'A break! Look at something far away. Not the guitar. Further.',
    'Rest. Legends are mostly made of short sessions and good breaks.',
  ],
  empty_songs: [
    'No songs yet. This list is so empty it echoes.',
    'Your song shelf is bare. Add one and I will stop making this joke.',
    'Nothing here yet. Very minimalist. Very zen. Very empty.',
    'No songs. A blank page, like a notebook bought with great intentions.',
    'Empty. Your future favourite song is out there somewhere, waiting.',
    'Nothing yet. Even the greatest setlists started at zero.',
  ],
  song_imported: [
    'Song added! It now lives rent-free on your device.',
    'Imported. I’ve put it on the shelf, label facing out.',
    'Got it. One more song in your collection, zero more in the cloud.',
    'Song added. It already looks at home.',
    'New song! Let’s see what it is made of.',
    'Imported. The song is a little nervous; be kind to it.',
  ],
  chord_change: [
    'Chord changes are slow for everybody at first. Weeks, not minutes. That’s normal.',
    'Change! Your fingers are moving house. They will unpack eventually.',
    'Chord changes: the guitar’s way of teaching patience.',
    'Every smooth change you have ever heard was once a clumsy one.',
    'Fingers in transit. Please mind the gap.',
    'Changing chords is a dance with a plank of wood. You will lead eventually.',
  ],
  metal_unlocked: [
    'You have unlocked the metal chapter. Inform your neighbours — or let them find out.',
    'Metal unlocked. Black T-shirt optional, sensible volume compulsory.',
    'Welcome to metal. The lessons are the same length; they just sound angrier.',
    'Metal chapter unlocked. I have switched my internal font to “menacing”.',
    'You can now play heavy things. Remember: the volume knob goes both ways.',
    'Metal unlocked. The palm mute was inside you all along.',
  ],
  sore_fingers: [
    'Sore fingertips are your body installing callouses. Installation works best with breaks.',
    'Tender fingertips mean you practised. Tomorrow’s you gets tougher fingers.',
    'Your fingertips are toughening up. In a few weeks they will be tiny leather boots.',
    'Sore fingers: the guitar’s loyalty programme. Rest days earn points too.',
    'Fingertips grumbling? Give them the day off. They come back stronger and slightly smug.',
    'Callouses are built slowly, like cathedrals. Cathedral builders took breaks.',
  ],
};

const METAL: Lines = {
  first_launch: [
    'WELCOME, MORTAL. Your guitar has waited in its case long enough. UNLEASH IT.',
    'THE AMP IS COLD. THE STRINGS ARE SHINY. Let’s fix both.',
    'Hell yeah, a new recruit! The universe isn’t ready. Honestly, neither is the guitar.',
    'Welcome to the pit. It’s a very gentle pit. With rest breaks. METAL rest breaks.',
    'Day one of your legend. Somewhere, a smoke machine just switched itself on.',
    'PREPARE TO ROCK. Slowly. Accurately. THEN LOUDLY. (At a sensible volume.)',
    'Your guitar called. It’s sick of being decoration. LET’S GO.',
  ],
  welcome_back: [
    'THE RETURN OF THE SHREDDER. Cue the pyrotechnics.',
    'YOU CAME BACK. The amp is humming with joy. Or that’s a ground loop. Either way: METAL.',
    'Welcome back, warrior. Your callouses missed you.',
    'Hell yeah, round two. The guitar is already sweating.',
    'BACK FROM THE ABYSS. (The abyss was your day.) Let’s make noise.',
    'The riff gods noticed you’re back. They nodded. A METAL nod.',
  ],
  lesson_start: [
    'LESSON START. Strap in. Literally, if you’re standing.',
    'A NEW CHALLENGER APPEARS: this lesson. Destroy it. Gently.',
    'Lesson loaded. Fingers armed. Volume… reasonable. Damn, we’re responsible.',
    'IT BEGINS. Somewhere an amp goes to eleven. Ours stays at a sensible four.',
    'Time to forge new skills in the fires of practice. Bring a towel.',
    'LET’S RIDE. This lesson won’t know what hit it.',
  ],
  lesson_complete: [
    'LESSON DESTROYED. No survivors. (Lessons remaining: one fewer.)',
    'HELL YEAH. That lesson never stood a chance.',
    'VICTORY! Raise the horns. Lower the volume. Raise the horns again.',
    'Another skill forged in steel. And slightly sore fingertips.',
    'COMPLETE. The amp gods demand you hydrate.',
    'That’s how it’s done. Damn, that was metal.',
  ],
  step_correct: [
    'YES. FACE: MELTED.',
    'BOOM. Right note.',
    'THAT’S THE ONE. The speakers bow before you.',
    'HELL YEAH. Precision strike.',
    'CORRECT. The riff gods approve this message.',
    'DAMN RIGHT. Again!',
  ],
  step_wrong: [
    'WRONG NOTE, RIGHT ENERGY. Again!',
    'The fretboard fought back. RETALIATE.',
    'Not that one. Blame the universe. Then go again.',
    'DAMN, so close. The guitar is testing you. Show it who’s boss.',
    'Missed. That’s a war story, not a defeat. AGAIN.',
    'The note dodged. Notes are sneaky. CATCH IT.',
  ],
  streak_3: [
    'THREE IN A ROW. THE CROWD GOES WILD.',
    'COMBO ×3. Somebody stop this person. (Don’t.)',
    'TRIPLE HIT. The amp just did a backflip.',
    'Three! Hell yeah, the momentum is real.',
    'STREAK UNLOCKED. Smoke machine: engaged.',
    'THREE. The universe felt that one.',
  ],
  streak_10: [
    'TEN IN A ROW. EVERYTHING. IS. MELTING.',
    'COMBO ×10. The stage is on fire. (Metaphorically. Please check.)',
    'TEN. The riff gods have sent a fruit basket.',
    'UNSTOPPABLE. Ten notes, zero mercy.',
    'DAMN. Ten straight. The amp needs a moment.',
    'TEN-HIT STREAK. Legends are whispering your name. Quietly. They’re legends, not fans.',
  ],
  uncertain: [
    'SIGNAL LOST IN THE FOG OF WAR. Not your fault. Again!',
    'The mic blinked. Damn mic. One more time.',
    'UNKNOWN NOISE DETECTED. Could have been a dragon. No penalty.',
    'Couldn’t hear it clearly. Blame the room, the mic, the cosmos. Not you.',
    'Static from the void. Hit it again.',
    'UNCERTAIN. The universe garbled it. We don’t count garbles.',
  ],
  mic_off: [
    'THE MIC SLEEPS. You are your own judge now. Judge fairly. Judge METAL.',
    'No ears on. Self-check mode: ENGAGED.',
    'Mic’s off. I’m headbanging blind over here.',
    'SILENCE ON THE INPUT. The honour system has been summoned.',
    'The mic is off. The riffs still count in your heart.',
    'No input. I trust you. Don’t make it weird.',
  ],
  tuner_in_tune: [
    'LOCKED IN. That string is ready for WAR.',
    'IN TUNE. The amp approves.',
    'TUNED TO PERFECTION. Hell yeah.',
    'That string is tight. Not too tight. METAL tight.',
    'PITCH: CONQUERED.',
    'Dead on. The riff gods respect a tuned guitar.',
  ],
  tuner_far: [
    'THAT STRING IS IN ANOTHER DIMENSION. Bring it back. Slowly.',
    'Damn, that’s off. The guitar is rebelling. Small turns crush rebellions.',
    'OUT OF TUNE. The universe is chaos. You are order.',
    'That string chose violence. Choose patience.',
    'WAY OFF. Wrong peg, maybe? It happens to the best. Tame the beast.',
    'That pitch is lost in the void. Guide it home, warrior.',
  ],
  tuner_start: [
    'TUNE UP OR SHUT UP. (Kindly.)',
    'Before we shred, we tune. Even the gods of metal tune.',
    'THE TUNING RITUAL BEGINS. Pluck. Turn. Repeat. Ascend.',
    'Six strings. One mission. TUNE THEM.',
    'An out-of-tune riff is a sad riff. PREVENT SADNESS.',
    'Calibrating the weapon.',
  ],
  practice_great: [
    'FACE. MELTED. Please collect your face at the front desk.',
    'THAT WAS LEGENDARY. Somebody call the fire brigade.',
    'HELL YEAH. The amp needs a lie-down.',
    'DEVASTATING. The neighbours have formed a fan club.',
    'TOTAL DOMINATION. The riff gods are taking notes.',
    'THAT RIPPED. Even the metronome is headbanging.',
  ],
  practice_ok: [
    'SOLID. Some notes escaped. Hunt them down.',
    'Not bad, warrior. The battle continues.',
    'Respectable carnage. Again, for MORE carnage.',
    'DAMN DECENT. Tighten it up and the stage is yours.',
    'Good run. The amp nods. It wants more.',
    'You survived the riff. Next time, CONQUER it.',
  ],
  practice_rough: [
    'THE RIFF FOUGHT BACK. Regroup. Rematch.',
    'Damn, that was a brawl. The guitar cheated. Probably.',
    'ROUGH ROUND. Even metal gods have soundchecks that sound like a dropped cutlery drawer.',
    'The amp got the better of us. Blame the amp. The amp can take it.',
    'Chaos reigned. Slow the tempo, crush the chaos.',
    'That was raw. Too raw. Let’s cook it a bit longer.',
  ],
  rank_up: [
    'RANK UP. BOW BEFORE THE NEW TITLE.',
    'ASCENSION. The amp goes to eleven out of respect. (Then straight back down. Ears.)',
    'HELL YEAH. New rank, new legend, same sore fingertips.',
    'PROMOTED BY THE COUNCIL OF RIFFS.',
    'YOU HAVE LEVELLED UP. The universe trembles. Slightly.',
    'NEW RANK. Commission a leather jacket immediately.',
  ],
  chapter_complete: [
    'CHAPTER CONQUERED. Plant your flag. Then plant another flag.',
    'THAT CHAPTER IS RUBBLE. Next.',
    'HELL YEAH. One chapter closer to world domination. (Of your living room.)',
    'CHAPTER: DEVASTATED. Roadies, prepare the next stage.',
    'You crushed it. The riff gods added you to the guest list.',
    'DONE. The amp glows a little brighter.',
  ],
  boss_fight: [
    'BOSS FIGHT. FOG MACHINES ON. HEARTS ON FIRE. VOLUME SENSIBLE.',
    'THE BOSS AWAKENS. It has never faced someone this stubborn.',
    'BOSS INCOMING. Sharpen your pick. (Do not actually sharpen your pick.)',
    'Damn, it’s the boss. Show it everything you’ve learned. Then show it again.',
    'FINAL FORM? NO. Regular form. Still: CRUSH IT.',
    'The boss is big. You are bigger. Metaphorically.',
  ],
  rest_break: [
    'REST. Even metal gods need water. LOTS of water.',
    'BREAK TIME. The amp needs to cool down. So do your fingertips.',
    'Stretch those hands, warrior. Battle resumes shortly.',
    'INTERMISSION. Hydrate. Stretch. Plot your next riff.',
    'PAUSE. Pain is not a power-up. Rest is.',
    'Hands down, guitar down. The roadies (you) are on a break.',
  ],
  empty_songs: [
    'NO SONGS. THE VOID STARES BACK.',
    'This setlist is emptier than a stadium at six in the morning.',
    'SONG LIST: BARREN WASTELAND. Bring riffs.',
    'Zero songs. Damn. Let’s fix that.',
    'The arsenal is empty. LOAD IT.',
    'NOTHING HERE BUT ECHOES AND AMBITION.',
  ],
  song_imported: [
    'NEW SONG ACQUIRED. ADD IT TO THE ARSENAL.',
    'SONG LOADED. The amp is warming up just thinking about it.',
    'Hell yeah, fresh material.',
    'IMPORTED. The setlist grows stronger.',
    'A new challenger joins your library.',
    'LOCKED AND LOADED.',
  ],
  chord_change: [
    'SHAPESHIFT! Fingers, MOVE.',
    'CHANGE INCOMING. Fingers: deploy.',
    'Chord changes are the gym of guitar. Feel the burn — the gentle, sensible kind.',
    'Switch it up. The fretboard cannot stop you.',
    'TRANSFORM. Slow at first. Then UNSTOPPABLE.',
    'Change it like you mean it.',
  ],
  metal_unlocked: [
    'METAL. IS. UNLOCKED. THE GATES OF RIFF SWING OPEN.',
    'HELL YEAH. Welcome to the heaviest chapter. Hearing protection is METAL.',
    'THE CHUG AWAKENS.',
    'You have been granted access to THE PIT. It is a nice pit. It has rest breaks.',
    'DAMN. The amp has been waiting for this moment its entire life.',
    'METAL MODE UNLOCKED. Somewhere, a thunderstorm starts on cue.',
  ],
  sore_fingers: [
    'BATTLE SCARS. Tiny ones, on your fingertips. Rest, and they turn into armour.',
    'Your fingertips are forging armour. Forging needs rest. REST.',
    'PAIN IS NOT A POWER-UP. Sore is normal; sharp pain means stop.',
    'The callouses are coming. Let them grow in peace.',
    'Sore? The steel strings are testing you. Rest wins this round.',
    'Fingertips on strike. Respect the union. Break time.',
  ],
};

const LINES: Record<Exclude<VoiceStyle, 'plain'>, Lines> = { funny: FUNNY, metal: METAL };

/** All lines for an event in a style ('plain' has none). */
export function voiceLines(event: VoiceEvent, style: VoiceStyle): readonly string[] {
  return style === 'plain' ? [] : LINES[style][event];
}

/**
 * One extra joke line for an event, or null for 'plain'. Pass a `seed` (e.g. a
 * counter or the step index) for a stable choice; without one it picks at random.
 */
export function voiceLine(event: VoiceEvent, style: VoiceStyle, seed?: number): string | null {
  const lines = voiceLines(event, style);
  if (!lines.length) return null;
  const n = seed === undefined || !Number.isFinite(seed) ? Math.floor(Math.random() * lines.length) : Math.abs(Math.trunc(seed));
  return lines[n % lines.length]!;
}
