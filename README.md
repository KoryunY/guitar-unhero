# Guitar Unhero

An encouraging guitar teacher and real-guitar practice game. Local-first browser prototype (milestone **M1**): tuner, first lessons, an original practice exercise on a six-lane highway, honest microphone feedback, and saved progress. No account, no cloud, no AI service — audio never leaves your computer.

> Prototype status: software checks pass in a headless cloud browser; **physical guitar/microphone accuracy has not been measured yet** (see `Documents/ACCEPTANCE.md`). Lessons are unreviewed drafts.

## Install and run

Requirements: Node.js ≥ 22.12, pnpm 10 (`corepack enable` provides it), current desktop **Chrome or Edge** (primary target: Windows).

```bash
pnpm install
```

```bash
pnpm dev
```

Open <http://localhost:5173>. The microphone only works on `localhost` or `https://`.

Production build (served locally):

```bash
pnpm build && pnpm preview
```

then open <http://localhost:4173>.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server on :5173 |
| `pnpm typecheck` | TypeScript, strict |
| `pnpm test` | Vitest unit/DSP/storage tests (84) |
| `pnpm build` | Typecheck + production build to `dist/` (adds a CSP) |
| `pnpm preview` | Serve `dist/` on :4173 |
| `pnpm test:e2e` | Playwright browser tests (13); builds and serves automatically |
| `pnpm check` | typecheck + unit tests + build |

Playwright uses the installed Chromium. If your machine has none: `pnpm exec playwright install chromium`.

## Supported setup

- Standard six-string guitar in standard tuning (E2 A2 D3 G3 B3 E4). **String 1 = thinnest/high E, string 6 = thickest/low E.**
- Desktop Chrome/Edge, wired headphones recommended (the app mutes its guide notes on speakers so it never “hears itself”).
- A built-in or USB microphone, or an audio interface. Tablet layout is responsive but untested; phones are unsupported.
- No microphone? Use **Continue without listening** (self-checks, nothing scored) or the persistently labeled **Simulation** (shows how feedback works; never counts as real assessment).

## What you can do now

1. **Setup** — choose a mic, see the input meter, check background noise and clipping, say whether you use headphones or speakers, optionally calibrate timing.
2. **Tuner** — selected-string or chromatic, cents flat/sharp, steady “In tune” lock, reference tone on request.
3. **Learn** — three short lessons: first sound on high E; frets 1 and 3 with an adjacent-string check; string 2.
4. **Practice** — the original two-string exercise (and three lesson drills): count-in, metronome, 50/75/100% tempo, seek, A–B loop, wait mode / fixed tempo / listen mode, phrase review with coverage and one next step.
5. **Settings & data** — handedness, reduced motion, high contrast, volumes; export/import/delete your progress.

Keyboard in Practice: `Space` play/pause, `Esc` pause, `←`/`→` one beat, `Home` restart, `N` continue/skip in wait mode.

## Five-minute real-guitar smoke test

1. `pnpm dev`, open Chrome, **Set up listening**, pick your mic, pluck: the meter moves. Deny permission once (address-bar icon) and confirm the app explains how to recover; allow it and press **Try again**.
2. **Tuner**: select each string and compare with a trusted tuner. Stay silent for 5 s — it must not show “In tune”. Don't overtighten strings to test it.
3. **Learn → Your first sound**: play the open high E three times; then play a wrong string on purpose and check the message names what it heard.
4. **Practice → First two strings**: try 50/75/100%, pause/restart/seek/loop. In fixed tempo, hold one note across repeated targets — it must not earn repeated credit.
5. Unplug the mic mid-practice (it pauses, nothing marked wrong), reload, export progress, check the summary.

Please write down what happened (device, browser, what you expected, what you saw) — it drives the next fix.

## Known limitations

See `Documents/KNOWN-LIMITATIONS.md`. Highlights: pitch tells which note sounded, not which string/finger; timing is approximate until calibrated; chords, camera and song import are not implemented; lessons are not teacher-reviewed.

## Documents

- `Documents/GUITAR-UNHERO-MASTER-SPEC.md` — product/technical specification (source of truth)
- `Documents/DECISIONS.md`, `Documents/ACCEPTANCE.md`, `Documents/KNOWN-LIMITATIONS.md`, `Documents/ASSET-MANIFEST.md`
- `HANDOFF.md` — current state and next task; `CLAUDE.md` — notes for coding agents
