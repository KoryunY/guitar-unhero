# Handoff — M1

**Branch:** `claude/guitar-unhero-m0-m1-ze1u8y` · **Last verified code commit:** `f9ce795` (this handoff is committed on top of it).

## What works now
- Welcome/onboarding (handedness, guitar available, listening choice), Setup (device list, permission states with recovery, input meter with gate/peak/clipping, 3 s noise check, applied browser processing, output route, loopback/manual calibration).
- Tuner: selected-string and chromatic; cents; ≥300 ms lock; no lock in silence/noise; harmonic and far-off guards; reference tone on request (tuner pauses during it).
- Lessons: `lesson.high-e.first-sound.v1` (per spec §3.3), `lesson.high-e.first-frets.v1` (frets 1/3, release, adjacent-string check), `lesson.b-string.first-frets.v1`. Diagrams, prepare/press/sound/release cues, synthesized demos, specific "I heard X / target Y" feedback, self-checks, evidence-labeled saving.
- Practice: 4 original scores incl. the supplied fixture; six-lane canvas highway driven by AudioContext time; count-in; metronome; guide synth (headphones) with leakage muting; 50/75/100 %; seek; A–B loop with per-loop feedback; wait/fixed/listen; phrase review with pitch, timing (approximate/calibrated/not graded), coverage and one next action; keyboard controls; text tab list.
- Simulation mode (labeled everywhere), listening-off mode, IndexedDB persistence, export/import/delete.

## Tests run (this session)
- `pnpm check`: typecheck clean; **84/84** Vitest tests passed; build OK.
- `pnpm test:e2e`: **13/13** passed (incl. real worklet→worker→YIN path with a synthetic E4 WAV via Chromium fake capture).
- Same results from a fresh clone with `--frozen-lockfile`.
- Details per criterion: `Documents/ACCEPTANCE.md`.

## Hardware checks pending (owner)
AC-05 real unplug, AC-08 real guitar accuracy, AC-09 manual silence, AC-11 feedback latency, AC-13 audio/cursor alignment and drift, AC-18 speaker/headphone leakage. Use the five-minute smoke test in README.md and report: device, browser, expected vs actual.

## Blockers
None in software. Cloud usage/credit consumption for this run is not visible from inside the session — check the account's usage page.

## Next concrete task (M2 — do not start camera/transcription/accounts)
1. Act on the owner's smoke-test report first (detector thresholds in `src/audio/dsp/analyzer.ts`, tuner rules in `src/audio/tuner.ts`).
2. Record a small consented set of original guitar notes and add them as held-out fixtures (GU-101); report AC-08/AC-11.
3. M2 scope per spec §14.6: reviewed high-E/Em/Am lessons (chord string-by-string checks, no chord-completeness claims), recall mode, progress/retention flow, accessibility audit (axe + keyboard + screen reader), offline cache (GU-104).
4. Small debts: precompile Ajv (drop CSP `unsafe-eval`), automated test for AudioContext suspension, code-split the bundle, extract UI strings.
