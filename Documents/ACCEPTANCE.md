# M1 acceptance report

Run date: 2026-11-03. Environment: Linux cloud container, Node 22.23.4, pnpm 10.28.0, headless Chromium (Playwright 1.63.0 build), no physical audio hardware. Code checkpoint: `f9ce795` on `claude/guitar-unhero-m0-m1-ze1u8y`.

Status values: **passed**, **failed**, **not run**, **pending hardware** (cannot be certified headless), **partial** (part verified; the rest stated).

| ID | Status | Evidence / what remains |
|---|---|---|
| AC-01 | passed | Fresh `git clone` → `pnpm install --frozen-lockfile` → `pnpm check` (typecheck, 84 unit tests, build) → `pnpm test:e2e` (13 passed). |
| AC-02 | passed | `tests/unit/validate.test.ts`: fixture + bundled scores valid; 15 negative cases (pitch/fret, duplicate IDs, bounds, overlap, order, open-string finger, capo, chord kind, tempo change, unknown property, negative duration, malformed date-time, fret > maxFret, non-monotonic anchors, tuning, meter) plus malformed/oversize JSON and NaN, each with a readable message. |
| AC-03 | passed | `tests/unit/tuning.test.ts` (string 1=64…6=40, fixture string/fret→MIDI, names, Hz). Left-handed rendering keeps numbering: e2e "left-handed display…". |
| AC-04 | passed (automated) | e2e "welcome → simulation lesson → tuner → practice → summary". Manual desktop review by the owner still recommended. |
| AC-05 | passed (mocked) / pending hardware | e2e: NotAllowedError, NotFoundError, NotReadableError show recovery; track `ended` during practice pauses with "nothing was marked wrong". Real unplug test pending. |
| AC-06 | passed | Banner on every route, "SIMULATED" in practice/summary, persisted summaries keep `simulated`, import rejects relabeled simulation (unit + e2e). |
| AC-07 | passed (synthetic) | `dsp.test.ts` sines E2–E6 ±detune: 44.1 kHz median 0.0006 c, p95 0.015 c; 48 kHz median 0.0005 c, p95 0.011 c (limits 3/5 c). Synthetic plucks of all open strings within 3 c. Tones ≠ guitar. |
| AC-08 | pending hardware | No held-out guitar recordings exist yet (GU-101). Alpha-only limitation applies. |
| AC-09 | passed (synthetic) / pending manual | 5 s silence, white noise (two levels) and 50 Hz hum never lock or give a direction, chromatic and string modes, 44.1/48 kHz. |
| AC-10 | passed (synthetic) | Weak-fundamental E2 with strong 2nd harmonic and a pure octave-up tone never give a wrong-octave direction; pure octave → "harmonic". |
| AC-11 | partial / pending hardware | Analysis span onset→attack evidence < 160 ms (synthetic). End-to-end visible-feedback latency on reference hardware not measured. |
| AC-12 | passed | `transport.test.ts`: exact tick↔sec at several tempos, invertible segment maps at 50/75/100 % and seek points, exact scheduled times. |
| AC-13 | pending hardware | Cursor uses `getOutputTimestamp()`/`outputLatency`; no instrumented wired measurement yet. |
| AC-14 | passed | Matcher: held note vs 4 repeated targets → 1 credit; bursts → 1 credit + extras; non-overlapping windows; loop iterations; analyzer: held pluck → 1 attack, repeated plucks → distinct attacks. |
| AC-15 | passed | Missing listening → not_assessed; clipped → uncertain; zero denominator → "not assessed" (unit + e2e). |
| AC-16 | passed | Correct pitch + 300 ms late recorded separately; wait mode rhythm `not_assessed`; summary shows "not graded". |
| AC-17 | partial | Pause/seek/restart/rate/A–B wrap/mode stop all sources and reset matching (unit); device loss (e2e). AudioContext suspension handler exists but is not automatically tested. |
| AC-18 | passed (fixture) / pending hardware | `leakage.test.ts`: metronome clicks alone earn nothing; leaked guide audio would be "heard", so it is muted on speakers and blocked spans are not assessed. Real speaker/headphone test pending. |
| AC-19 | partial | Lesson 1 follows §3.3 (string ID, demonstration, 3 attempts, stop ringing, count-in, choices, self-check). Teacher review and five-adult pilot not run. |
| AC-20 | passed | IndexedDB reopen restores settings/progress/summaries; export→import round trip; selective delete (unit with fake-indexeddb + e2e in Chromium). |
| AC-21 | passed (automated) | e2e records all requests during listening practice: none outside the local server. No runtime LLM or telemetry exists. |
| AC-22 | partial | Keyboard transport (e2e), labeled controls, visible focus, aria-live feedback, reduced-motion step mode, high contrast, shape+glyph note states, text tab list. No axe/screen-reader audit yet. |
| AC-23 | passed | `Documents/ASSET-MANIFEST.md`, `THIRD_PARTY_NOTICES.md`; all scores carry rights/provenance; no commercial material. |
| AC-24 | passed | Pushed to `claude/guitar-unhero-m0-m1-ze1u8y`; README, this report, HANDOFF.md. |

## Commands used
```
pnpm install --frozen-lockfile
pnpm check          # tsc --noEmit, vitest run (84 passed), vite build
pnpm test:e2e       # playwright: 13 passed (10 ui, 3 real-pipeline)
```
