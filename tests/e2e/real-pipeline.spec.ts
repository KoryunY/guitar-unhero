/**
 * Exercises the real capture path (AudioWorklet → Worker → YIN/onsets) using an
 * original synthetic E4 pluck WAV played through Chromium's fake microphone.
 * This verifies software plumbing, not a physical guitar/mic/room.
 */
import { expect, test } from '@playwright/test';
import { onboard, practiceOptions } from './helpers';

test.beforeEach(async ({ page }) => {
  await onboard(page, 'mic');
});

test('the tuner reads E4 on string 1 and locks', async ({ page }) => {
  await page.goto('/#/tune');
  await page.getByRole('button', { name: /^E\s*string 1/ }).click();
  await expect(page.getByTestId('tuner-status')).toContainText(/E4, (centered|\d+ cents)/, { timeout: 15_000 });
  await expect(page.getByTestId('tuner-status')).toContainText('In tune', { timeout: 15_000 });
});

test('first lesson hears the plucked E and says so', async ({ page }) => {
  await page.goto('/#/learn/lesson.high-e.first-sound.v1');
  await page.getByRole('button', { name: 'Got it — next' }).click();
  await page.getByRole('button', { name: 'Got it — next' }).click();
  await expect(page.getByTestId('lesson-feedback')).toContainText('I heard E.', { timeout: 15_000 });
});

test('wait mode recognizes E4, then gives a specific observation at the F4 target', async ({ page }) => {
  await page.goto('/#/practice/exercise.first-two-strings');
  await practiceOptions(page, { mode: 'Wait for me', speed: '100%' });
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('feedback')).toContainText('That sounded like E. The target is F', { timeout: 25_000 });
  await expect(page.getByTestId('transport-state')).toHaveText('Waiting for your note');
});

test('mic test lab: guided recording of string 1 is analysed locally and reports latency', async ({ page }) => {
  await page.goto('/#/settings/lab');
  await page.getByLabel('Target note').selectOption({ label: 'String 1 open (E4)' });
  await page.getByTestId('diag-record').click();
  await expect(page.getByTestId('diag-report')).toBeVisible({ timeout: 15_000 });
  const text = await page.getByTestId('diag-report').innerText();
  expect(Number(/(\d+) matched E4/.exec(text)?.[1] ?? 0)).toBeGreaterThanOrEqual(3);
  expect(text).not.toMatch(/sounded like another note/);
  await expect(page.getByTestId('diag-latency')).toContainText(/median \d+ ms/);
  console.log('DIAG latency (headless, fake device):', await page.getByTestId('diag-latency').innerText());
});
