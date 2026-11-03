# CLAUDE.md — Guitar Unhero

Current milestone: **M2 complete (software); hardware checks pending**. Next: owner's hardware feedback, then M3 (see `HANDOFF.md`). Spec: `Documents/GUITAR-UNHERO-MASTER-SPEC.md` (use `Documents/` wherever the spec says `docs/`).

## Commands
`pnpm install` · `pnpm dev` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm test:e2e` · `pnpm check` · `pnpm gen:validators` (after editing a schema) · `pnpm test:recordings`

## Layout (single Vite app; modules are directories)
- `src/domain` — score types, `validate.ts` (precompiled schema validator in `src/generated/` + semantic checks), `tuning.ts`
- `src/transport` — `tempo.ts` (tick/sec/segment maps), `transport.ts` (pure state machine), `scheduler.ts` (lookahead)
- `src/audio` — `dsp/` (FFT-YIN, `analyzer.ts` onsets/attacks, Karplus–Strong synth), `tuner.ts`, `calibration.ts`, `engine.ts` (AudioContext, buses, mic), `capture-processor.js` (worklet), `analysis.worker.ts`
- `src/assessment` — `matcher.ts` (fixed + wait), `timeline.ts` (coverage), `summary.ts`, `guidePolicy.ts`
- `src/learning` — `lessons.ts` (curriculum data, chord shapes, feedback text), `adaptation.ts`, `retention.ts`, `pulse.ts`, `ear.ts`; `src/content` — bundled original scores
- `src/audio/diagnostics.ts` + `ui/screens/Diagnostics.tsx` — guided local recordings; `src/offline` — service worker
- `src/storage` — IndexedDB (`db.ts`), export/import (`exchange.ts`)
- `src/ui` — React screens; `ui/practice/controller.ts` glues transport+matcher+engine
- `tests/unit` (Vitest, node), `tests/e2e` (Playwright; `real-pipeline` feeds a synthetic WAV to Chromium's fake mic)

## Invariants (do not break)
- String 1 = high E (MIDI 64) … string 6 = low E (40). Handedness only mirrors display.
- AudioContext time is the music clock. UI timers only refill the schedule; draw from `transport.positionAt(engine.audibleNow())`.
- Observations are timestamped from analyzed sample frames (`frame / sampleRate`), never callback time.
- `timingError = cObserved − cTarget − deltaIO`; subtract the calibrated offset once only.
- States: `correct | incorrect | uncertain | not_assessed`. Missing/poor input → not_assessed/uncertain, never a miss. Zero denominator → "not assessed", never 0%.
- One attack ↔ at most one target; unpitched attacks are never matched. Wait mode never grades rhythm.
- App sound (demos, reference, guide on speakers) is never assessed (`engine.blockAssessment`, `guidePolicy`).
- Simulation is labeled everywhere and stored as `simulated`; self-checks stay `self_reported`.
- No network calls, no audio persistence. Unknown score properties are rejected, not dropped.
- Chord completeness/changes are never assessed; chords are checked one string at a time.
- Never trust a pitch without energy at its fundamental (two ringing notes fake a low "missing fundamental").
- Retained/adaptation use microphone evidence only.
- Don't weaken tests or acceptance criteria to get green.
