# Guitar Unhero

## Master product and technical specification — v1.0

**Prepared:** November 3, 2026. **Primary learner:** an adult absolute beginner with a real six-string guitar and limited practice time. **Implementation brief:** build a useful local prototype first, then earn the right to release more difficult capabilities through evaluation. **Budget context:** approximately $249 remains in the user's expiring Claude Code cloud usage balance.

This is a proposed implementation contract, not a claim that the software or the stated accuracy already exists. Numbers labeled targets are release gates to measure. Estimates are planning ranges, not delivery guarantees. Current external facts are linked near the relevant statements; architectural choices and algorithms are product decisions.

### Document map

1. Product promise and feasibility
2. Scope and priorities
3. Learning design and curriculum
4. User journeys and interface
5. Audio input, tuner, and feedback
6. Transport, synchronization, gameplay, and scoring
7. Song import, transcription, and simplification
8. Camera coaching
9. Modular architecture and ML boundaries
10. Data contracts and future service APIs
11. Privacy, security, rights, and licensing
12. Evaluation and acceptance criteria
13. Phased implementation and backlog
14. Claude model, credit, and token strategy
15. Launch and continuity checklist

## 1. Product promise and feasibility

**Guitar Unhero helps someone learn to make music on their own guitar, one achievable movement and one understandable correction at a time.** It combines a teacher's explanation, a practice game's anticipation, and an editor that turns difficult material into an honest stepping stone.

The emotional promise is: “You can start here. Let us make the next movement clear.” Never describe the user as unintelligent or shame them for slow progress. No punishment for missed days, no forced streaks, no perfection requirement to enjoy music.

### 1.1 The core loop

`Hear → see the movement → prepare → play → observe → adjust one thing → repeat → use it in music`.

Every lesson must connect a physical action, its musical purpose, a demonstration, and an achievable check. The app must teach what to do between notes: prepare a finger, release pressure, move, avoid touching adjacent strings, mute intentionally, and recover after a mistake. A falling block that says “3” is insufficient teaching.

### 1.2 Distinctive product ideas

These are design proposals, not claims that no competitor has similar features or that the name is legally available.

| Idea | Learner benefit | Earliest phase |
|---|---|---|
| Prepare / press / sound / release cues | Teaches movement before the note arrives | M1–M2 |
| Rescue a difficult passage | Turns one recurring failure into a short targeted exercise | M3 |
| One song, several truthful arrangements | Shows root notes, a melody, simplified chords, and fuller parts as different arrangements | M3–M4 |
| Evidence-aware coach | Says what it heard, what it could not assess, and what to try next | M1 |
| Quiet guitarist mode | Synthesized guide muted while score, pulse, or cleared backing continues | M1–M3 |
| Demonstration fades away | Reduces cues so progress transfers beyond the game | M2 |
| Personal achievable version | Adapts fret span, tempo, density, and known chord vocabulary | M3 |
| Play it away from the screen | Short recall and ear exercises measure independence | M2 |

### 1.3 Hard feasibility boundaries

| Capability | Feasible initial commitment | Boundary that must remain visible |
|---|---|---|
| Tuner | Isolated string pitch and cents locally | Noise, harmonics, effects, and detuning can mislead it |
| Single-note feedback | Pitch/attack checks on clean isolated notes | Same pitch can occur at several string/fret positions |
| Rhythm game | Accurate authored/synthesized exercise timing | Hardware and wireless latency require calibration or wider windows |
| Chords | Teach shapes; check strings separately first | Full voicing and every muted string are not reliably observable from one room mic |
| Technique | Demonstrations and structured checks | Audio cannot directly measure pressure, finger choice, posture, or pain |
| Camera | Optional visible-hand and rough placement assistance | Occlusion, angle, reflective strings, motion blur, and small fret spacing prevent universal reliable assessment |
| Uploads | Play a user-selected backing file; align an authored score; later analyze clean excerpts | Full mixes do not reliably yield exact guitar tabs automatically |
| Guitar mute | Mute synthesized guitar or a supplied isolated stem | Removing guitar from a commercial stereo mix is approximate and may remove other sound |
| Real time | Score prepared music and assess live playing | Analyze uploaded songs before gameplay; do not promise exact full-song transcription while streaming |
| Runtime AI tutor | Optional explanations grounded in structured evidence | A language model is not the note detector, transport clock, or authority on technique |
| Completion | A working prototype within a focused sprint is plausible | $249 cannot guarantee production readiness, music rights, training data, or universal accuracy |

Never advertise “any song, perfectly transcribed,” “camera verifies every finger,” “guaranteed mastery,” or “learn safely because AI checks your posture.”

## 2. Scope and priorities

### 2.1 Initial assumptions

- Adult individual learning at home; no child-targeted launch in the first release.
- Acoustic, classical, or clean electric six-string guitar; standard E2–A2–D3–G3–B3–E4 tuning. Distorted electric guitar, bass, twelve-string, and alternate tunings are later support profiles.
- Current Windows desktop Chrome/Edge; a microphone and headphones, or optional audio interface. The app must also work in a clearly labeled demonstration mode without a guitar.
- Local web application first. Camera, accounts, cloud sync, subscription billing, social features, licensed commercial catalog, and GPU workers do not block the first version.
- Content begins in English, with language-independent identifiers and extractable UI strings. No locale inferred from system folder names.

### 2.2 Requirement priorities

**P0 / M1:** setup, honest sensor states, selected-string/chromatic tuner, first original lessons, canonical score validation, synthesized demonstrations, practice highway, metronome/count-in, slow exercise tempo, pause/seek/A–B loop, wait mode, isolated-note scoring, local persistence, accessibility essentials, reproducible tests, and handoff.

**P1 / M2–M3:** better lesson library, chord/string checks, structured original exercise authoring, progress adaptation, calibrated timing UX, local backing upload and alignment editor, reviewable simplification, useful offline behavior.

**P2 / M4–M5:** experimental clean-guitar transcription, optional separation provider, selected chord detection, camera placement assistance, optional grounded conversational coach, opt-in hosted processing.

**P3 / M6+:** public beta operations, rights-cleared catalog, teacher authoring, mobile hardening, optional sync, additional tunings, advanced techniques, multiplayer or community features after moderation and rights workflows exist.

### 2.3 Success metrics

The primary product outcome is a learner returning voluntarily and playing a short passage with fewer cues. Proposed pilot targets: at least 4 of 5 observed adult beginners finish setup and make their first assessed sound within 10 minutes; at least 4 of 5 can explain the next suggested action; no participant repeatedly penalized for a sensor failure. A five-person pilot detects usability failures, not statistical proof of teaching effectiveness.

Track: time to first sound, permission/setup abandonment, usable-signal coverage, inappropriate rejection reports, completion of a chosen five-minute session, retained performance on a later day, and cue-free recall. Report accuracy only with assessment coverage and the evaluated capability. Time spent and high scores alone do not demonstrate learning.

## 3. Learning design and curriculum

### 3.1 Pedagogical contract

PED-01: One new physical or musical concept at a time. Introduce notation only when it serves the current action. Explain chord, note, fret, string, beat, and strum in ordinary language.

PED-02: Each lesson has prerequisites, a concrete objective, authored demonstration, a physical-action breakdown, a listening comparison, a practice task, evidence limits, a success check, and an easier alternative. Lessons must remain useful when sensing is unavailable.

PED-03: Use short blocked repetitions first, then vary context and interleave known skills. Include recall after a delay and a short session without falling-note cues. These are curriculum design choices to evaluate with a guitar educator and actual learners, not guaranteed optimal schedules.

PED-04: Score musical dimensions separately. A learner can get the pitch right while arriving late. Do not tell someone to press harder merely because a mic failed to recognize a note.

PED-05: Normalize resets. A failed phrase triggers an optional slower loop, smaller note group, or listening example. A sensor problem triggers a setup fix. Neither removes progress.

PED-06: Encourage comfortable movement, relaxed pauses, and stopping if playing causes pain. Do not diagnose injuries or require strenuous stretches. Have technique text and illustrations reviewed by a qualified guitar teacher before claiming they form a reliable public curriculum.

### 3.2 Progression and observable checks

| Unit | Learn and practice | Check and fallback |
|---|---|---|
| 0. Meet the guitar | Parts, string numbering, handedness, sitting/holding options, picking/finger options | Point to high/low E; self-check; no camera requirement |
| 1. Tune and make one sound | Selected-string tuning; pluck once; let it ring; stop it | Clean high E pitch; silence/clipping help instead of a failure |
| 2. First fretted notes | High E open/first/third frets; fingertip behind fret; press only as needed | Hear E4/F4/G4 separately; sound confirms pitch, not the exact finger used |
| 3. Feel the pulse | Count four, tap, quarter notes and rests, downstrokes | Attack timing at 50–70 BPM; tap-only/manual mode allowed |
| 4. Move between strings | B-string open/first/third frets; planned preparation and release | Authored two-string phrase; no unsupported exact-string claim |
| 5. First chord | Em shape, individual-string listening, then a gentle strum | Guided string-by-string check; full-chord scoring initially unassessed |
| 6. Change shape | Am, then a small Em↔Am exercise | Prepare fingers slowly; self-check then optional audio evidence |
| 7. More musical choices | C, G, D variants; choose reachable voicings; rests and down/up patterns | Reviewed chord dictionary and tempo appropriate to learner |
| 8. Your first complete piece | Original 8–16-bar piece with familiar movement | Perform with count-in, optional guide, then fewer cues |
| 9. Listen and remember | Recognize higher/lower, echo a two-note phrase, recall a learned bar | Listening/recall mode with no score highway |
| 10. Later techniques | Muting, alternate picking, hammer-on/pull-off, slides, bends, vibrato, barre chords | Authored demonstrations first; each automatic check separately validated |

This is a skill graph, not a forced day-by-day timetable. Let the learner choose a song goal and route its prerequisites through this graph.

