# Guitar Unhero

A patient (and, if you like, very silly) guitar teacher for your real guitar — local-first, works offline, nothing leaves your device. **1.0 candidate**: a 70-lesson path in 13 chapters from "meet the guitar" through chords, strumming, riffs, blues, lead techniques, barre chords and theory to a "Knockoff Hero" and a Metal chapter; bring **any song** (a recording, a pasted tab or chord sheet, MIDI, MusicXML or Guitar Pro) and play it **Easy, Medium or Full**; a tuner with alternate tunings; ranks, streaks and a coach with three personalities (plain, funny, metal).

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
| `pnpm check` | TypeScript + 313 unit tests + production build |
| `pnpm test:e2e` | 35 Playwright browser tests (accessibility, offline, any-song import, levels, transcription, camera, real audio pipeline) |
| `pnpm test:recordings` | Evaluate your own guitar recordings saved from the Mic test lab |
| `pnpm gen:validators` | Regenerate precompiled JSON-schema validators after a schema change |

Playwright uses the installed Chromium; if your machine has none: `pnpm exec playwright install chromium`.

## Using it

- **Today** — the next gig on your journey, your rank and streak, a warm-up, last time's suggestion, and Picky the coach.
- **Learn** — a journey map from the bedroom to the stadium: 70 short lessons in 13 chapters (open chords, strumming, songs in chords and fingerpicking, riffs and power chords, pentatonic and blues, hammer-ons/pull-offs/slides/bends/vibrato, barre chords, theory, *Knockoff Hero*, *Metal level*), with boss fights. Single notes are checked by ear; chords one string at a time; strumming and techniques are self-checks.
- **Practice → Add a song** — any song:
  - *A recording* (up to 15 min): the app works out the beat, key, chords, tune and sections on this device. Nothing is checked until you listen and press "Sounds right".
  - *Paste a tab or chords* (copied from anywhere — lyrics are dropped), or a *MIDI / MusicXML / Guitar Pro* file.
  - Then pick **Easy** (easiest shapes, a capo if it helps — same key — one strum per chord, main notes), **Medium** (four strums a bar, most of the tune) or **Full** (all notes, real shapes, down-up strumming); *strum the chords* or *play the tune*; loop a section; slow the original recording to 75 % or 50 % without changing its pitch.
- **Tune** — big note, needle and a headstock; standard, Drop D, half-step down, D standard, open G/D and DADGAD.
- **Settings** — your guitar (acoustic/electric/nylon), coach style (plain/funny/metal), look (day/stage), hand, microphone, sounds, display, privacy. **Advanced tools** (off by default) reveals the Mic test lab, timing calibration, backup/restore, the single-note transcriber and the experimental camera view.

The mic chip at the top (or "Simulation" when you have no guitar) shows whether the app is listening; tap it to start/stop listening or choose headphones/speakers.

## Five-minute real-guitar smoke test

1. Onboard with "Let the app hear me play", pluck: the level bar moves. Deny permission once and check the app explains how to recover.
2. **Tune**: tune all six strings; stay silent 5 s — it must not say "In tune".
3. **Learn → Your first sound**: play the open high E; then pluck another string on purpose and check the message names what it heard.
4. **Practice → Morning Steps**: try "Wait for me", then "Keep the beat" at 50 %; open the options (sliders icon) to repeat a bar or hide hints.
5. **Practice → Add a song**: import a song you like (MP3), press "Work it out", play Easy with the chords, then Medium; check whether the chords and the beat sound right before pressing "Sounds right". Paste a chord sheet from a website as a second test.
6. Settings → Advanced tools → **Mic test lab**: do the guided check on each open string and note the feedback speed. Save any clip that looks wrong.

## Documents

- `Documents/GUITAR-UNHERO-MASTER-SPEC.md` — specification (source of truth)
- `Documents/DECISIONS.md`, `Documents/ACCEPTANCE.md`, `Documents/KNOWN-LIMITATIONS.md`, `Documents/ASSET-MANIFEST.md`, `THIRD_PARTY_NOTICES.md`
- `HANDOFF.md` — current state and next task; `CLAUDE.md` — notes for coding agents
