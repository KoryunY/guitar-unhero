// Copies the MediaPipe WASM runtime from node_modules into public/mediapipe (gitignored),
// so the camera experiment loads everything from this app's own origin — no CDN.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const out = join(root, 'public/mediapipe');
if (!existsSync(src)) {
  console.warn('copy-mediapipe: @mediapipe/tasks-vision not installed; camera hand tracking will be unavailable.');
  process.exit(0);
}
mkdirSync(out, { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  copyFileSync(join(src, f), join(out, f));
}
console.log('copy-mediapipe: copied WASM runtime to public/mediapipe');
