# Handoff — 1.0 candidate

**Branch:** `claude/guitar-unhero-m0-m1-ze1u8y`.

## What changed in this run
1. **Design (critique → implementation).** The design critique of the previous screens:
   - First impression was calm but generic, with no guitar identity.
   - Learn was a flat list that could not scale.
   - Diagrams had tiny labels.
   - There was no motivation layer.
   - Half of the desktop screen was empty.

   What was implemented:
   - A "bedroom → stadium" identity: day and dark-stage themes, display fonts, and original SVG art (pick logo, the mascot "Picky", stage and venue scenes, rank shields).
   - Today is now a dashboard (next gig, rank, streak, coach), with two columns on desktop.
   - Learn is a journey map of venue chapters with boss fights.
   - Practice gets a wood fretboard, chord boxes, strum arrows and a neon highway. The fret numbers inside notes are drawn again; they had gone missing.
   - Tune gets a 3+3 headstock.
2. **Any song → Easy / Medium / Full.**
   - Recordings up to 15 minutes are analysed on the device: beats, key, chords, melody, bass and sections.
   - You can also paste a tab or chord sheet, or import MIDI, MusicXML or Guitar Pro.
   - Each song gets three levels. Easy uses a capo, so the key stays the same.
   - You choose to strum the chords or play the tune, and can loop a section.
   - The original recording plays at 75 % and 50 % speed without a pitch change (WSOLA).
   - The app strums the chords along with you, following the guide policy.
   - Candidates made from a recording are never assessed until you press "Sounds right".
3. **Score format gu-score/2.** Adds a chord track (never assessed), sections, a capo, techniques and long recordings. v1 files are still valid.
4. **Curriculum 1.0.** 70 lessons in 13 chapters, from Getting started to Metal level. It covers techniques, power chords, blues, barre chords, theory, *Knockoff Hero* and the final "Riff of Doom". There are 14 ranks.
5. **Coach voice.** Plain, funny (the default) or metal. Jokes are always extra lines next to the plain text.
6. **Tuner presets** (Drop D, half-step down, D standard, open G/D, DADGAD) and an instrument profile (acoustic, electric, nylon).
7. **How it was built.** Three helper agents worked in parallel (song-analysis DSP, importers plus chord library, curriculum plus voice) and one independent code reviewer (see ACCEPTANCE). The work was then integrated and tested here.

## Tests run
- `pnpm check`: typecheck clean, **313/313** unit tests, build OK.
- `pnpm test:e2e`: **35/35**. This covers axe on every screen and theme, including the new song-level screen and the lessons with tabs and techniques. It also covers offline, songs from a recording, a pasted chord sheet and a pasted tab, transcription, the camera, and the real fake-mic pipeline.

## Owner's end-to-end validation (with a guitar)
1. Run `pnpm dev`. Onboard with the mic, pick your guitar and coach style, then **Tune**.
2. **Learn**: follow the map. Lessons that check single notes use the mic. Chords are checked one string at a time. Strumming and techniques are self-checks.
3. **Practice → Add a song**: import an MP3 of a song you like and press **Work it out**. Then:
   - Try **Easy** (strum the chords with the recording at 75 %) and listen: are the chords and the beat right?
   - If they are, press **Sounds right**. From then on the tune you play is checked.
   - Also paste a chord sheet or tab from a website.
4. Report songs where the beat, the chords or the tune are clearly wrong. Settings → Advanced tools → Mic test lab can save clips.

## Hardware checks pending
AC-08 (real-note accuracy), AC-11 (feedback speed), AC-13 (drift), AC-18 (speaker leakage), AC-05 (real unplug), phone browsers, real camera, **real-song analysis accuracy** (only synthetic mixes so far).

## Next concrete tasks
1. **Tune detectors on the owner's recordings.** Put them in `tests/fixtures/recordings/` and run `GU_EVAL_STRICT=1 pnpm test:recordings`. Collect 5–10 real songs and record the beat, chord and melody accuracy honestly.
2. **Editing.** Allow chord-track and section editing in the song workspace. Allow a beat-grid nudge for analysed songs.
3. **Native wrapper readiness.** A Capacitor shell, then check mic and camera permissions, background audio, wake lock and safe areas on devices.
4. **Human review.** A human guitar teacher should review the 70 lessons, especially the technique and safety text.
5. **Engineering.** Hand tracking in a worker; songs in the backup/export; string extraction for translation; 3/4 meter support.
