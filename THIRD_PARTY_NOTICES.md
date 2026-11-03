# Third-party notices

Runtime dependencies bundled into the web app (versions pinned in `package.json` / `pnpm-lock.yaml`):

| Package | Version | License |
|---|---|---|
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| scheduler | 0.28.0 | MIT |
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| json-schema-traverse | 1.0.0 | MIT |
| require-from-string | 2.0.2 | MIT |

Development-only tools (not shipped): Vite, @vitejs/plugin-react, TypeScript, Vitest, Playwright, fake-indexeddb, @types/* — see the lockfile for exact versions and licenses.

No model weights, datasets, fonts, audio samples or third-party recordings are bundled. The pitch detector (YIN, after de Cheveigné & Kawahara 2002), FFT, onset detector and Karplus–Strong synthesizer are original implementations in this repository. Bundled musical content is listed in `Documents/ASSET-MANIFEST.md`.