### 3.3 Concrete first lesson

**ID:** `lesson.high-e.first-sound.v1`. **Goal:** make three deliberate sounds on the high E string, with comfortable pauses. **Prerequisite:** guitar identified and broadly tuned. **Duration:** about 3–5 minutes, learner controlled.

1. Show the thinnest string labeled “1 — high E.” Explain that “high” refers to pitch. Play a short E4 reference when requested.
2. “Keep your fretting hand relaxed. Pluck this string once with your pick or a finger. Let it ring.” Show a short original close-up demonstration or an honest diagram; no fake video placeholder.
3. Listen-only demonstration, then learner attempt. For usable evidence, say “I heard E. Try it once more.” For silence: “I couldn't hear a clear note. Check the input meter and pluck once.”
4. Repeat three times; exact duration of the ring is initially exploratory, not a demand to keep an acoustic decay above a fixed volume.
5. Ask the learner to stop the ringing deliberately, then repeat with a four-beat count-in.
6. Offer “try a fretted note,” “repeat,” and “finish for today.” Save progress on completion, including an explicit self-completed option when audio cannot assess it.

Next lesson: high E fret 1 gives F4; index finger just behind the first fret wire, pluck once, release, compare with open E. Fret 3 gives G4, often using ring finger. Finger suggestions are teaching defaults, not mandatory anatomical judgments.

**Reviewed chord facts for seed content:** Em low-to-high `0 2 2 0 0 0`; a common fingering places middle on string 5 fret 2, ring on string 4 fret 2. Am low-to-high `x 0 2 2 1 0`; common fingering uses middle on string 4 fret 2, ring on string 3 fret 2, index on string 2 fret 1. `x` means omit/mute, `0` means open. The UI must label which direction diagrams are read.

### 3.4 Lesson data and adaptation

Store `lessonId`, `version`, `prerequisiteSkillIds`, `learningObjective`, `estimatedMinutes`, `equipment`, `demonstrationAssets`, `steps`, `scoreRef`, `supportedAssessments`, `selfCheck`, `successRule`, `fallbacks`, `rights`, `reviewStatus`, and `teacherReviewer`. Each step has plain text, optional diagram/motion phases, and next-step transitions.

Skill state: `unseen → introduced → practicing → demonstrated → retained`. Store evidence provenance: sensor-assessed, self-reported, or teacher-reviewed. Manual completion must not be relabeled as sensor mastery.

Initial adaptation rule: after two phrases with ≥80% success on assessed events and ≥70% coverage, offer +5 BPM; after two phrases below 60% with adequate coverage, offer −10 BPM or a smaller loop. Change only one difficulty dimension at a time. Do not auto-change mid-phrase. Require a later recall attempt before marking retained. If coverage is low, fix setup rather than lower the learner's skill estimate.

### 3.5 Long-term learning breadth

Expand the skill graph beyond the first lessons: picking and fingerstyle patterns, chord vocabulary/inversions, fretboard note names, intervals, major/minor sound, pentatonic and diatonic scales, chord construction, rhythm subdivisions and syncopation, ear training, reading tab/notation, accompaniment, improvisation, and playing with others. Connect theory to a sound and movement immediately rather than making it a terminology exam. CAGED or other fretboard systems can be optional routes, not a prerequisite for making music.

Advanced technique content includes palm/left-hand muting, legato, slides, bends to a target pitch, vibrato, harmonics, barre shapes, articulation, and dynamics. Teach acoustic/classical/electric differences explicitly. Automatic assessment is enabled technique by technique after dedicated testing; advanced content can still be useful as demonstrated/self-checked instruction. Allow alternative fingerings and accessible approaches rather than assuming one hand shape fits everyone.

Teacher authoring, later: create a lesson from a reviewed arrangement, specify prerequisites and physical preparation, choose which claims sensors may assess, attach original/licensed demonstrations, preview learner failure states, and publish a version with reviewer/rights records. An LLM can draft content, but generated technique instructions do not become teacher-reviewed automatically.

## 4. User journeys and interface

### 4.1 Navigation and screen inventory

| Screen | Main action | Required states |
|---|---|---|
| Home | Continue a chosen five-minute session | First use, resume, offline, no saved progress |
| Setup | Choose device, see signal, confirm handedness | Permission prompt/denied, absent/busy mic, unsupported API, clipping, noise |
| Tuner | Select/pluck one string | Listening, stable pitch, sharp/flat/in tune, uncertain, muted input |
| Learn | Hear/see/do one step | Demonstration, attempt, specific feedback, self-check, retry |
| Practice | Play a prepared passage | Ready/count-in/playing/waiting/paused/completed/device-lost |
| Song workspace | Import, inspect, align, simplify | Local file, pending analysis, needs review, unsupported, failed/cancelled |
| Review editor | Correct notes, grid, fingering, and timing | Original/candidate/corrected versions, undo, validation failures |
| Session review | Understand one improvement | Coverage, pitch/rhythm separately, one recommended drill |
| Settings and data | Control devices, accessibility, data | Export/import/delete, offline asset state, privacy details |

M1 may combine Home/Learn and defer Song workspace/Review editor. Never show an enabled button for a capability whose implementation is only a placeholder.

### 4.2 First-use flow

No mandatory login or camera request. Ask handedness and whether a guitar is available. Explain why microphone access helps; request it only when the user chooses tuner or listening. Show real input activity. Explain permission recovery without repeatedly prompting. Provide “continue without listening,” and label its assessment limits.

Offer headphones to reduce backing leakage. Run a silence/noise sample and one-string test. Do not require successful automatic calibration before the learner can hear a demonstration. If timing is uncalibrated, show wide beginner windows and suppress claims of fine timing accuracy.

### 4.3 Practice layout

Landscape desktop: transport/header at top; upcoming fret/shape preparation above the hit area; six horizontal string lanes with time moving right-to-left; current fretboard/chord detail beside or below; feedback region beneath. This is an original visual treatment, not a copy of Guitar Hero assets or branding.

String 1 is at the top in the default tab-oriented lane view; string 6 at the bottom. Each lane also displays pitch label and string number. A player-oriented fretboard diagram may use another orientation, but it must be explicitly labeled and consistently mirrored for left-handed display. Do not reverse data numbering when mirroring.

Show fret number inside each note, optional finger number on approach, a duration/hold indication, and pre-action arrows only where authored. Mark muted/omitted strings distinctly. Notes/chords must be distinguishable by shape and text, not color alone. Upcoming motion cues start before target time according to configurable lookahead, typically 2–4 seconds at the current playback rate.

Accessible DOM controls surround the canvas. Provide a readable textual/tablature event list, keyboard controls, visible focus, reduced-motion step mode, high contrast, scalable diagrams, captions/transcripts, independent audio sliders, and configurable visual density. Space toggles play/pause except while editing text; Escape pauses. No flashing failure effects. Target WCAG 2.2 AA and audit the actual release; this document does not claim conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### 4.4 Coaching language and error recovery

Use evidence and one action: “That sounded like F. The target is G. Try the third fret.” If the app cannot locate a hand, say “Your hand is out of view”; do not say “wrong finger.” If the app detects clipping, lower input gain guidance replaces pitch criticism.

Device disconnect pauses assessment and transport with a recoverable message. Resume requires the user's action and a count-in. A backgrounded or interrupted audio context pauses music; do not silently advance and mark missed notes. Device settings, loops, and tempo survive a temporary interruption.

## 5. Audio input, tuner, and feedback

### 5.1 Capture and processing

AUD-01: Request mono input and attempt `echoCancellation:false`, `noiseSuppression:false`, `autoGainControl:false` for instrument analysis. Read actual track settings and show when the browser/device applies different processing. Do not claim every browser honors the request. These controls are defined by the media capture specification. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)

AUD-02: Use the actual `AudioContext.sampleRate`; support at least 44.1 and 48 kHz in tests. Never assume 48 kHz. Capture PCM and sample-frame timestamps through an AudioWorklet; avoid deprecated main-thread audio callbacks. Use bounded buffers and no network calls or heavy ML inside the real-time processor. Do not assume a fixed render quantum size.

AUD-03: Process DC removal, input RMS/peak and clipping indicators, adaptive noise-floor estimation, onset candidates, and isolated-note pitch. Use a well-tested YIN-family or autocorrelation implementation behind an interface; verify the chosen implementation's license. Start with a short benchmark spike rather than writing an elaborate novel detector. A practical initial analysis window is 4,096 samples with a 256–512-sample hop; evaluate shorter windows for high strings. The low E period and harmonics impose a real latency/accuracy tradeoff.

AUD-04: Timestamp each result using the analyzed sample interval and a consistent center/attack convention. Include `analysisWindowStart`, `analysisWindowEnd`, and `producedAt`. Processing delay affects feedback freshness, not the musical time assigned to the observation. Document detector lookahead and calibrated offsets.

AUD-05: Stop tracks on leaving active listening unless the learner explicitly keeps tuner/practice listening open. Never route live mic audio to speakers by default. Provide a hard mute and output limiter for synthesized demonstrations; do not create feedback loops.

### 5.2 Tuner

Chromatic tuner: `m = 69 + 12 * log2(f/440)`; nearest MIDI `n = round(m)`; cents `1200 * log2(f / (440 * 2^((n-69)/12)))`. A4 defaults to 440 Hz; alternate reference tuning is later optional. Display note spelling consistently; tuning uses sounding pitch, not octave-transposed staff notation.

Selected-string targets, low to high: E2 ≈82.41 Hz, A2=110 Hz, D3≈146.83 Hz, G3≈196 Hz, B3≈246.94 Hz, E4≈329.63 Hz. MIDI `[40,45,50,55,59,64]`.

Smooth cents for display with a short robust median, but preserve raw samples for diagnostics in memory. Suggested UI rule: only lock after ≥300 ms of stable usable evidence and within ±5 cents; exit lock beyond ±8 cents. These are defaults to validate, not proof of detector accuracy. Display “pluck one string” when polyphonic/unstable input prevents a dependable estimate. Reject impossible/unusable frequency values.

