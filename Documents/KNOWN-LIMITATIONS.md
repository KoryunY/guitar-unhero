# Known limitations (after the limitation pass + M2)

Status legend: **fixed** this run · **reduced** (improved, still present) · **open**.

## Addressed in this run
- **fixed** — Production CSP no longer needs `'unsafe-eval'` (validators precompiled, D-22).
- **fixed** — AudioContext interruption now has an automated browser test.
- **fixed** — Automated axe accessibility audit (WCAG 2.0/2.1/2.2 A/AA rules) passes on every screen in light, dark, high-contrast and simulation states. Four contrast issues found and fixed.
- **fixed** — Works offline after the first visit (service worker; production build only).
- **fixed** — Bundle code-split (entry ~260 kB instead of 505 kB).
- **reduced** — Detector robustness: found and fixed false extra attacks on low strings, missed notes when another string rings, and wrong "missing-fundamental" pitches from two ringing strings (D-25…D-28). Still synthetic-only evidence.
- **reduced** — Hardware checks: a Diagnostics screen now measures feedback latency on *your* device and records guided clips you can analyze locally or add to `tests/fixtures/recordings/` for `pnpm test:recordings`.

## Not yet verified with hardware (open)
- No physical guitar, microphone, room or headphones have been tested. AC-08 (real-note accuracy), AC-11 (feedback latency on reference hardware), AC-13 (audio/cursor alignment & drift) and AC-18 (real leakage) are **pending**. Headless numbers (fake device) are reported in `ACCEPTANCE.md` but are not hardware results.
- Robustness thresholds were tuned on *guitar-like synthetic* signals (inharmonic partials, attack glide, echo, hum, noise). Real strings, cheap laptop mics (weak low-E fundamental) and rooms may still need tuning — please use Diagnostics.

## Sensing boundaries (by design)
- Pitch identifies the sounding note, not the string, fret, finger, pressure or posture.
- Chords: shapes are taught with diagrams and **one-string-at-a-time** checks. Strummed chords and chord changes are **not assessed**.
- Two strings ringing together: the app cancels up to two previous notes to hear the new one; if it still can't be sure, the note is "uncertain", never "wrong". One synthetic case (low E entering under a ringing B2) is still missed.
- Very fast notes (8ths at 120 BPM) are detected but only about half get a stable pitch (≈140 ms of sound is needed); they show as uncertain.
- Octave-only differences are uncertain; sustain/duration is not assessed; "stop the ringing" only hears that the sound stopped.
- Pitch reads ~10–20 cents sharp right after a hard pluck (attack glide/inharmonicity in the synthetic model); the ±50-cent note tolerance absorbs this, the tuner uses the steadier sustained part.

## Timing
- Uncalibrated timing uses a ±250 ms window and is labeled approximate. Loopback calibration needs speakers; with headphones use the manual adjustment.
- The tap-pulse exercise includes keyboard and audio-output delay (labeled approximate).
- Bluetooth latency is not corrected. Tempo/mode/loop changes restart with a count-in.

## Learning content
- All lessons are unreviewed drafts (`reviewStatus: unreviewed`); a qualified teacher should review technique text before public use.
- The curriculum ends at a first complete single-note piece (*Morning Steps*) plus Em/Am chords. Strumming patterns, more chords (C, G, D), muting, and an accompanied piece are later work.
- "Retained" needs a from-memory microphone success on a later day; simulated or self-checked practice never counts.
- Adaptation only *offers* changes; tempo steps are 50/75/100 % (not +5 BPM increments).

## Product scope not built
- Camera coaching, song upload/import, transcription, separation, score editor, accounts/sync. Not shown as enabled.
- No score-file import UI (validator exists).

## Platform / engineering
- Desktop Chrome/Edge is the target; Firefox/Safari/tablets/phones untested.
- UI strings are not extracted for translation; the interface will be redesigned after milestones (owner's request).
- Automated accessibility checks don't replace a human keyboard + screen-reader review; WCAG conformance is not claimed.
- IndexedDB data is per browser profile; use Export.
