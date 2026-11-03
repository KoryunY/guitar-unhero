# Guitar Unhero

An encouraging guitar teacher and real-guitar practice game. Local-first browser prototype (milestone **M2**): tuner, a nine-lesson path from "meet the guitar" to your first complete piece, Em/Am chords, ear training, a six-lane practice highway, honest microphone feedback, recall practice and saved progress — also offline after the first visit. No account, no cloud, no AI service — audio never leaves your computer.

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
| `pnpm test` | Vitest unit/DSP/robustness/storage tests (107) |
| `pnpm build` | Typecheck + production build to `dist/` (adds a CSP) |
| `pnpm preview` | Serve `dist/` on :4173 |
| `pnpm test:e2e` | Playwright browser tests (24, incl. axe accessibility and offline); builds and serves automatically |
| `pnpm test:recordings` | Evaluate your own guitar recordings saved from Diagnostics |
| `pnpm gen:validators` | Regenerate precompiled JSON-schema validators after a schema change |
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
3. **Learn** — nine short lessons: meet the guitar → first sound → feel the pulse (tap along) → frets on string 1 → string 2 → E minor → A minor and changing chords → *Morning Steps* (your first complete piece) → listen and remember (ear training). Chords are checked one string at a time; strumming is practice-only (not scored).
4. **Practice** — Morning Steps, the original two-string exercise and the lesson drills: count-in, metronome, 50/75/100% tempo, seek, A–B loop, wait / fixed tempo / listen, **cue levels for recall** (full, reduced, from memory), phrase review with coverage, one next step, and offers to go faster/slower. Playing a piece from memory on a later day marks it **retained**.
5. **Diagnostics** — what the app hears from your guitar, how fast feedback arrives, and a guided recording you can analyze locally (and optionally save to help tune the detector).
6. **Settings & data** — handedness, reduced motion, high contrast, volumes; export/import/delete your progress; offline status.

Keyboard in Practice: `Space` play/pause, `Esc` pause, `←`/`→` one beat, `Home` restart, `N` continue/skip in wait mode.

## Five-minute real-guitar smoke test

1. `pnpm dev`, open Chrome, **Set up listening**, pick your mic, pluck: the meter moves. Deny permission once (address-bar icon) and confirm the app explains how to recover; allow it and press **Try again**.
2. **Tuner**: select each string and compare with a trusted tuner. Stay silent for 5 s — it must not show “In tune”. Don't overtighten strings to test it.
3. **Learn → Your first sound**: play the open high E three times; then play a wrong string on purpose and check the message names what it heard.
4. **Practice → First two strings**: try 50/75/100%, pause/restart/seek/loop. In fixed tempo, hold one note across repeated targets — it must not earn repeated credit.
5. Unplug the mic mid-practice (it pauses, nothing marked wrong), reload, export progress, check the summary.
6. **Diagnostics → Guided check** on each open string; save any clip that looks wrong.

Please write down what happened (device, browser, what you expected, what you saw) — it drives the next fix.

## Known limitations

See `Documents/KNOWN-LIMITATIONS.md`. Highlights: pitch tells which note sounded, not which string/finger; strummed chords are not scored; timing is approximate until calibrated; camera and song import are not implemented; lessons are not teacher-reviewed; real-guitar accuracy is still unmeasured.

## Documents

- `Documents/GUITAR-UNHERO-MASTER-SPEC.md` — product/technical specification (source of truth)
- `Documents/DECISIONS.md`, `Documents/ACCEPTANCE.md`, `Documents/KNOWN-LIMITATIONS.md`, `Documents/ASSET-MANIFEST.md`
- `HANDOFF.md` — current state and next task; `CLAUDE.md` — notes for coding agents
