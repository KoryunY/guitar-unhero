# Guitar Unhero

A patient guitar teacher for your real guitar — local-first, works offline, nothing leaves your device. Prototype through milestone **M5**: tuner, a 14-lesson path from "meet the guitar" to playing a complete piece from memory, Em/Am chords, ear training, a practice player readable from across the room, your own songs (recording + notes + easy versions), experimental transcription of clean guitar recordings, and an experimental camera view.

> Status: all automated checks pass in a headless cloud browser. **Real guitar/mic/camera accuracy has not been measured yet** (see `Documents/ACCEPTANCE.md`). Lessons are drafts not yet reviewed by a human teacher.

## Install and run

Requirements: Node.js ≥ 22.12, pnpm 10 (`corepack enable`), current Chrome or Edge (desktop or Android).

```bash
pnpm install
```

```bash
pnpm dev
```

Open <http://localhost:5173>. The microphone and camera only work on `localhost` or `https://`.

Production build (offline-capable, installable — "Install app" in the browser menu):

```bash
pnpm build && pnpm preview
```

then open <http://localhost:4173>. To use it on your phone, serve it over HTTPS on your network (for example with a tunnel) — phones block microphones on plain-http network addresses.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :5173 (copies the camera WASM first) |
| `pnpm check` | TypeScript + 141 unit tests + production build |
| `pnpm test:e2e` | 31 Playwright browser tests (accessibility, offline, songs, transcription, camera, real audio pipeline) |
| `pnpm test:recordings` | Evaluate your own guitar recordings saved from the Mic test lab |
| `pnpm gen:validators` | Regenerate precompiled JSON-schema validators after a schema change |

Playwright uses the installed Chromium; if your machine has none: `pnpm exec playwright install chromium`.

## Using it

- **Today** — one clear next step, a warm-up, last time's suggestion.
- **Learn** — 14 short lessons in four chapters: Getting started → Your first piece (*Morning Steps*, then playing it from memory) → Chords (one string at a time) → Ears and memory.
- **Practice** — pieces and exercises, plus **Your songs**: add a recording to play along with (line it up by tapping the beat), write notes on a string grid, make easier versions, or (experimental) turn a clean single-note guitar recording into draft notes you review.
- **Tune** — big note, needle, "Too low — tighten / Too high — loosen", moves to the next string when one is in tune.
- **Settings** — hand, microphone, headphones/speakers, sounds, display, privacy. **Advanced tools** (off by default) reveals the Mic test lab, timing calibration, backup/restore and the experimental camera view.

The mic chip at the top (or "Simulation" when you have no guitar) shows whether the app is listening; tap it to start/stop listening or choose headphones/speakers.

## Five-minute real-guitar smoke test

1. Onboard with "Let the app hear me play", pluck: the level bar moves. Deny permission once and check the app explains how to recover.
2. **Tune**: tune all six strings; stay silent 5 s — it must not say "In tune".
3. **Learn → Your first sound**: play the open high E; then pluck another string on purpose and check the message names what it heard.
4. **Practice → Morning Steps**: try "Wait for me", then "Keep the beat" at 50 %; open the options (sliders icon) to repeat a bar or hide hints.
5. Settings → Advanced tools → **Mic test lab**: do the guided check on each open string and note the feedback speed. Save any clip that looks wrong.

## Documents

- `Documents/GUITAR-UNHERO-MASTER-SPEC.md` — specification (source of truth)
- `Documents/DECISIONS.md`, `Documents/ACCEPTANCE.md`, `Documents/KNOWN-LIMITATIONS.md`, `Documents/ASSET-MANIFEST.md`, `THIRD_PARTY_NOTICES.md`
- `HANDOFF.md` — current state and next task; `CLAUDE.md` — notes for coding agents
