# Acceptance report — M1 gate, M2, M3, M4, M5

Run date: 2026-11-03 (third run). Environment: Linux cloud container, Node 22.23.4, pnpm 10.28.0, headless Chromium (Playwright 1.63.0 build), **no physical audio/video hardware**. Code checkpoint: `0a324d3` on `claude/guitar-unhero-m0-m1-ze1u8y`.

Status values: **passed**, **failed**, **not run**, **pending hardware**, **partial**.

## Commands and results
```
pnpm check        # tsc + vitest: 141 passed + build
pnpm test:e2e     # playwright: 31 passed (ui, a11y, m2, m3–m5, real-pipeline)
pnpm test:recordings  # "no recordings" until real clips are added
```

## M1 gate (AC-01 … AC-24)

| ID | Status | Evidence / what remains |
|---|---|---|
| AC-01 | passed | check + e2e as above. |
| AC-02 | passed | Precompiled schema (formats on, staleness test) + semantic checks; score-file import in the song workspace uses the same validator. |
| AC-03 | passed | Tuning/numbering unit tests; left-handed e2e. |
| AC-04 | passed (automated) | Onboarding → lesson → all tabs → practice → results (e2e). Owner review pending. |
| AC-05 | passed (mocked) / pending hardware | Denied/absent/busy/disconnect e2e; digital-silence input now reported as "no sound reaching the app" (unit). |
| AC-06 | passed | Simulation stripe + chip on every screen, results badged, never counted (unit + e2e). |
| AC-07 | passed (synthetic) | 44.1 kHz median 0.0005 c / p95 0.015 c; 48 kHz median 0.0005 c / p95 0.011 c. |
| AC-08 | pending hardware | Harness + Mic test lab ready; no real recordings. Synthetic proxy: 0 wrong pitches in 8 conditions, coverage 88–94 % (63 % at SNR 10 dB). |
| AC-09 | passed (synthetic) / pending manual | Silence/noise/hum never lock. |
| AC-10 | passed (synthetic) | Harmonic cases never give a wrong-octave direction; twelfth/double octave now "uncertain" in matching too. |
| AC-11 | partial / pending hardware | Headless fake device: median 145 ms, p95 1632 ms (one warm-up outlier, 10 notes) using the corrected input-clock mapping — not a hardware result. |
| AC-12 | passed | Constant and anchor time maps exact/invertible (unit). |
| AC-13 | pending hardware | — |
| AC-14 | passed | One-to-one matching; held note → 1 attack; clicks over a ringing note → no extra pitched attack (new regression); flux re-articulation rule. |
| AC-15 | passed | Not assessed / uncertain / "not assessed" never 0 %. |
| AC-16 | passed | Pitch and timing separate; wait mode never grades rhythm. |
| AC-17 | passed | Transport transitions (unit), device loss + AudioContext suspension (e2e); loop-aware windows. |
| AC-18 | passed (fixture) / pending hardware | Guide muted on speakers, backing spans blocked on speakers, click-leakage tagging. |
| AC-19 | partial | 14 lessons with teacher-review edits; human teacher + pilot not run. |
| AC-20 | passed | Persistence, export/import, selective delete, DB migration v1→v2. |
| AC-21 | passed (automated) | No foreign requests during practice; camera model/WASM served from this origin; offline works. |
| AC-22 | partial (improved) | axe WCAG 2.x A/AA: 0 violations on 13 routes in light and dark, high contrast, options sheet, and phone size. Human screen-reader review pending. |
| AC-23 | passed | Asset manifest + notices updated (MediaPipe, hand model hash). |
| AC-24 | passed | Pushed; docs + handoff. |

## M3 — song workspace (spec §12.3 "Backing import")
| Gate item | Status | Evidence |
|---|---|---|
| Limits/codec errors | passed (partial) | 25 MiB / 180 s / channels / decode errors with plain messages (code + e2e for a non-audio file). Real MP3/DRM files not tried. |
| Manual sync works | passed (automated) | Tap-along fit (unit), e2e taps 8 beats on a synthetic recording and saves anchors; backing plays per segment at the recording time (unit). |
| Edits survive reload / versions | passed | Immutable versions in IndexedDB, parent links, transformation log (unit + e2e). |
| Pitch preserved or 100 %-only explicit | passed | Backing 100 % only, stated in the player. |
| Fingering generation | passed (unit) | In-range only, impossible → `no_playable_fingering`, reproduces fixture fingering. Teacher review of transitions not run. |
| Simplification logged | passed (unit + e2e) | Every change logged and disclosed; key unchanged. Teacher verification not run. |

## M4 — transcription experiment (spec gate: note F1 ≥ 0.85 on a declared held-out set)
| Item | Status | Evidence |
|---|---|---|
| Synthetic clean melody | passed | Onset/pitch F1 1.00, with offsets 1.00, silence/noise → no notes (unit). |
| Real isolated-guitar held-out set | not run | No consented recordings yet → the feature stays in **candidate-review mode** (never assessed until reviewed). |
| Review flow | passed (e2e) | Import → find notes → draft → mark reviewed → playable. |

## M5 — camera experiment (spec gate: ≥ 95 % precision for any corrective message)
| Item | Status | Evidence |
|---|---|---|
| Opt-in, local, mirror, calibration | passed (e2e + unit) | Fake camera device; four-corner marks; homography and fret-region maths. |
| Hand tracking loads offline-capable from origin under CSP | passed (e2e) | MediaPipe 1.1.1 WASM + model, no CSP errors. |
| Narrow evidence only | passed | "Hand in view", rough fret area; never grades. |
| Precision gate for corrective messages | not run | No labelled data; corrective messages therefore **disabled**. |

## Review findings (independent agents) and disposition
- **Audio/assessment (13):** all applied — phantom notes from clicks over ringing strings, calibration blocked by click filter, digital silence = good input, analysis-lag misses, YIN threshold mismatch, latency mapping, tuner lock carry-over/unstable lock, wait-mode early grace, weak flux first attempts, click/pluck onset bias, calibration across output devices, loop-wrap window overlap, demo block truncation. Not done: worklet buffer reuse (minor), cross-correlation leakage detection for mis-declared headphones (future).
- **Teacher (≈21 + 5 lessons):** all wording/sequence changes and the five suggested lessons applied; feedback F1–F7 applied.
- **UX/mobile:** IA, tab bar/rail, focus mode, palette, type, components, copy changes, Advanced switch, wake lock, results card applied. Not done: landscape side-rail transport layout (uses compact sizing instead), auto-advance after tuning only in string mode.
