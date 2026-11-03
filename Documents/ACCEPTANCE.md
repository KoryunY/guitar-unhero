# Acceptance report — M1 gate re-run + M2

Run date: 2026-11-03 (second run). Environment: Linux cloud container, Node 22.23.4, pnpm 10.28.0, headless Chromium (Playwright 1.63.0 build), **no physical audio hardware**. Code checkpoint: `4c33e9a` on `claude/guitar-unhero-m0-m1-ze1u8y`.

Status values: **passed**, **failed**, **not run**, **pending hardware**, **partial**.

## M1 gate (AC-01 … AC-24)

| ID | Status | Evidence / what remains |
|---|---|---|
| AC-01 | passed | `pnpm check` (typecheck, 107 unit tests, build) and `pnpm test:e2e` (24 passed). |
| AC-02 | passed | Schema (precompiled, formats on; staleness test) + semantic checks; 15+ negative cases with readable messages. |
| AC-03 | passed | Tuning/numbering unit tests; left-handed e2e keeps numbering. |
| AC-04 | passed (automated) | Navigation e2e incl. the new curriculum entry (Meet the guitar). Owner review pending. |
| AC-05 | passed (mocked) / pending hardware | Denied/absent/busy/disconnect e2e. Real unplug pending. |
| AC-06 | passed | Simulation labeled on every screen; simulated work never counts as sensor evidence, retention or adaptation (unit + e2e). |
| AC-07 | passed (synthetic) | Sines E2–E6: 44.1 kHz median 0.0005 c / p95 0.015 c; 48 kHz median 0.0005 c / p95 0.011 c. |
| AC-08 | pending hardware | Harness ready: Diagnostics guided recording → `tests/fixtures/recordings/` → `pnpm test:recordings` (GU_EVAL_STRICT=1 enforces ≥95 % within ±15 c). No real recordings yet. Synthetic proxy below. |
| AC-09 | passed (synthetic) / pending manual | Silence, noise, 50 Hz hum never lock. |
| AC-10 | passed (synthetic) | Harmonic cases never give a wrong-octave direction. |
| AC-11 | partial / pending hardware | Analysis span < 160 ms (synthetic). Headless fake-device end-to-end: median 114 ms, p95 162 ms (8 notes) — **not** reference hardware. Diagnostics now measures this on the owner's device. |
| AC-12 | passed | Exact tick/sec/segment maps at several rates and seeks. |
| AC-13 | pending hardware | Not measured on a wired reference setup. |
| AC-14 | passed | Matcher one-to-one cases; analyzer: held note → 1 attack; repeated plucks → distinct attacks; flux re-articulation of the same pitch without a level rise is not a new attack. |
| AC-15 | passed | Missing → not_assessed; poor/unpitched → uncertain; zero denominator → "not assessed". |
| AC-16 | passed | Pitch/timing independent; wait mode never grades rhythm. |
| AC-17 | passed | Pause/seek/restart/rate/A–B/mode (unit), device loss (e2e), **AudioContext suspension (new e2e)**. |
| AC-18 | passed (fixture) / pending hardware | Leakage fixtures; unpitched onsets after app clicks ignored. Real speaker test pending. |
| AC-19 | partial | Lesson content present; teacher review and pilot not run. |
| AC-20 | passed | Persistence, export/import (now with `cueLevel`, `retainedAt`), selective delete. |
| AC-21 | passed (automated) | No foreign requests during listening practice; offline mode works with no network at all. |
| AC-22 | partial (improved) | **axe-core WCAG 2.x A/AA: 0 violations on all 12 routes in light, dark, high-contrast and simulation states.** Keyboard e2e. Human screen-reader review still pending. |
| AC-23 | passed | Asset manifest updated with the two new original scores. |
| AC-24 | passed | Pushed; README, this report, HANDOFF.md. |

## Robustness proxy for AC-08 (synthetic guitar-like signals — not a hardware result)

16-note melody across all six strings (inharmonic partials, attack glide, same-string notes cut, other strings ring on), `tests/unit/robustness.test.ts`:

| Condition | Onset recall | Assessed coverage | Pitch within ±50 c (of assessed) | Extra attacks |
|---|---|---|---|---|
| clean | 0.94 | 0.88 | 1.00 | 0 |
| room echo | 1.00 | 0.94 | 1.00 | 0 |
| 50 Hz hum | 0.94 | 0.88 | 1.00 | 1 |
| SNR 30 dB | 0.94 | 0.88 | 1.00 | 0 |
| SNR 20 dB | 1.00 | 0.94 | 1.00 | 0 |
| quiet (−30 dBFS) | 0.94 | 0.88 | 1.00 | 0 |
| fast 8ths, 120 BPM | 1.00 | 0.44 | 1.00 | 1 |
| SNR 10 dB | 0.75 | 0.13 | 1.00 | — |

Before this run's detector fixes the same suite showed ~5 false attacks per note, 6 % coverage and 33 % wrong pitches on assessed notes. Within ±15 c is 0.53–0.71 because the synthetic attack glide/inharmonicity reads sharp; real-recording AC-08 is still required.

## M2 criteria (from spec §13.1 "Usability pilot and lesson/progress review" — automated parts)

| Item | Status | Evidence |
|---|---|---|
| Curriculum units 0–9 as lessons, each usable without a microphone | passed (automated) | `storage.test.ts` curriculum chain/step data; e2e for quiz, Em check, Am diagram, pulse, ear training. |
| Chords taught with string-by-string checks; no chord-completeness claim | passed | Em/Am targets match spec §3.3 facts (unit); "Not assessed" strum UI (e2e). |
| First complete original piece | passed | `piece.morning-steps` validates; listen → wait → fixed → recall steps. |
| Recall mode (fewer cues) | passed | Cue levels hide numbers / notes / text tab (e2e); stored per summary. |
| Retention after a later-day recall | passed (unit) | `learning.test.ts`; simulation never retains (unit + e2e). |
| Adaptive offers (one dimension, never automatic) | passed (unit) | `learning.test.ts`. |
| Accessibility / offline polish | passed (automated) | axe e2e; offline e2e. |
| Usability pilot with adult beginners | not run | Needs people and guitars. |
| Teacher review of lessons | not run | All lessons `unreviewed`. |

## Commands used
```
pnpm check            # tsc, vitest (107 passed), vite build
pnpm test:e2e         # playwright: 24 passed
pnpm test:recordings  # reports "no recordings" until real clips are added
```