Harmonic/octave handling: compare candidate fundamentals and expected selected-string range; never silently divide every detected octave by two. If evidence fits a strong harmonic but the fundamental is unclear, show uncertainty and ask for another isolated pluck. Large detuning requires an explicit check, not aggressive “tighten” instructions toward a possibly wrong octave. Do not auto-adjust the score to hide a badly tuned guitar.

### 5.3 Evidence capabilities

| Check | M1 status | Later route |
|---|---|---|
| Isolated pitch | Supported on clean input after tests | Alternative robust detector |
| Attack timing | Supported with calibration caveat | Device-specific validation |
| Sustained pitch | Optional tolerant check | Avoid penalizing natural decay |
| Whole chord completeness | Not assessed | Polyphonic model + voiced-chord tests |
| Individual chord string | Guided separate pluck | Known-string instruction, not acoustical certainty |
| Unwanted ringing/muting | Not assessed initially | Dedicated annotated evidence |
| Bend/slide/vibrato | Displayed if authored, unassessed initially | Pitch-contour alignment with technique-specific gates |
| Buzz source / pressure / finger identity | No direct measurement | Audio may suggest an issue; never infer exact physical cause as fact |

Use detector quality scores honestly: a raw model score is not a calibrated probability. Start with `good/poor/unavailable` quality and tune thresholds on held-out recordings. Abstain when signal is clipped, mixed, too quiet, or stale. Keep device failures distinct from musical mismatches.

### 5.4 Prevent the app from playing itself

Backing tracks and reference tones can leak into the microphone. Headphones or a direct guitar input are the recommended assessment setup. Disable assessment during reference demonstrations. A speaker-only mode is listen/practice guidance with assessment explicitly limited until evaluated. Do not award correct notes merely because the app's synth is playing them. Add a leakage regression test: backing alone must not earn a successful assessed performance in supported configurations.

Acoustic cancellation or reference subtraction is an optional research module, not an assumption that makes speaker scoring valid. Direct monitoring and Bluetooth delay are separate concerns; do not promise to correct all wireless jitter with one constant.

## 6. Transport, synchronization, gameplay, and scoring

### 6.1 Single clock and time domains

TIME-01: Canonical musical positions are integer ticks with PPQ 960. Each quarter note is 960 ticks. Store a tempo map and meter map; M1 supports a constant tempo and 4/4. Reject unsupported tempo-map variants with an explanation rather than render them incorrectly.

TIME-02: Keep three domains explicit: score ticks `q`, source-media seconds `s`, and audio-context seconds `c`. For synthesized exercises, a tempo map maps ticks to source seconds. For imported audio, use reviewed alignment anchors `(tick, sourceSec)` and monotonic interpolation; do not assume the recording begins on beat one or has a perfectly fixed tempo.

For a constant tempo `B`: `s(q) = q * 60 / (960 * B)`. For tempo changes integrate each segment. A seek/rate segment has source position `s0`, audio start `c0`, and speed `r`; while active, `s(c) = s0 + r * (c-c0)`. Keep a segment history so delayed observations spanning a rate change use the correct mapping. No event identity is derived from rounded display time.

TIME-03: Schedule audio from context time with a short lookahead (initially about 100 ms, refreshed about every 25 ms). UI timers may refill this schedule; they are not the music clock. Draw from the transport's current audible position using `requestAnimationFrame`. Use output timestamp/performance mapping when supported, and a documented measured fallback otherwise. Web Audio defines scheduled time and output timestamp mapping; measure browser behavior rather than infer real hardware precision from the API alone. [Web Audio API](https://www.w3.org/TR/webaudio/)

### 6.2 Latency calibration without double subtraction

Use a single documented scoring convention:

- `cTarget`: target audio-context schedule time for the note's intended heard onset.
- `cObserved`: onset time stamped from input sample frames in context time, with the detector's documented onset/window correction applied.
- `deltaIO`: measured offset from a scheduled output event to its corresponding observed input-frame event. It may include output, acoustic, and capture delay.
- `timingErrorSec = cObserved - cTarget - deltaIO`. Positive means late.

If calibration used this combined offset, **do not subtract output latency again**. `getOutputTimestamp()` helps visualization; it is not a second scoring correction. If a later implementation uses separate capture/output offsets, change the contract and tests together.

Offer optional quiet-room loopback calibration using a few generated short pulses captured by the mic, with assessment disabled and safe output. Reject noisy/ambiguous measurements; show estimate and spread. A tap-along calibration mixes human reaction and device delay: label it a personal timing adjustment, not a precise input-latency measurement. Manual adjustment remains available.

Store calibration with device identity scoped locally, sample rate, output route, browser profile, method, offset, spread, and date. Invalidate on route/device/sample-rate changes. Without reliable calibration, widen beginner windows and show timing as approximate or disable fine timing assessment. Headphones can prevent acoustic loopback; do not make loopback mandatory.

### 6.3 State machine and transitions

`idle → ready → countIn → playing ↔ paused → completed`; `playing → waitingForTarget` in wait mode; any active state can transition to `deviceLost` or `error`.

- Pause captures the exact source position, stops scheduled audio, flushes queued future events, and disables scoring.
- Resume creates a new segment and count-in. AudioBufferSource nodes are one-shot and must be recreated on restart/seek.
- Seek stops old sources and invalidates prior event-matching state; history is preserved as a separate attempt.
- Loop bounds are half-open `[A,B)` in ticks; allow at least one beat. At wrap, reset event matcher and use a loop-iteration ID so the same note can be scored again without duplicate credit. Use a short edge ramp/crossfade where appropriate.
- Rate changes occur at a safe boundary or pause/restart the segment; align backing, synth, metronome, cursor, and scoring to the same change.
- A lost/suspended audio context pauses; recovery needs user action where browsers require it.

### 6.4 Practice modes and audio controls

**Learn/step:** frozen target with demonstration and preparation cues. **Wait:** stop the entire musical transport/backing before the next target; accept a recognized target or explicit skip, then continue. Timing is not graded. Sustain, rests, and unsupported techniques use authored/manual completion rules. **Fixed tempo:** music continues; pitch and rhythm assessed where supported. **Loop:** repeat selected bars. **Recall:** hide some cues after successful guided attempts. **Listen:** demonstration only, no assessed score.

In wait mode the active target is matched against live observations directly, independent of its now-paused scheduled onset. Require a new deliberate attack for each target, preserve one-to-one assignment, and reset the attack gate when advancing. Otherwise a held note could repeatedly advance the score. Keep capture running while musical transport waits; pause assessment as well when the user presses Pause.

Independent gains: metronome, synthesized guitar, supplied backing, supplied guitar stem. Muting a synth or actual stem is exact; a separated stem is labeled approximate. No “guitar removed” slider on an ordinary stereo file without a separation result.

