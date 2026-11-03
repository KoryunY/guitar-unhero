/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Production-only Content Security Policy. The dev server needs inline module
 * preambles for React refresh, so the policy is injected only into built HTML.
 * JSON Schema validators are precompiled (scripts/gen-validators.mjs), so no
 * 'unsafe-eval' is needed. 'wasm-unsafe-eval' allows compiling the optional,
 * same-origin MediaPipe WebAssembly for the camera experiment (no JS eval).
 */
function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'gu-production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

/**
 * Emits sw.js listing every built file so the whole app (all lazy chunks, the
 * worklet and the worker) is cached on first visit and works offline afterwards.
 * Same-origin only; nothing is fetched from elsewhere.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'gu-offline-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // Built files + small public files. The optional camera model/WASM (~21 MB) are
      // cached only when the learner turns hand tracking on.
      const publicFiles = ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];
      // The Guitar Pro reader (alphaTab, ~300 KB gzipped) is also cached on first use only.
      const lazyOnly = (f: string) => {
        const o = bundle[f];
        return !!o && o.type === 'chunk' && Object.keys(o.modules).some((m) => m.includes('@coderline/alphatab'));
      };
      const files = [...Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js' && !lazyOnly(f)), ...publicFiles];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const source = readFileSync(fileURLToPath(new URL('./src/offline/sw-template.js', import.meta.url)), 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), productionCsp(), offlineServiceWorker()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  worker: { format: 'es' },
  build: {
    // The AudioWorklet module must be a real same-origin file (CSP script-src 'self'), never a data: URL.
    assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined),
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
