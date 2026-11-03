# Handoff — M3, M4, M5, reviews, redesign

**Branch:** `claude/guitar-unhero-m0-m1-ze1u8y` · **Last verified code commit:** `0a324d3` (docs on top).

## What changed in this run
1. **Independent reviews** by three agents (audio/assessment, guitar teacher, UX/mobile). All audio bugs fixed (phantom notes from metronome clicks over ringing strings, silent input counted as listening, broken loopback calibration, tuner lock carry-over, wait-mode early notes, loop-wrap windows, latency mapping, analysis lag, …); all teacher edits and five new lessons applied; UX spec implemented.
2. **Redesign:** mobile-first app with bottom tabs (rail on tablet/desktop), Today screen, first-run flow, chaptered Learn path, focused lesson runner, practice player readable from 1 m (big "Up next", 72 px play, options sheet, wake lock), new tuner, Settings with an **Advanced tools** switch hiding developer tools, installable PWA (manifest, icons, safe areas, offline).
3. **M3 song workspace:** import a recording (limits, rights question, SHA-256, kept locally), tap-along alignment, backing playback synced to the score at 100 %, string-grid editor with undo and immutable versions, easy versions with change logs, score-file import/export.
4. **M4 experimental transcription:** clean single-note guitar → draft notes (worker, progress, cancel) → tempo choice → review → "reviewed part". Never assessed before review. Synthetic F1 1.00; real recordings not evaluated.
5. **M5 experimental camera:** opt-in mirror, fretboard marking, on-device MediaPipe hand tracking giving only "hand in view" and a rough fret area. No grading.

## Tests run
- `pnpm check`: typecheck clean, **141/141** unit tests, build OK.
- `pnpm test:e2e`: **31/31** (incl. axe on all screens/themes/phone, offline, songs, transcription, camera with MediaPipe under CSP, real fake-mic pipeline).

## Owner's end-to-end validation (with a guitar)
1. `pnpm dev` (or `pnpm build && pnpm preview`), onboard with the mic, tune with **Tune**.
2. Follow **Learn** through *Morning Steps* and "Learn it in chunks, then from memory"; next day, play Morning Steps from memory → it shows **Remembered**.
3. Add one of your own songs in **Practice → Your songs** (a recording you own), tap the beat, write or transcribe the notes, make an easy version, practise with the backing in headphones.
4. Settings → Advanced tools → **Mic test lab**: guided check on each string; save any wrong-looking clip and share it.

## Hardware checks pending
AC-08 (real-note accuracy), AC-11 (feedback speed), AC-13 (drift), AC-18 (speaker leakage), AC-05 (real unplug), phone browsers, real camera.

## Next concrete tasks
1. Tune detector/transcriber thresholds on the owner's recordings (`tests/fixtures/recordings/`, then `GU_EVAL_STRICT=1 pnpm test:recordings`).
2. Native wrapper readiness: Capacitor (iOS/Android) shell around the built app; verify mic/camera permissions, background audio, wake lock and safe areas on devices; HTTPS dev serving for phones.
3. Content: human teacher review; C/G/D chords and strumming patterns; an accompanied version of Morning Steps (needs a chord-capable score schema revision).
4. Engineering: hand tracking in a worker; piecewise multi-anchor alignment editor; worklet buffer reuse; string extraction for translation.
