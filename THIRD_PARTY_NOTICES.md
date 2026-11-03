# Third-party notices

Runtime dependencies bundled into the web app (versions pinned in `package.json` / `pnpm-lock.yaml`):

| Package | Version | License |
|---|---|---|
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| scheduler | 0.28.0 | MIT |
| ajv (runtime helpers used by the precompiled validators) | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| json-schema-traverse | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |
| @mediapipe/tasks-vision (optional camera experiment; JS + WASM copied to `public/mediapipe` at build) | 1.1.1 | Apache-2.0 |
| @coderline/alphatab (Guitar Pro reader only, loaded on demand; bundles Haxe runtime, SharpZipLib and NVorbis code under MIT and libvorbis under BSD-3-Clause) | 1.8.4 | MPL-2.0 (source available at github.com/CoderLine/alphaTab; unmodified) |
| @fontsource/bebas-neue (display font files, self-hosted) | 5.3.0 | OFL-1.1 (font), MIT (package) |
| @fontsource/metal-mania (logo/rank font files, self-hosted) | 5.3.0 | OFL-1.1 (font), MIT (package) |

Model weights (optional camera experiment):

| Artifact | Source | License | SHA-256 |
|---|---|---|---|
| `public/models/hand_landmarker.task` (MediaPipe Hand Landmarker, float16, v1) | storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/ | Apache-2.0 per the MediaPipe model card — verify the current model card before redistribution | fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1 |

Development-only tools (not shipped): Vite, @vitejs/plugin-react, TypeScript, Vitest, Playwright, @axe-core/playwright, fake-indexeddb, @types/* — see the lockfile.

No datasets, fonts, audio samples or third-party recordings are bundled. The pitch detector (YIN after de Cheveigné & Kawahara 2002), FFT, onset detection, comb-filter separation, transcription, fingering planner, homography and Karplus–Strong synthesizer are original implementations. Icons are original inline SVG paths. Bundled musical content is listed in `Documents/ASSET-MANIFEST.md`.
