# CLAUDE.md — Guitar Unhero

Current milestone: **1.0 candidate (software)** — M0–M5 plus: 70-lesson curriculum, any-song import (recording analysis, tab/chord sheet, MIDI, MusicXML, Guitar Pro) with Easy/Medium/Full levels, stage redesign, coach voice, ranks. Hardware checks pending; next: owner's real-guitar feedback, native-wrapper readiness (see `HANDOFF.md`). Spec: `Documents/GUITAR-UNHERO-MASTER-SPEC.md` (use `Documents/` wherever the spec says `docs/`).

## Commands
`pnpm install` · `pnpm dev` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm test:e2e` · `pnpm check` · `pnpm gen:validators` (after editing a schema) · `pnpm test:recordings`

## Layout (single Vite app; modules are directories)
- `src/domain` — score types (`gu-score/1` + superset `gu-score/2`: chord track, sections, capo, techniques), `validate.ts` (precompiled validators in `src/generated/` + semantic checks), `tuning.ts`, `tunings.ts` (tuner presets), `fingering.ts` (Viterbi), `edit.ts`, `arrange.ts` (old easy versions), `alignment.ts` (tap-tempo), `chords.ts` (chord names, 200+ voicings, capo suggestions), `songArrange.ts` (any song → easy/medium/full), `voicing.ts`, `fromAnalysis.ts`, `fromImport.ts`, `importers/` (MIDI, ASCII tab, chord sheet, MusicXML, Guitar Pro via lazy alphaTab)
- `src/transport` — `timemap.ts`, `tempo.ts`, `transport.ts` (state machine, backing items, `expandStrums`), `scheduler.ts`
- `src/audio` — `dsp/` (FFT-YIN, analyzer, Karplus–Strong, `stretch.ts` WSOLA), `song/` (full-song analysis: beats, key, chords, melody, bass, sections + worker), `tuner.ts`, `calibration.ts`, `engine.ts` (AudioContext, buses, mic, `strum`), `importAudio.ts` (≤ 15 min, mono 32 kHz playback copy), `stretchCache.ts`, `transcribe.ts` (mono transcriber, advanced)
- `src/assessment` — `matcher.ts`, `timeline.ts`, `summary.ts`, `guidePolicy.ts`
- `src/learning` — `lessons.ts` (re-exports `curriculum/*`), `chapters.ts` (order, tiers, boss fights), `voice.ts` (plain/funny/metal lines), `ranks.ts`, `adaptation.ts`, `retention.ts`, `pulse.ts`, `ear.ts`; `src/content` — bundled original scores
- `src/ui` — `App.tsx`, `kit.tsx`, `art.tsx` (logo, mascot, stage/venue art, chord box, strum pattern, rank badge), `coach.ts` (jokes, streak, rank), `styles.css` (tokens; day + stage themes), screens (Today, Welcome, Learn, PracticeLibrary, Practice, Song, SongPlay, Tuner, Settings, Setup, Diagnostics, Data, Camera); `ui/practice/` (controller, PracticePlayer, Highway, ChordLane)
- `tests/unit` (Vitest, node), `tests/e2e` (Playwright; `real-pipeline` feeds a synthetic WAV to Chromium's fake mic)

## Invariants (do not break)
- In standard tuning, string 1 = high E (MIDI 64) … string 6 = low E (40). Handedness only mirrors display. Other tunings exist only in the tuner; lessons, scores and assessment use standard tuning.
- AudioContext time is the music clock. UI timers only refill the schedule; draw from `transport.positionAt(engine.audibleNow())`.
- Observations are timestamped from analyzed sample frames (`frame / sampleRate`), never callback time.
- `timingError = cObserved − cTarget − deltaIO`; subtract the calibrated offset once only.
- States: `correct | incorrect | uncertain | not_assessed`. Missing/poor input → not_assessed/uncertain, never a miss. Zero denominator → "not assessed", never 0%.
- One attack ↔ at most one target; unpitched attacks are never matched. Wait mode never grades rhythm. Guessed rhythm (tabs, chord sheets) is never graded (`assessment.attack = false`); legato/technique notes are pitch-only.
- App sound (demos, reference, guide, strummed chords, backing on speakers) is never assessed (`engine.blockAssessment`, `guidePolicy`).
- Simulation is labeled everywhere and stored as `simulated`; self-checks stay `self_reported`.
- No network calls, no audio persistence beyond files the learner imports. Unknown score properties are rejected, not dropped.
- Chord completeness/changes are never assessed; chords are checked one string at a time; a gu-score/2 chord track is shown and played, never assessed.
- Never trust a pitch without energy at its fundamental (two ringing notes fake a low "missing fundamental").
- Retained/adaptation use microphone evidence only.
- Unreviewed machine-made notes (transcription, song analysis — every level derived from them) are never assessed (`isUnreviewedCandidate`). Easy versions never change the key: notes move by octaves only; a capo replaces transposition (frets count from the capo, `pitchMidi` is sounding).
- Camera evidence never grades and never claims contact, string, pressure or exact fret.
- Developer tools live behind Settings → Advanced tools. Coach jokes are extra lines next to plain instructions, never instead of them; `voice: 'plain'` shows none; jokes roast the guitar, never the learner.
- Don't weaken tests or acceptance criteria to get green.
