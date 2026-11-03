# Known limitations (M1)

## Not yet verified with hardware
- No physical guitar, microphone, room, headphones or Bluetooth device has been tested. All automated checks ran headless in a cloud container (Chromium fake capture devices and synthetic signals). AC-08, AC-11, AC-13 and AC-18 remain **pending**.
- Detector thresholds (onset rise, gate, aperiodicity, attack frames) are tuned on synthetic plucks only. Real nylon/steel/electric strings, string noise and room echo may need adjustment.

## Sensing boundaries (by design)
- Pitch identifies the sounding note only — not the string, fret, finger, pressure or posture. Fingering numbers are suggestions.
- Monophonic only: chords and two simultaneous notes are not assessed; strumming confuses the detector (the tuner says "not one clear pitch").
- Octave-only differences are reported as uncertain rather than wrong.
- Sustain/duration is not assessed (`assessment.sustain` is false in the schema).
- The "stop the ringing" step can only hear that the sound stopped, not how.

## Timing
- Uncalibrated timing uses a ±250 ms window and is labeled approximate. Loopback calibration needs speakers and a quiet room; with headphones only the manual "personal adjustment" is available.
- Visual/audio alignment uses `getOutputTimestamp()` when available; real-device drift/latency (AC-13) is unmeasured.
- Bluetooth output latency is not corrected.
- Changing tempo, mode or loop restarts with a count-in (no seamless rate changes).

## Product scope not in M1
- Camera coaching, song upload/import, transcription, separation, score editor, chord lessons, recall mode, adaptive tempo automation, offline service worker, accounts/sync — all absent and not shown as enabled.
- Only bundled original exercises can be practised; there is no score-file import UI (the validator exists).
- Adaptation is advice-only (the summary suggests the next tempo); it never changes settings automatically.
- Skill states stop at `demonstrated`; `retained` needs a later recall attempt (M2).

## Content
- Lesson text and technique advice are unreviewed drafts (`reviewStatus: unreviewed`); a qualified teacher must review them before public use.
- English only; strings are in components, not yet extracted for translation.

## Platform / engineering
- Primary target is desktop Chrome/Edge. Firefox/Safari, tablets and phones are untested.
- Production CSP includes `'unsafe-eval'` because Ajv compiles schemas at runtime (D-07).
- IndexedDB data is per browser profile and can be cleared by the browser; use Export.
- Context suspension (e.g. OS audio interruption) pauses practice via `statechange`, but this path has no automated test.
- Accessibility: keyboard, labels, focus, reduced motion and high contrast are implemented; no automated axe audit or screen-reader test has been run. WCAG conformance is not claimed.
- The JS bundle is ~505 kB (Ajv + React); not yet code-split.