Slowing synthetic exercises preserves pitch by rescheduling notes. Changing `AudioBufferSource.playbackRate` also changes pitch, so it is not an acceptable implementation of pitch-preserving backing slowdown. M3 may initially support uploaded backing at 100% only. Later add an evaluated, license-compatible time-stretch provider; render stretched variants ahead of play if needed and record stretch/alignment delay. Rubber Band is a candidate, but its official distribution is GPL with a separate proprietary commercial license option; check the chosen use and build before adoption. [Rubber Band licensing](https://breakfastquay.com/rubberband/)

### 6.5 Deterministic matching and scoring

SCORE-01: Each attempt is keyed by arrangement version, rate segment, loop iteration, event ID, scoring-policy version, and calibration version. A performed attack can match at most one target event. One target can receive at most one attack judgment; sustain samples may extend its evidence but cannot earn repeated attacks.

Initial monophonic matcher:

1. Reject unusable/stale observations; retain an explicit reason and assessment-coverage impact.
2. Build expected target candidates in the local time window, after applying the current transport map and calibrated offset.
3. Group observations into attack events with pitch stabilization. Repeated identical target notes require distinct attacks; a held note must not clear every future note.
4. Match ordered candidates one-to-one by time and pitch. Use a small local dynamic program or deterministic greedy matcher with tests for repeated and adjacent notes. Never search so far that a later correct note erases an earlier miss.
5. Compute pitch deviation and attack error separately. Initial beginner tolerance: ±50 cents, attack ±150 ms; optional tighter level ±25 cents/±80 ms after validation. Bound windows to avoid overlap at fast tempos; record the actual policy.
6. A clear wrong pitch in a usable window is an assessed mismatch. A target with no attack is a miss only if listening was active and sufficiently usable during its window. Sensor outage, mixed audio, or occlusion is unassessed/uncertain.
7. Do not penalize expressive duration or natural decay using an arbitrary constant-loudness gate. A dedicated sustain task uses authored tolerance and envelope-aware evidence.

Represent the judgment as `correct | incorrect | uncertain | not_assessed`, with reason codes and optional pitch/rhythm subjudgments. Correct pitch/late attack is expressible without losing either fact. No judgment may claim exact finger choice without independently validated visual evidence.

Derive the combined state from enabled dimensions only: any confidently incorrect dimension gives `incorrect`; all enabled dimensions assessed and correct gives `correct`; no assessed dimensions and no ambiguous evidence gives `not_assessed`; otherwise give `uncertain`. Preserve all subjudgments and their coverage even when the combined state is uncertain. Wait mode disables rhythm rather than treating an unavailable rhythm judgment as a failure.

For the initial UI, show **pitch accuracy = correct pitch judgments / assessable pitch judgments**, timing separately, and **coverage = assessable eligible targets / eligible targets**. If the denominator is zero, show “not assessed,” not 0%. Optional game points can use 70% pitch + 30% rhythm only when both were assessed; do not compare this score to wait/manual mode. Show mode and assistance level with every personal best. Keep leaderboard features out of the prototype.

After a phrase, give one actionable suggestion based on the most repeated adequately observed issue. If no reliable issue exists, ask for a replay or setup check. Record observable evidence, not invented explanations such as “your ring finger pressure was too low.”

## 7. Song import, transcription, and simplification

### 7.1 Three honest import routes

| Route | First supported phase | User receives |
|---|---|---|
| Valid authored score / app JSON | M1 fixture; M3 user import | Validated playable instructions, provenance retained |
| User audio + known/authored score | M3 | Backing playback, manual alignment, loops; no claim of automatic transcription |
| Clean isolated guitar audio | M4 experimental | Candidate notes for review; suggested playable fingering |
| Full mixed recording | M4+ experimental | Optional separation/analysis candidates with strong uncertainty labeling |

MusicXML/MIDI/Guitar Pro are later adapters, not a second internal truth. MIDI normally carries sounding pitches/timing, not exact finger/string choices. MusicXML and Guitar Pro may preserve more guitar-specific detail; imports must expose lost techniques and unsupported fields. A renderer such as alphaTab can reduce notation work later, but integrate through an adapter and prevent it from creating a competing transport. Its repository currently documents MPL-2.0 and separate font/SoundFont licenses; verify the pinned version. [alphaTab](https://github.com/CoderLine/alphaTab)

### 7.2 Upload UX and limits

Default: choose a local file, inspect metadata/duration, select a practice excerpt, choose its intended role, acknowledge rights, and choose local-only or an explicitly described hosted analysis route if available. No automatic upload merely because a local file was selected.

Initial M3 limits: WAV/MP3 supported only where decoding actually works; maximum 25 MiB and 180 seconds, with a recommended 15–30-second excerpt for experimental analysis. Enforce both encoded size and decoded duration/frame count: compressed size alone does not bound memory. A three-minute 48 kHz stereo float buffer is roughly 69 MB before copies. Avoid decoding long tracks multiple times. Gracefully reject unsupported codecs, DRM-protected files, corrupted headers, zero-length audio, excessive channels, and memory exhaustion. No URL downloader or DRM bypass.

For each import show: “backing only,” “score attached,” “candidate transcription,” “review needed,” or “reviewed arrangement.” Never manufacture a score when analysis is unavailable.

### 7.3 Analysis pipeline

All expensive analysis occurs before gameplay, with progress, cancellation, resource limits, and recoverable intermediate artifacts.

1. **Ingest:** validate bytes/type/duration, generate asset ID/hash, preserve original unchanged, record owner/rights state, decode in a controlled worker or service.
2. **Select task:** melody, rhythm/chords, isolated guitar part, or backing-only. Ask which part the learner wants; do not assume the loudest instrument is guitar.
3. **Normalize for analysis:** preserve source timing and original sample rate metadata; create a resampled analysis copy only as needed. Record leading trim/padding and resampling transforms.
4. **Separate optionally:** if the source is a mix, try a registered separation provider with suitable rights and resources. Retain artifacts and uncertainty. A four-stem “other” channel is not an isolated guitar. Demucs offers an experimental six-source guitar/piano model, but the original repository is archived and describes limited maintenance; it is a research candidate, not an unqualified production dependency. [Demucs repository](https://github.com/facebookresearch/demucs)
5. **Estimate structure:** onset grid, beat/tempo candidates, downbeat/meter hypotheses, and optional key/chord candidates. Half/double-tempo and wrong downbeats must be easy to correct. Keep a free-time/manual route.
6. **Estimate notes:** a clean-instrument pitch/transcription provider returns onset, offset, pitch/contour, strength, and model-score metadata. Basic Pitch supports polyphonic transcription and works best on one instrument at a time; it supplies note candidates, not verified exact guitar fingering. Its repository documents Apache-2.0. [Basic Pitch](https://github.com/spotify/basic-pitch)
7. **Postprocess conservatively:** filter obvious noise, merge fragments with logged rules, preserve bends/uncertainty where supported, and avoid forcing every event onto a rigid grid. Keep unquantized estimates and quantized candidates separately.
8. **Create playable candidates:** choose string/fret/finger possibilities under the learner's tuning, capo, range, and technique constraints. Pitch estimation is not fingering recovery.
9. **Review:** highlight uncertain regions, offer original/candidate audio and slow looping, require user/teacher confirmation before treating an experimental candidate as reliable assessment material.
10. **Derive simplified versions:** create a new arrangement with parent links and transformation log. Preserve the candidate/raw source for comparison.
11. **Publish privately to practice:** generate a validated immutable arrangement version. Public sharing requires a separate rights workflow and is disabled initially.

Each job records provider/version, weight hash, config, source hash, transforms, model scores, measured elapsed time, and errors. Never turn a raw model score into a claimed percentage probability without calibration. Missing confidence is `null`, not a default 100%.

### 7.4 Review editor requirements

Show waveform, musical grid, optional spectrogram, candidate notes, playable tab, and timing anchors. Support moving/splitting/merging notes, changing pitch/duration, correcting tempo/downbeat, choosing a fingering alternative, and marking an event unsupported or ambiguous. Add audition, local undo/redo, keyboard entry, original/candidate/reviewed comparison, and save-as-new-version.

Alignment uses at least two verified anchors when possible; require strictly increasing ticks and source seconds. Warn if anchor slopes imply implausible speed or a repeated/omitted section. An audio source may have a pickup, silence, rubato, repeats, or cuts. Do not stretch a single linear offset across a structurally different score. Piecewise alignment and explicit section mapping are required before calling a song synchronized.

### 7.5 Fingering solver and simplification

For pitch MIDI `p`, string `s`, tuning pitch `T(s)`, and full capo `C`, candidate relative fret `f = p - T(s) - C`, with `0 ≤ f ≤ maxFret`. Capo-relative fret 0 sounds at the capo; physical fret is `C+f`. Partial capo is unsupported initially. Standard tuning in **string-1-to-6 order** is `[64,59,55,50,45,40]`; the setup low-to-high array uses the reverse order.

Enumerate pitch-compatible positions. For a simultaneous chord, enforce one sounding note per string, plausible finger count, reviewed barre rules, and no forbidden span. For successive events, solve a sequence using dynamic programming/beam search. A proposed cost is `handShift + weightedFretSpan + stringCrossing + fingerChange + unfamiliarShape + techniquePenalty + lostMusicalInformation`. Weights are configuration reviewed with a teacher, not presented as measured human difficulty. A pitch may be impossible under chosen constraints: return “no playable version found,” never an impossible tab.

Beginner profiles: frets 0–3 (later 0–5), no barre/bends, few simultaneous notes, familiar open chords, slower changes, clear rests. Hand size is an optional user preference, not something inferred from a camera image. Allow teacher/user overrides.

Derivation levels:

| Level | Transformation | Must disclose |
|---|---|---|
| Pulse | Count/tap or muted strum rhythm only | Does not reproduce melody/harmony |
| Roots | Selected harmonic roots or bass movement | Octave and part may differ |
| Single melody | Selected clear melodic line with playable positions | Omits accompaniment and may require octave shifts |
| Easy harmony | Familiar chord substitutions, fewer changes, downstrokes | Changes voicings/extensions or harmonic detail |
| Intermediate | Fuller voicings and rhythm, selected embellishments | Still an arrangement |
| Reviewed full part | Richest verified representation available | Exactness limited by source and review |

Preserve strong beats, recognizable phrase contour, and important rhythm where possible; remove ornaments or density before changing the core phrase. Never silently transpose the score over an unchanged backing. A key change must also change compatible synth/backing, require a capo/tuning setup the learner can perform, or explicitly disable incompatible backing. Display original key, new key, capo, tuning, octave shifts, omissions, and technique substitutions.

Example: candidate phrase with sixteenth-note ornaments and a barre shape → retain phrase landmarks as quarter/eighth notes → choose open-position melodic pitches where possible → replace a dense voicing with a reviewed simpler chord → mark the result “easy arrangement.” Explain each change. Do not claim these substitutions reproduce the original part exactly.

### 7.6 Analysis failure states

Standard reasons: `unsupported_format`, `too_large`, `too_long`, `decode_failed`, `mixed_source`, `low_signal`, `provider_unavailable`, `model_not_licensed`, `resource_limit`, `alignment_ambiguous`, `no_playable_fingering`, `cancelled`, `internal_error`. Offer backing-only playback, an original exercise, a smaller excerpt, or manual score entry. Preserve user edits across provider retries.

## 8. Camera coaching

### 8.1 Scope and physical limits

CV is optional, off by default, local-first, and never required to use a lesson. M1 does not implement camera assessment. The first camera experiment should answer a narrow question: “Can we consistently see the fretting hand and a calibrated fretboard region in this setup?”

Generic hand landmarks do not identify guitar frets/strings or contact pressure. MediaPipe is a candidate landmark provider; its web inference methods block their calling thread, so run them in a worker at a limited rate. [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)

### 8.2 Calibration and capabilities

1. Explain what stays on-device and request camera permission only on entering camera setup.
2. Show a framing overlay. Offer an oblique view of the fretting hand and first few frets; allow a second view later, without requiring it.
3. Have the learner mark nut/capo line, visible fret boundaries, and outer-string guides. A planar homography is only valid for a suitable approximate fretboard plane, not for fingertips hovering above it.
4. Ask the learner to hold one reviewed known shape; fit geometry and evaluate visibility. Mirror only the preview, preserving handedness and image-coordinate metadata.
5. Restrict feedback to supported evidence: hand present, visible index-finger region, rough position relative to the calibrated fret area. If visibility fails, show “cannot see this clearly.”

Do not announce exact fret/string contact from a fingertip landmark projection alone. Fingertips may be above the board, hidden by the neck, or between strings. Pressure and pain remain unobservable. Whole-body safety judgments and biometric identity recognition are out of scope.

### 8.3 Audio/vision fusion

Use independent capability evidence rather than averaging unrelated scores. Audio might support “target pitch heard”; vision might support “index finger visible near first-fret region.” Fusion may suggest a check: “I heard the expected pitch. If that is the shape you intended, pluck the next string.” It must not upgrade this to “all fingers are correct.”

Every result carries source modality, timestamp, quality, uncertainty reason, and supported assertion. Stale camera evidence cannot validate a later audio note. Set an initial freshness target ≤250 ms and drop stale frames rather than queue them indefinitely. Reduce camera rate before allowing audio dropouts. Camera failure never lowers the musical score.

### 8.4 Research gate

Evaluate across handedness, skin tones, lighting, neck finishes, common guitar sizes, and camera qualities, using consented adult data. Split evaluation by person and instrument to reduce leakage. A teacher labels the narrow geometric assertions. Before enabling any corrective placement message, target ≥95% precision for that exact assertion on held-out sessions and publish its abstention/coverage rate; do not hide low coverage behind high precision. If it misses the gate, keep a framing aid or optional self-view rather than punitive coaching. Do not train a new vision model using the expiring coding credits.

## 9. Modular architecture and ML boundaries

### 9.1 Local prototype

Use a pnpm TypeScript workspace with a React/Vite web app. Choose compatible installed stable package versions at implementation time, pin them, and save the lockfile. Avoid inventing future version numbers or adding a state-management framework before a simple explicit state model proves insufficient.

```text
apps/web
  UI / accessibility / setup / lessons / practice / review
  AudioWorklet: bounded PCM capture, frame timestamps, lightweight metering
  Web Workers: detector, optional transcription, optional camera, optional stretch
packages/domain       score types, schema validation, tuning, capabilities, rights
packages/transport    tempo/alignment maps, segment clock, scheduler
packages/assessment   observation contracts, matching, scoring, coverage
packages/learning     lesson runner, skill graph, practice recommendations
packages/storage      IndexedDB, assets, migrations, export/import
packages/providers    DSP / ML / notation / coach interfaces and adapters
content               original lessons, reviewed shapes, original fixture manifests
tests/fixtures        synthetic and consented original evaluation recordings
docs                  specification, decisions, acceptance, limitations, handoff
```

Small modules can initially be directories inside one package; do not build a publishing system or many services before M1 works. Transport, domain, and assessment must remain independently testable.

Data flow: `mic → timestamped PCM → detector → observations → matcher → judgments → lesson/game state → UI`. Separately, `score → transport → audio scheduler + visual cursor + expected targets`. These paths meet in the matcher, never through UI render timing. Progress summaries go to local storage. Raw camera frames and PCM do not enter the analytics path.

### 9.2 Provider contracts

All providers expose `id`, `version`, `capabilities`, `inputFormats`, `resourceRequirements`, `licenseManifest`, and `health`. Use async initialization with progress/cancellation; `dispose()` releases resources. Include an unavailable implementation that reports unsupported capability, not invented output.

```ts
type AssessmentState = 'correct' | 'incorrect' | 'uncertain' | 'not_assessed';
type SignalQuality = 'good' | 'poor' | 'unavailable';
type Capability = 'isolated_pitch' | 'attack_time' | 'pitch_contour'
  | 'chord_pitch_set' | 'hand_visible' | 'rough_fret_region';

interface AudioObservation {
  id: string;
  providerId: string;
  analysisStartContextSec: number;
  analysisEndContextSec: number;
  onsetContextSec: number | null;
  producedAtPerformanceMs: number;
  pitchHz: number | null;
  pitchMidiFloat: number | null;
  quality: SignalQuality;
  modelScore: number | null; // not a calibrated probability by default
  reasonCodes: string[];
}
interface Judgment {
  attemptId: string;
  targetEventId: string;
  observationIds: string[];
  state: AssessmentState;
  pitchState: AssessmentState;
  rhythmState: AssessmentState;
  timingErrorMs: number | null;
  pitchErrorCents: number | null;
  reasonCodes: string[];
  policyVersion: string;
}
```

Define these interfaces without coupling domain code to TensorFlow, ONNX, a cloud vendor, or an LLM SDK:

- `PitchDetector`: stream PCM → timestamped monophonic observations.
- `OnsetDetector`: PCM → attack candidates; can share features with pitch DSP.
- `ChordAssessor`: bounded audio + expected chord vocabulary → pitch-set evidence, explicit unsupported mode.
- `Transcriber`: asset + task/config → raw note/contour candidates and provenance.
- `Separator`: asset → aligned stems, roles, leakage/quality metadata.
- `BeatAligner`: asset → candidate beat map and ambiguity flags.
- `FingeringPlanner`: pitch events + instrument/profile → constrained playable candidates and rejected reasons.
- `Simplifier`: reviewed source arrangement + learner profile → new arrangement with transformation log.
- `VisionAssessor`: timestamped frames + calibration → narrow visual evidence.
- `Coach`: structured evidence + reviewed lesson context → explanation and permitted next action.
- `TimeStretch`: source + requested rate → audio, latency, and source/output mapping.

Provider availability is a capability matrix, exposed to UX. Never imply a provider supports polyphony because a monophonic function exists. Pin code version, model artifact checksum, and configuration. Keep upgrades reversible and benchmark before switching defaults.

### 9.3 LLM policy

The application does not need an LLM to tune, teach the seed lessons, or score the prototype. Use deterministic authored feedback first. A future coach receives a compact evidence summary such as `{target, observedPitch, timing, quality, lessonStep, supportedClaims}` and retrieved reviewed lesson text. It may explain and suggest from an allowlist; it may not change the score, override confidence, diagnose injury, invent a detected motion, execute code, or alter rights metadata.

Do not send continuous audio/video to a general-purpose text/vision model for per-note judgments. Optional cloud coaching is explicitly opt-in, rate-limited, server-keyed, and independent of the audio clock. Treat song titles, comments, score text, and retrieved content as untrusted data; they cannot become tool instructions. Provide a deterministic fallback when the provider fails or budget is reached.

### 9.4 Future hosted processing

Only add services when the local product needs them: a small authenticated API/control plane, object storage, a jobs table/queue, and isolated CPU/GPU workers. A practical proposal is FastAPI for Python audio tooling, PostgreSQL for metadata, S3-compatible objects, and a queue adapter. Pick the smallest maintained deployment that fits measured workloads; no Kubernetes requirement.

The app remains usable when servers are offline. Hosted jobs use authenticated ownership checks, short-lived signed asset URLs, per-user quotas, cancellation, timeout/retry policies, and versioned outputs. CPU-only paths remain available for suitable small excerpts. Do not promise GPU availability in Claude's cloud coding environment; coding containers are not production inference infrastructure.

Worker sandbox: no arbitrary user-supplied URLs, shell fragments, plugin code, or pickle/model execution. Decode media in a constrained process with memory/CPU/time limits. Allowlist provider artifacts. License/rights eligibility is checked before starting a model or sharing results.

### 9.5 Performance and fallback

Targets on a documented reference laptop: smooth practice rendering near 60 fps, no audible drops during a ten-minute original exercise, bounded audio queue, and responsive controls during analysis. Record actual processor/browser/device rather than saying “works on all laptops.” A low-power mode reduces decoration/camera rate before compromising sound. A WebGPU acceleration path is optional with CPU/WASM fallback or a clear capability-unavailable state.

Use message passing with bounded transferable buffers first. SharedArrayBuffer is optional and requires cross-origin isolation and compatible hosting; it must not be the sole working route. Bundle/self-host versioned worker/model assets where licensing permits. Large model downloads need a visible size and user action, not an unexpected first-visit download.

## 10. Data contracts and future service APIs

### 10.1 Core conventions

The accompanying `gu-score-v1.schema.json` defines the **initial supported subset**: standard six-string monophonic notes, integer ticks, a single constant tempo, 4/4 meter, rights metadata, and optional source-audio alignment. It deliberately rejects unsupported event kinds, techniques, tuning changes, and polyphony. Evolve through a versioned migration rather than silently discard fields. The supplied `original-exercise.gu-score.json` validates against it.

V1 fixes capo at zero and supports attack/pitch assessment only; sustain assessment is explicitly false. Later capo, contour, chord, and movement-cue extensions require a declared schema/capability revision. Handedness is a display/profile setting, not a change to stored string numbers. Gaps between note events represent rests in this subset.

Canonical conventions:

- Sounding MIDI note numbers, not written guitar staff octave. Fractional pitch/bends require a later contour contract; do not silently round them into ordinary notes.
- String numbers 1–6, high to low. The instrument's open pitches are indexed by that numbering. Frets are capo-relative. `finger:null` means unspecified, not open string. Fret 0 cannot require a fretting finger.
- Integer PPQ ticks; `startTick ≥0`, `durationTicks >0`; deterministic event order by start then ID. Duration ticks describe musical intent, not guaranteed acoustic envelope.
- IDs are stable across render/seek; edit creates a new arrangement version. Derived notes carry source-event references when source events exist. Transformations preserve original artifacts.
- Each arrangement has explicit role: original exercise, transcription candidate, reviewed part, or simplified arrangement. Provenance and rights attach to assets and arrangements separately.
- Schema validation is necessary but not sufficient. Semantic checks enforce pitch/fret/tuning compatibility, unique IDs, ordered events, non-overlap for v1, score bounds, anchor monotonicity, and valid source references.

Enable the validator's date-time format checks explicitly; some JSON Schema libraries treat `format` as annotation unless configured. Do not accept NaN/Infinity as JSON numbers. Treat allowed-use metadata as a declaration to evaluate, not permission granted merely by importing a file.

Future rich score requirements: chord/voicing events, rests, strum direction, fingering alternatives, muted strings, prepare/press/release cues, ties, technique contours, multiple parts, repeat expansion, meter/tempo changes, and source-to-score section maps. A rest is never confused with microphone failure. Display unsupported techniques, but mark assessment unassessed until supported.

### 10.2 Storage entities

| Entity | Key contents |
|---|---|
| InstrumentProfile | Tuning, capo, handedness/display preference, supported fret count |
| LearnerProfile | Goals, preferred duration, chosen constraints; minimal personal data |
| Lesson and LessonStep | Versioned reviewed content and supported assessment policy |
| SkillEvidence | Skill, state, evidence type, timestamp, lesson/policy version |
| Asset | Hash, MIME/size/duration, local/blob reference, ownership/rights, retention |
| SourceAnalysis | Provider/version/config, raw candidates, transforms, uncertainty |
| ArrangementVersion | Immutable validated score, parent version, transformation log |
| AlignmentMap | Tick/source-second anchors, section structure, review status |
| CalibrationProfile | Local device route, offset/spread, method, validity |
| PracticeAttempt | Score version, loop/rate, calibration/policy, observation summaries |
| PracticeSummary | Assessed counts, coverage, pitch/rhythm results, next suggested drill |
| Job | State/progress, owner, provider, resource estimate, cancel/error, artifact refs |
| ConsentRecord | Purpose, scope, version, time, revocation; hosted features only |

Use IndexedDB with versioned migrations and transactional writes. Separate large audio blobs from small progress metadata. On quota failure, explain what was not saved, offer export/delete, and do not falsely report saved progress. Local data is device/browser-specific and can be cleared by browser behavior; offer explicit export. No undisclosed cross-device sync.

Export uses an app-owned versioned JSON manifest with optional user-selected assets. Import validates schema, byte limits, semantic references, and provenance. Never execute embedded scripts or trust archive paths. A local progress export excludes raw audio/video by default. An imported self-report remains a self-report.

### 10.3 Proposed hosted API, when needed

These endpoints are future contracts, not prototype dependencies. Prefix `/v1`; use authenticated opaque IDs, JSON errors `{code,message,retryable,requestId}`, ownership enforcement on every object, and idempotency keys on job creation.

| Endpoint | Request / behavior |
|---|---|
| `POST /assets/init` | Name/type/size/duration hint/rights scope; server validates quota and returns short-lived upload URL plus asset ID |
| `POST /assets/{id}/complete` | Verify stored bytes, detected MIME, decoded bounds, checksum; only then mark usable |
| `POST /analysis-jobs` | Asset ID, excerpt bounds, task, allowed provider, config version, consent ID; return `202` + job ID |
| `GET /analysis-jobs/{id}` | State, current stage, measured progress if available, warnings/errors, result references |
| `POST /analysis-jobs/{id}/cancel` | Idempotent cancellation; worker checks checkpoints; disclose billing already incurred |
| `GET /arrangements/{id}/versions/{version}` | Owner/authorized-reader-only immutable validated score |
| `POST /arrangements/{id}/versions` | Base version + edits; optimistic concurrency; return conflict on stale base |
| `POST /coach` | Reviewed lesson refs + bounded evidence summary; no default media; enforce quotas |
| `DELETE /assets/{id}` | Revoke URLs/access promptly; cascade derivative deletion or show intentional retained dependencies |
| `POST /data-export` / `DELETE /account-data` | Authenticated export/deletion with status receipt and disclosed retention constraints |

Job states: `queued → validating → decoding → analyzing → awaiting_review → completed`, with `failed` or `cancelled` terminal exits. Separation and transcription can be named sub-stages. Retry transient infrastructure errors with bounded backoff; do not retry invalid media or unclear music indefinitely. A retried idempotency key cannot create duplicate billable work. Only terminal validated artifacts appear as available for practice.

## 11. Privacy, security, rights, and licensing

### 11.1 Local-first privacy contract

PRIV-01: Mic PCM and camera frames stay in transient local processing buffers by default. A diagnostic rolling buffer, if useful, is bounded and in memory; it is neither saved nor transmitted without a separate user action. No face recognition, identity embeddings, advertising profiles, or training on user performances by default.

PRIV-02: Independent, just-in-time permission for mic, camera, hosted analysis, optional coaching, recording, and diagnostics. “Use microphone” does not mean “upload recordings.” Show visible listening/camera state and stop controls.

PRIV-03: Local persistence holds only selected settings, skill evidence, scores, and summaries unless the user deliberately saves media. Local storage is not a secret vault; avoid collecting sensitive identity data and explain shared-device implications.

PRIV-04: Proposed hosted default: raw uploads and derived stems auto-delete within 24 hours of job completion, or within 24 hours after a failed/abandoned job; a hard 72-hour maximum from upload unless the user deliberately chooses longer private storage. Save a reviewed score only on explicit request. Deletion removes active access promptly; backups expire within a disclosed target of 30 days, with documented legal exceptions. These are policies to implement and verify, not claims about an unspecified provider.

PRIV-05: Do not promise local/offline operation while loading undeclared third-party scripts/models or telemetry. After the static app, lessons, and chosen assets have been downloaded, the target core loop should work offline. Show caching state and update controls. Network audit must confirm the actual implementation's behavior.

PRIV-06: Prototype adult pilot first. Before a child-directed or broader minors release, determine applicable age/consent rules by launch market and implement the required parental/privacy process. A label saying “13+” or “18+” alone does not determine legal coverage. The FTC explains that COPPA can apply beyond explicitly child-branded sites. [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business)

### 11.2 Rights rules for music

Musical compositions and sound recordings are distinct copyrighted works and can have different owners. Owning a recording file or paying for a streaming subscription does not establish permission for every app use. [U.S. Copyright Office: music and copyright](https://www.copyright.gov/engage/musicians/)

| Use | Product rule |
|---|---|
| Bundled original exercises | Keep author/creation record and explicit distribution license |
| Public-domain composition | Check territory and version; the specific recording/arrangement may still be protected |
| User's own original performance/composition | Record the user's rights declaration and intended scope |
| Uploaded third-party recording | Private-by-default and only within applicable rights/exceptions; no automatic public distribution |
| Derived tab or simplified arrangement | Keep composition/arrangement rights status; transformation does not automatically clear it |
| Lyrics, album art, commercial stems | Require their own clearance before inclusion |
| Public catalog and sharing | Separate licensing workflow, permissions by use/territory/duration, takedown/contact mechanism |
| Spotify/YouTube/other service URLs | No scraping, unauthorized downloading, DRM circumvention, or inference that API access licenses transcription |

Do not state that private educational use is universally lawful or that an upload checkbox creates a license. Determine permitted local analysis, server copying, arrangement creation, synchronized use, display, and sharing for the intended markets before offering the corresponding public features. U.S. copyright law explicitly includes musical arrangements among derivative works; other jurisdictions and uses require their own review. [17 U.S.C. chapter 1](https://www.copyright.gov/title17/92chap1.html)

Initial product decision: ship original exercises and private local imports; disable public music sharing and a commercial-song catalog. This reduces operating complexity but is not a blanket legal exemption. Obtain jurisdiction-specific advice before public launch of upload/derivation services.

Rights metadata separates declaration from verification: `unknown`, `user_declared`, `verified`, `restricted`. Store asset author/source/license/version/territories/expiry, allowed uses, evidence reference, and reviewer. Unknown rights block redistribution, not silently become “public domain.” Hashes are useful for provenance/deduplication, not proof of ownership.

### 11.3 Software, weights, and dataset licenses

Maintain `THIRD_PARTY_NOTICES` plus a machine-readable manifest listing package/version/license, weight artifact/version/hash/license, dataset source/terms, codecs, fonts, audio samples, and teacher assets. Code licenses do not by themselves resolve model-weight or training-data rights. Verify exact artifacts before commercial distribution or hosted processing; no noncommercial-only model in a paid feature without permission.

Candidate register:

| Candidate | Why evaluate | Required check |
|---|---|---|
| Browser DSP implementation | Fast local isolated-note analysis | Actual source license, correctness, worst-case CPU |
| Basic Pitch | Clean-instrument transcription baseline | Pin code/model artifacts; check bundled and converted-model notices |
| MediaPipe | Optional hand landmark baseline | SDK and model terms separately; bundled model asset provenance |
| Demucs/fork | Experimental stem separation | Archived/maintenance status, exact code/weights terms, quality/resources |
| alphaTab | Later notation/import adapter | Pinned version license, attribution, bundled font/sample licenses |
| Rubber Band or alternative | Pitch-preserving slowdown | GPL/commercial compatibility of actual distribution/linking |
| Guitar datasets | Offline benchmarking | Dataset, performances, annotation and usage terms, consent/attribution |

GuitarSet is a useful annotated guitar benchmark candidate; check the actual dataset download license and splits before use. Do not confuse a paper's publication license with the dataset's recording license. [GuitarSet dataset record](https://zenodo.org/records/3371780)

“Guitar Unhero” is a working name. Conduct trademark/name/domain review before release, use original visual/audio assets, and do not imply affiliation with Guitar Hero, Ultimate Guitar, or existing teachers/services.

### 11.4 Security and operations

- Treat audio parsers, MIDI/XML/score importers, and archives as hostile-input surfaces. Enforce limits, disable XML external entities, reject traversal/ZIP bombs, and sanitize rendered metadata.
- No API secrets in browser bundles, repositories, score metadata, or screenshots. Hosted keys stay server-side with scoped permissions and rotation.
- HTTPS in hosted use; secure-origin requirements and user gestures are handled for device access/audio startup. Set a suitable CSP and permission policy; scope camera/microphone to the app.
- Cross-user asset/job/version IDs never authorize access by themselves. Test direct-object access and signed-URL expiry.
- Logs contain request IDs, capability/provider versions, timing and error categories; no raw media, full song text, access tokens, or unnecessary identifiers. Diagnostics are opt-in and redact device names/paths.
- Hosted launch includes quotas, per-job resource caps, circuit breakers, abuse controls, incident contacts, deletion jobs, backup restore checks, and a cost dashboard. A free public upload endpoint without quotas is out of scope.

## 12. Evaluation and acceptance criteria

### 12.1 Verification layers

Use pure unit tests for timing/maps, tuning/fingering, matchers, validation, and adaptation; deterministic audio fixtures for DSP; browser integration tests for real UI/device states; and human guitar trials for acoustics and teaching. Simulated media is valuable for repeatability but cannot certify a physical mic, room, or camera.

Reference suite: clean synthesized fundamentals/harmonics across E2–E6, plucked decays, detuned notes, repeated attacks, wrong notes, silence, hum, clipping, variable gain, and controlled noise. Add consented original recordings on acoustic/classical/clean electric guitar and several devices. Keep development and held-out recordings separate. Document sample rates, signal levels, rooms, devices, and expected results. Do not distribute music or performances without appropriate rights.

Every result is labeled **passed**, **failed**, **not run**, or **not applicable** with environment/version. “Tests written” is not “tests passed.” Never invent an evaluation result to fill this document.

### 12.2 M1 release gate

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-01 | Fresh checkout installs, starts, builds, and runs documented tests with the lockfile | Clean environment; record commands and versions |
| AC-02 | Fixture validates; malformed/unsupported scores produce actionable errors | Schema and semantic tests, no silent field loss |
| AC-03 | String numbering, tuning, and MIDI conversion match all supplied examples | Unit tests; left-handed rendering retains IDs |
| AC-04 | Welcome → setup → tuner → lesson → practice → summary is navigable | Browser test plus manual desktop review |
| AC-05 | Mic denied/absent/busy/disconnected produces recovery controls; no fabricated assessment | Browser mocked-device tests and local manual check |
| AC-06 | Simulation mode is labeled persistently and cannot count as live assessed mastery | E2E and persistence tests |
| AC-07 | On synthetic steady signals in the declared range, target median absolute pitch error ≤3 cents and p95 ≤5 cents after stabilization | DSP fixture report at 44.1/48 kHz; distinguish tones from guitar |
| AC-08 | On a held-out set of clean isolated guitar notes, target ≥95% within ±15 cents on assessable frames; report coverage separately | Recorded/hardware report; if not run, alpha-only with limitation |
| AC-09 | Five seconds of silence/noise-only never locks “in tune” | Automated fixtures and manual input check |
| AC-10 | Strong second-harmonic fixture does not cause a confident selected-string wrong-octave lock | Harmonic/detuning regression cases |
| AC-11 | Steady isolated-note visible feedback target p95 ≤200 ms on reference hardware; low notes may be slower and must be reported | Measured end-to-end reference test, not inference runtime alone |
| AC-12 | Constant-tempo target positions and tempo/rate mapping are mathematically exact within rounding policy | Fake-clock tests at several rates and seek points |
| AC-13 | Audio/cursor alignment target p95 ≤30 ms on a wired reference setup, and drift ≤20 ms over 10 minutes | Instrumented scheduled-output/cursor measurements; report fallback limitations |
| AC-14 | One attack cannot clear repeated target notes; one target cannot earn duplicate attack credit | Matcher cases with held notes, bursts, repeated pitches, and loops |
| AC-15 | Poor/unavailable input produces uncertainty/unassessed; denominator zero shows “not assessed” | Scoring and UI tests |
| AC-16 | Correct pitch/late timing are recorded independently; wait mode does not grade rhythm | Pure tests and visible summary |
| AC-17 | Pause, seek, restart, rate change, A–B wrap, context suspension, and device loss do not leave old sources or judgments active | Transport integration tests |
| AC-18 | Headphone/direct-input supported setup resists backing-only false successes; speaker mode cannot imply validated precision | Leakage fixture and actual hardware smoke test |
| AC-19 | First lesson explains string/action/listening goal and has repeat/self-check choices | Content review; five-adult pilot before broad curriculum claims |
| AC-20 | Reload restores progress/settings; import/export round-trip; delete clears selected local data | IndexedDB integration and migration tests |
| AC-21 | No mic PCM/camera frame network requests during core practice | Network inspection, telemetry audit, no runtime LLM dependency |
| AC-22 | Keyboard controls, visible focus, text alternatives, reduced motion, and color-independent notes work | Accessibility automation plus human keyboard/screen-reader spot check |
| AC-23 | All bundled content has explicit provenance; no unlicensed commercial examples | Asset/license manifest review |
| AC-24 | Working source checkpoint and exact known limitations survive the cloud session | Branch/commit, README, test report, HANDOFF.md |

Hardware-dependent AC-08/11/13/18 cannot be declared passed by a headless cloud environment alone. A functioning prototype may be handed to the user with these clearly pending; a public accuracy claim or full supported-device release may not.

### 12.3 Later gates

| Area | Minimum proposed gate before enabling the capability |
|---|---|
| Backing import | Limits/codec errors verified, manual two-anchor sync works, edits survive reload, pitch preserved or 100%-only limitation explicit |
| Clean-guitar transcription | Onset/pitch note F1 target ≥0.85 on a declared held-out isolated-guitar set at ±50 ms onset and ±50 cents pitch; report onset+offset F1 separately with offset tolerance max(50 ms, 20% note duration) |
| Mixed recordings | Separate benchmark from isolated guitar by genre/effects/polyphony; no universal accuracy claim; automatically low-confidence regions require review |
| Fingering generation | 100% generated notes within tuning/fret range; no duplicate simultaneous string use; impossible constraints rejected; teacher reviews representative transitions |
| Simplification | Every changed pitch/rhythm/voicing logged; no silent key/backing mismatch; teacher verifies all bundled derived arrangements |
| Chord feedback | Precision target ≥95% for each supported chord assertion with full confusion matrix and coverage; no chord-completeness claim from root alone |
| Camera | Narrow placement message precision target ≥95%, person/instrument-held-out data, coverage and occlusion failure rates reported; no pressure claims |
| Hosted jobs | Unauthorized access, duplicate-job prevention, cancellation, quota, decoder limits, deletion/retention, and provider outage cases pass |
| Public beta | Rights/content/privacy review, actual device matrix, support/takedown contact, operating budget and abuse controls exist |

F1 thresholds are proposed product gates, not published performance of the suggested models. If a provider misses its gate, restrict the feature to review-assisted experimental use or keep it unavailable; do not lower claims without changing the UX and evaluation report.

### 12.4 Five-minute owner smoke test

1. Start the app locally, choose the actual microphone, and see signal when plucking. Deny permission once and verify recovery.
2. Select each string in the tuner, compare against a trusted tuner, and verify silence is not recognized as a stable note. Do not intentionally overtighten strings for testing.
3. Complete the high-E lesson. Play a deliberate correct and wrong note; check that feedback is plausible and specific.
4. Play the original fixture at 50/75/100% synthesized tempo. Pause/restart/seek/loop. Try holding one note over repeated targets and confirm it does not earn repeated attacks.
5. Disconnect the input, reload, export progress, and inspect the summary. Device loss must not look like musical failure; saved progress must remain recoverable.

## 13. Phased implementation and backlog

### 13.1 Milestones and dependencies

| Milestone | Deliverable and dependencies | Completion gate | Planning timebox / budget ceiling |
|---|---|---|---|
| M0 Foundation | Inspect repo, choose compatible versions, score contract/fixture, domain tests, basic routed shell, CI commands | Fixture loads; app builds and tests run; source saved | 1–2 focused hours; $20 |
| M1 First learning loop | M0 + capture/tuner + first lesson + synth/highway/transport + isolated-note matcher + progress | AC-01–24, physical checks explicitly pending where needed | 6–12 focused hours as an ambitious prototype target; $75 |
| M2 Usable teaching alpha | M1 + reviewed seed lessons/chords, adaptive loops, recall mode, accessibility/offline polish | Usability pilot and lesson/progress review | 3–6 additional hours for a narrow pass; $40 |
| M3 Song workspace | M1 stable + local backing import, manual alignment, constrained original-score editor and simple derived arrangement | Backing/import/fingering/simplification gates | 4–8 additional hours for limited scope; $30 |
| R Integration and repair | Tests, timing/signal failures, real-guitar feedback, clean setup and handoff | No known core data-loss or timing bug; reproducible checkpoint | Protected allocation throughout; $60 |
| C Contingency | Unexpected install/device/build blockers | Smallest working result preserved | $24 |
| M4 Transcription experiment | M3 + isolated-guitar model adapter and evaluation, optional separator research | Provider gate or clearly labeled candidate-review mode | Later days/weeks; not committed to the expiring balance |
| M5 Camera experiment | Stable audio + calibration UI + narrow visibility/placement benchmark | Narrow camera gate | Later weeks; not committed to the expiring balance |
| M6 Public beta | Adult pilot, content/rights/privacy review, device coverage, operations | Public-beta gate | Further weeks/months depending on scope/team |

Timeboxes above assume focused implementation, available tooling, and rapid feedback. They are not promises that an inexperienced founder or an autonomous model will finish each phase in that time. Audio/device debugging may consume the entire deadline. Gate the next phase on a working prior phase, not on the calendar.

**Deadline strategy:** finish and preserve M1 first. If there is enough time and the core is stable, improve M2. M3 may be restricted to backing-only plus manual alignment. Do not consume the repair allocation implementing camera or full-mix transcription. A dependable tuner and learning game is a meaningful first product.

### 13.2 First-session task order

1. Inspect repository and preserve unrelated changes; write concise assumptions and architecture notes.
2. Validate supplied fixture/schema and implement semantic validators.
3. Implement pure tempo/segment mapping, synth transport, and original exercise playback with no microphone.
4. Render the lanes from transport; exercise pause/seek/loop/rate transitions.
5. Add microphone setup, metering, worklet timestamps, detector, and tuner. Benchmark a clean isolated note.
6. Add observation matching and visible coverage/uncertainty; prevent synth leakage from being scored.
7. Connect the first lesson, then save progress and settings.
8. Run relevant automated checks, inspect browser UI, save source, and provide local hardware instructions.

This order separates transport errors from input-recognition errors and produces a usable intermediate result quickly. Do not build account systems, billing screens, or a large dashboard before this path works.

### 13.3 Deferred work as actionable tickets

| Ticket | Prerequisite | Concrete result |
|---|---|---|
| GU-101 | M1 | Record and label original held-out guitar set; evaluate detector false rejection/coverage |
| GU-102 | M1 | Calibrated wired-device timing report, invalidation on route change |
| GU-103 | M1 | Review high-E/Em/Am lessons with a teacher; record corrections and rights |
| GU-104 | M2 | Offline core cache and progress migration failure recovery |
| GU-201 | M1 | 25-MiB/180-s local backing importer with decoder/memory limits |
| GU-202 | GU-201 | Two-anchor alignment editor with undo/version persistence |
| GU-203 | Score editor | Fingering solver for monophonic open-position phrases, impossibility tests |
| GU-204 | GU-203 | Root/melody/easy-arrangement transform with explainable log |
| GU-301 | M3 | Basic Pitch adapter benchmark on clean original excerpts; preserve raw outputs |
| GU-302 | GU-301 | Model/weights/dataset license register, resource/cancellation limits |
| GU-303 | GU-302 | Evaluate separation candidate on declared mixes; never treat “other” as guitar |
| GU-401 | Stable audio | Worker-based hand visibility prototype and explicit fretboard calibration |
| GU-402 | GU-401 | Consented evaluation with teacher labels; enable only claims meeting the gate |
| GU-501 | Public-beta plan | Hosted threat model, rights workflow, deletion/quotas, operating cost forecast |
| GU-502 | Evidence APIs | Optional LLM coach grounded in reviewed content and capability allowlist |

## 14. Claude model, credit, and token strategy

### 14.1 Correct billing route

The user clarified that their existing Claude Code **cloud usage** balance successfully paid for a previous task and has approximately $249 remaining. Use that existing eligible cloud-session setup. The matching promotion and its deadline/exclusions are linked in `START-HERE.md`; the account's actual terms and balance are authoritative. [Official cloud credit promotion](https://support.claude.com/en/articles/17152539-cloud-sessions-bonus-credit-promotion)

Do not assume this balance is portable to API keys, local coding, ordinary chat, or hosting. API model pricing below is a **reference for relative token costs**, not a verified conversion formula for this promotional balance. The credits pay for coding usage, not public music licenses, production inference servers, app hosting, a teacher's review, or model training.

### 14.2 Current model choice

As checked November 3, 2026, official Claude documentation lists Opus 5.5 and Sonnet 5.5. Use the actual model picker/account availability, not a made-up “extreme high” model name. [Claude model overview](https://platform.claude.com/docs/en/models/overview)

| Task | Recommended starting setting | Escalation condition |
|---|---|---|
| Architecture/contracts and first audio/transport integration | Opus 5.5 / high | Raise to xhigh for a specific unresolved reasoning problem |
| Well-scoped UI, seed content wiring, storage, routine tests | Sonnet 5.5 / medium | Switch to high/Opus when repeated attempts fail on the same root problem |
| Timing, DSP, matcher, data-loss or integration failure | Opus 5.5 / high | One bounded xhigh investigation with a reproducible failing case |
| Small copy/style or repetitive changes | Sonnet / low or medium | Prefer local deterministic tooling where practical |
| Final correctness and feasibility review | Opus / high | Focus on a concrete diff and test evidence, not a full rewrite |

Opus 5.5 and Sonnet 5.5 support effort settings through max in current Claude Code documentation. Use `/model` and `/effort` where the surface supports them, or its visible model/effort controls. High effort is not a guarantee of correctness. Max/xhigh reasoning should solve a known difficult task, not remain on for every file edit. Avoid Ultracode or automatic agent fan-out for this budget unless the user separately authorizes a bounded parallel workflow. [Claude Code model and effort configuration](https://code.claude.com/docs/en/model-config)

### 14.3 Token economics: reference, not forecast

Official standard first-party API prices in USD per million tokens at research time:

| Model | Uncached input | Output | 5-minute cache write | Cache hit |
|---|---:|---:|---:|---:|
| Opus 5.5 | $4 | $20 | $5 | $0.20 |
| Sonnet 5.5 | $2 | $10 | $2.50 | $0.10 |

The pricing documentation also lists one-hour cache writes at $8/$4 respectively and premium fast-mode pricing. Keep fast mode off for the cost-conscious plan. [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

For ordinary API-priced accounting, using **mutually exclusive token categories**, estimate:

`cost = uncachedInput/1e6 * inputRate + cacheWrite5m/1e6 * write5mRate + cacheWrite1h/1e6 * write1hRate + cacheReads/1e6 * hitRate + billedOutput/1e6 * outputRate + otherCharges`.

Do not count cached tokens again as uncached input. Include billed reasoning/output, all turns, tool results, retries, and any additional provider charges. A single user prompt can trigger many model calls. The actual cloud promotion balance is the check for this project.

Illustrative uncached arithmetic, **not a promise of work completed**: 2 million input + 0.5 million output tokens costs $18 on Opus, $9 on Sonnet at those base rates. A sustained coding session can reread large histories many times; a small final code diff can still cost substantially more than the visible answer suggests. Conversely caching can reduce repeated-prefix cost. No reliable number of features, hours, or finished app quality follows from a raw token count.

### 14.4 Spending plan and controls

The $249 allocation is $20 M0 + $75 M1 + $40 M2 + $30 M3 + $60 repair/integration + $24 contingency. These are **planning ceilings**. They are not enforceable simply because the prompt says them, and unused phase money may be reallocated to core repair.

Before the first new run record the visible balance, current offer, model, repository, and deadline. After each milestone record the new balance and working commit. At roughly $50/$125/$190 spent, review what actually works. At $190 spent, stop adding optional features unless the core is already verified; preserve roughly $59 for repair/handoff. Stop credit-funded work when the displayed balance is exhausted or the offer expires; do not intentionally incur paid overage.

Use account spend controls if available for this specific credit product; do not invent a cloud-session dollar-cap switch. Claude Code's local cost displays are estimates and can differ from authoritative billing. Its current docs describe `/usage`; use the cloud usage menu/account balance for this promotion. [Claude Code cost management](https://code.claude.com/docs/en/costs)

If the app is already useful and tested with credit left, choose a bounded audit, device-regression fixes, seed lesson review, or a self-contained next feature. Do not manufacture busywork merely to spend the balance. The useful asset is the preserved implementation.

### 14.5 Efficient session design

- Put the master specification in `docs/`; keep `CLAUDE.md` short and point to the relevant sections. Do not paste the entire document into every follow-up.
- One session owns integration. Give it a concrete milestone, acceptance IDs, allowed modules, and output requirement. Avoid simultaneous agents editing shared timing/schema code.
- Keep logs concise. Ask for failing-test summaries, relevant traces, and narrow file reads rather than repeated full repository dumps.
- After each milestone save `HANDOFF.md`: implemented behavior, commands, test status, limitations, source checkpoint, and next task. Start a clean session when context becomes confused, using the handoff and source as truth.
- Escalate reasoning effort with a reproducible failure. Repeating a vague “make it perfect” request is not a debugging strategy.
- Prefer installed compatible tools and simple deterministic baselines; do not train ML or build a custom renderer before the learning loop works.
- A cloud coding environment can generate and test source, simulated audio, and browser UI. It cannot physically inspect the owner's guitar setup. Explicitly schedule the owner's short local test and use its results for the next fix.

### 14.6 Ready-to-use follow-up tasks

After M1 is saved, send a bounded request such as:

> Read HANDOFF.md and docs/ACCEPTANCE.md. Complete M2 only: improve the high-E/Em/Am lessons, accessible controls, and progress/recall flow. Preserve the tested transport and scoring contracts. Run the relevant regression tests, update limitations, and save a working checkpoint. Do not start transcription, camera, accounts, or hosting.

For M3:

> Read the current handoff and master specification sections 7 and 10. Add local backing import with the declared limits, 100%-speed playback, and a two-anchor manual alignment editor. Preserve original assets and edits, validate alignment, and save arrangement versions. Do not claim automatic transcription or guitar removal. Verify the import/alignment acceptance gate and document unsupported codecs.

For a bug:

> Reproduce this observed behavior: [specific action, expected result, actual result, device/browser]. Find and fix its root cause without weakening acceptance criteria. Add only meaningful regression coverage, run affected tests, and save a working checkpoint. Report hardware checks that remain pending.

### 14.7 Continue after expiry

Keep the same repository and contracts. Use the user's regular Claude/ChatGPT coding workflow to read `HANDOFF.md`, inspect the current implementation, run tests, and complete the next backlog item. No model-specific business logic belongs in the core. Coding subscription access does not automatically pay for runtime APIs in the released app; preserve the offline core and optional provider boundaries.

## 15. Launch and continuity checklist

**A useful private prototype is ready when:** the owner can tune, complete the first lesson, play an original exercise with understandable feedback, pause/loop/slow it, and resume saved progress; inaccurate or missing sensing is visible; source and setup are reproducible. It can be useful before every research feature exists.

**A public beta is ready only when:** declared device/capability gates have actual evidence; bundled teaching is reviewed; rights and privacy behavior match the shipped product; hosted features have budgets/quotas/deletion if present; support and takedown routes exist; accessibility and failure recovery have been exercised with users. Label experimental imports and camera features precisely.

Required handoff files in the implementation repository: README, lockfile, concise CLAUDE.md, score schemas and fixtures, source, original asset/license manifest, acceptance report with actual results, decisions, known limitations, open issues, and HANDOFF.md with the last working commit. Use a task branch; do not force-push or overwrite unrelated work. Public deployment and production music sharing are separate actions from this implementation specification.

The implementation priority is a guitar in the learner's hands and a trustworthy next step on the screen. Every later capability must preserve that trust.
