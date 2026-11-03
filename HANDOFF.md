# Handoff — limitation pass + M2

**Branch:** `claude/guitar-unhero-m0-m1-ze1u8y` · **Last verified code commit:** `4c33e9a` (docs committed on top).

## What changed in this run
1. **Limitations addressed:**
   - precompiled validators (CSP without `unsafe-eval`)
   - code-split bundle
   - axe accessibility audit (0 violations) with contrast fixes
   - AudioContext-interruption test
   - offline service worker
   - Diagnostics screen (live note log, feedback latency, guided local recording) with the `pnpm test:recordings` harness
2. **Detector robustness**: a new guitar-like synthetic suite exposed real problems, now fixed. See DECISIONS D-25…D-28 and ACCEPTANCE.
   - Low strings fired several onsets per note.
   - New notes were missed while another string rang.
   - Two ringing strings produced confident wrong pitches.
3. **M2:**
   - lessons for units 0–9: meet the guitar, first sound, pulse (tap-along), frets on string 1, string 2, Em, Am + change, *Morning Steps* (original 8-bar piece), listen & remember
   - chord diagrams with o/x markers
   - string-by-string chord checks and unassessed strum-along
   - ear training: higher/lower and echo
   - recall cue levels, retained skills and adaptation offers

## Tests run
- `pnpm check`: typecheck clean, **107/107** unit tests, build OK.
- `pnpm test:e2e`: **24/24** (ui, a11y, offline, M2 features, real-pipeline incl. Diagnostics).
- Per-criterion detail: `Documents/ACCEPTANCE.md`.

## What the owner can do with a guitar (end-to-end validation)
1. Run the app (`pnpm dev`, or `pnpm build && pnpm preview` for offline), go through Setup.
2. **Diagnostics → Guided check** on each open string: it reports what it heard. Save the WAV and label for any string that looks wrong and share them (put them in `tests/fixtures/recordings/`).
3. Follow **Learn** from "Meet the guitar" to "Morning Steps", then play Morning Steps **from memory on another day** — the lesson becomes "retained". That is the app's own version of "learned a piece and reproduced it".

## Hardware checks pending
- AC-08: real-note accuracy. Use Diagnostics recordings.
- AC-11: feedback latency on your device. Diagnostics shows it.
- AC-13: audio/cursor drift.
- AC-18: speaker leakage.
- AC-05: real unplug.

## Blockers
None in software. Cloud credit usage isn't visible from inside the session.

## Next concrete tasks
1. Tune the detector on the owner's recordings (thresholds in `src/audio/dsp/analyzer.ts`). Turn on `GU_EVAL_STRICT=1` once enough clips exist.
2. **M3** (spec §14.6): local backing-track import at 100 % speed with a two-anchor manual alignment editor, and arrangement versions. Interface redesign per the owner after M2 review.
3. Content: teacher review; C/G/D chords; strumming patterns; an accompanied version of Morning Steps (needs a chord-capable score schema revision).
