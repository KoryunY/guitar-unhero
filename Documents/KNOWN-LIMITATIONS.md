# Known limitations (1.0 candidate)

## Not yet verified with hardware (open)
- No physical guitar, microphone, room, headphones, phone or camera has been tested. AC-08 (real-note accuracy), AC-11 (feedback latency on reference hardware), AC-13 (audio/cursor drift), AC-18 (real leakage) remain **pending**. The Mic test lab (Settings → Advanced tools) measures these on your device and can save guided recordings for `pnpm test:recordings`.
- Detector thresholds were tuned on guitar-like synthetic signals and review experiments. Real strings, laptop mics and rooms may still need tuning.
- **Song analysis has only been measured on synthetic mixes** (beats 100 %, chords 100 %, melody F1 0.97 there). Real songs will be noticeably worse — see "Any song" below.

## Sensing boundaries (by design)
- Pitch identifies the sounding note, not the string, fret, finger, pressure or posture.
- Chords are taught and checked one string at a time; strummed chords, chord changes and song chord tracks are never assessed.
- Bends, slides, hammer-ons, pull-offs, vibrato, palm muting, double stops and octaves are demonstrated and self-checked; only plain fretted target notes are assessed.
- With several strings ringing, the app cancels up to two earlier notes; if still unsure the note is "uncertain", never "wrong". Very fast notes (8ths at 120 BPM) get a pitch about half the time.
- Distorted electric guitar confuses the pitch checker; use a clean tone while notes are checked.

## Any song (import, analysis, levels)
- **Recordings** (≤ 15 min): the beat, chords and tune are worked out with classic signal processing, not a trained model.
  - Tempos above ~160 BPM come out at half speed (the double tempo is listed as an alternative internally).
  - Only 4/4; 3/4 and 6/8 songs are counted in 4/4 bars.
  - Chords: major/minor/7/m7/maj7/5 only; sevenths are often named as plain triads when a melody plays on top. Inversions, sus, dim, aug are not recognised.
  - Melody = the most prominent line (usually the singer); in instrumentals or when the singer rests it follows the top accompaniment; octave errors happen. Easy/Medium move notes by octaves into guitar range.
  - Sections are found from chord/sound changes; similar verses and choruses may not be told apart.
  - Everything worked out from audio is a candidate: nothing is checked until you listen and press "Sounds right". Corrections are made note by note in "Notes"; the chord track cannot be edited in the app yet.
- **Tabs and chord sheets**: rhythm is guessed from spacing (tabs) or one bar per chord (chord sheets), so timing is never graded for them. Lyrics are dropped. Non-standard tunings are shown in standard tuning with a warning. "Chorus x2" instructions are not expanded.
- **MIDI**: first tempo only; no string/fret (the app chooses fingerings). **MusicXML**: uncompressed partwise only; D.C./D.S./coda jumps not followed. **Guitar Pro**: via alphaTab (1.4 MB code, downloaded the first time a .gp file is opened).
- **Levels**: chord shapes come from a 200-voicing library; a chord with no shape at the level is left as a rest. Strum patterns are generic per level (not the song's own rhythm). Only one guitar part is made (melody or chords), not a full band arrangement.
- **Slow-down** (75 %/50 %) uses WSOLA time-stretching: some smearing on drums and reverb. The stretched copy is made once per speed per session (a few seconds for a typical song) and kept only in memory.
- Song audio and scores are not included in the progress backup; export the notes per song (More → Save the notes as a file). The recording stays only in this browser.

## Song workspace (editing)
- The editor is monophonic (one note at a time) in 4/4 with eighth-note resolution; it does not edit chord tracks, sections or techniques.
- Tap-along alignment is linear; automatic beat tracking (from "Work it out") follows tempo drift.

## Transcription (single-note, advanced)
- The older "To notes" transcriber (Advanced tools) works only on clean recordings of one guitar playing one note at a time; synthetic F1 1.00, no real-recording evaluation.

## Camera (experimental)
- Off by default; a mirror plus optional on-device hand tracking giving "hand in view" and, after marking the fretboard, a *rough* fret area. Never grades; no evaluation data; ~5 fps on the main thread; ~21 MB downloaded from this app the first time.

## Timing
- Uncalibrated timing uses the browser's output-latency estimate and wide windows ("Timing: rough guide"). Loopback calibration needs speakers; headphones use the manual adjustment. Bluetooth latency is not corrected.

## Learning content
- 70 lessons written for this app (AI teacher review applied, original material only) — **not reviewed by a human guitar teacher**. Technique and safety wording should be checked before sharing publicly.
- Ranks and streaks count lessons and practice days; they are motivation, not a skill certificate.

## Platform
- Target: current Chrome/Edge on desktop and Android; iOS Safari and Firefox untested. Installable as a web app (manifest + offline service worker); no native wrapper yet.
- Automated axe checks pass on all screens (light/dark/high-contrast/phone, song levels); a human screen-reader review has not been done. WCAG conformance is not claimed.
- UI strings are not yet extracted for translation. The main bundle grew to ~140 KB gzipped with the 70-lesson curriculum.
