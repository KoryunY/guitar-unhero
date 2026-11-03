/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production-only Content Security Policy. The dev server needs inline module
 * preambles for React refresh, so the policy is injected only into built HTML.
 * 'unsafe-eval' is required because Ajv compiles the score schema at runtime
 * (see Documents/DECISIONS.md, D-07).
 */
function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval'",
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

export default defineConfig({
  plugins: [react(), productionCsp()],
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
