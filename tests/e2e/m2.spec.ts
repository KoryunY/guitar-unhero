/** Learning features: quizzes, pulse, chord string checks, strum-along, ear training, recall cues. */
import { expect, test } from '@playwright/test';
import { onboard, practiceOptions } from './helpers';

test('meet the guitar: quiz explains and saves', async ({ page }) => {
  await onboard(page, 'sim');
  await page.getByRole('button', { name: 'Got it — next' }).click();
  await page.getByLabel('The thickest string').check();
  await expect(page.getByTestId('quiz-feedback')).toContainText('Not quite');
  await page.getByLabel('The thinnest string').check();
  await expect(page.getByTestId('quiz-feedback')).toContainText('closest to the floor');
  await expect(page.getByTestId('step-saved')).toBeVisible();
});

test('Em: string-by-string check (simulated) never claims the whole chord', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/learn/lesson.em-chord.v1');
  await page.getByRole('button', { name: 'Got it — next' }).click();
  await expect(page.getByRole('img', { name: /string 5 fret 2 finger 2; string 4 fret 2 finger 3/ })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByTestId('sim-correct').click();
  await expect(page.getByTestId('sequence-feedback')).toContainText('All 6 notes heard in order');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText(/Not assessed: strummed chords/)).toBeVisible();
  await page.getByTestId('strum-start').click();
  await expect(page.getByTestId('strum-now')).toContainText(/Count-in|Em/);
});

test('Am diagram marks string 6 as not played', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/learn/lesson.am-chord.v1');
  await expect(page.getByRole('img', { name: /A minor \(Am\): low-to-high x 0 2 2 1 0/ })).toBeVisible();
});

test('pulse: tapping along gives timing feedback', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/learn/lesson.pulse.v1');
  await page.getByRole('button', { name: 'Got it — next' }).click();
  await page.getByTestId('pulse-start').click();
  await page.waitForTimeout(4300);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
  }
  await expect(page.getByTestId('pulse-feedback')).toContainText(/of 8 taps landed near a click/, { timeout: 5000 });
  await expect(page.getByTestId('pulse-feedback')).toContainText('Approximate');
});

test('ear training: six higher/lower rounds produce a score', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/learn/lesson.listen-remember.v1');
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('ear-play').click();
    await page.getByTestId('ear-first').click();
    await expect(page.getByTestId('ear-feedback')).toContainText(/was higher/);
    if (i < 5) await page.getByRole('button', { name: 'Next round' }).click();
  }
  await expect(page.getByTestId('ear-feedback')).toContainText(/Final score \d of 6/);
});

test('recall: Morning Steps from memory hides upcoming notes and records the cue level', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/practice/piece.morning-steps');
  await practiceOptions(page, { mode: 'Keep the beat', speed: '100%', hints: 'From memory' });
  await expect(page.getByRole('img', { name: /From memory: upcoming notes hidden/ })).toBeVisible();
  await expect(page.getByTestId('upnext')).toContainText('From memory');
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('summary')).toContainText('Simulated');
  await expect(page.getByTestId('retention')).toHaveCount(0);
});

test('chunks lesson starts with a two-bar repeat', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/learn/lesson.chunks-memory.v1');
  await expect(page.getByTestId('practice-player')).toContainText('repeating a section');
});
