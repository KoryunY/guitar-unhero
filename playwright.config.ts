import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeE4PlucksWav } from './tests/fixtures/wav';

const root = dirname(fileURLToPath(import.meta.url));
const e4Wav = writeE4PlucksWav(join(root, 'tests/fixtures/generated/e4-plucks.wav'));
const baseURL = 'http://localhost:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'ui',
      testIgnore: /real-pipeline/,
      use: { launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] } },
    },
    {
      // Real worklet → worker → YIN pipeline fed by an original synthetic WAV through Chromium's fake capture device.
      name: 'real-pipeline',
      testMatch: /real-pipeline/,
      use: {
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${e4Wav}`, '--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],
});
