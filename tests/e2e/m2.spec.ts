/** M2 learning features: quizzes, pulse, chord string checks, strum-along, ear training, recall cues. */
import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

async function startSimulation(page: import('@playwright/test').Page) {
  await freshStart(page);
  await page.getByRole('button', { name: 'Try the simulation (no guitar)' }).click();
  await expect(page.getByTestId('sim-banner')).toBeVisible();
}

test('meet the guitar: quiz explains and saves', async ({ page }) => {
  await startSimulation(page);
  await page.getByRole('button', { name: /2\. Quick check: string 1/ }).click();
  await page.getByLabel('The thickest string').check();
  await expect(page.getByTestId('quiz-feedback')).toContainText('Not quite');
  await page.getByLabel('The thinnest string').check();
  await expect(page.getByTestId('quiz-feedback')).toContainText('closest to the floor');
  await expect(page.getByText(/Step saved/)).toBeVisible();
});

test('Em: string-by-string check (simulated) never claims the whole chord', async ({ page }) => {
  await startSimulation(page);
  await page.goto('/#/learn/lesson.em-chord.v1');
  await page.getByRole('button', { name: /2\. Check each string/ }).click();
  await expect(page.getByRole('img', { name: /string 5 fret 2 finger 2; string 4 fret 2 finger 3/ })).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByTestId('sim-correct').click();
  await expect(page.getByTestId('sequence-feedback')).toContainText('All 6 notes heard in order');
  await page.getByRole('button', { name: /3\. A gentle strum/ }).click();
  await expect(page.getByText(/Not assessed: strummed chords/)).toBeVisible();
  await page.getByTestId('strum-start').click();
  await expect(page.getByTestId('strum-now')).toContainText(/Count-in|Em/);
});

test('Am diagram marks string 6 as not played', async ({ page }) => {
  await startSimulation(page);
  await page.goto('/#/learn/lesson.am-chord.v1');
  await expect(page.getByRole('img', { name: /A minor \(Am\): low-to-high x 0 2 2 1 0/ })).toBeVisible();
});

test('pulse: tapping along gives timing feedback', async ({ page }) => {
  await startSimulation(page);
  await page.goto('/#/learn/lesson.pulse.v1');
  await page.getByRole('button', { name: /2\. Tap along/ }).click();
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
  await startSimulation(page);
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
  await startSimulation(page);
  await page.goto('/#/practice/piece.morning-steps');
  await page.getByLabel('Fixed tempo').check();
  await page.getByLabel('100%').check();
  await page.getByLabel('From memory (beat only)').check();
  await expect(page.getByRole('img', { name: /From memory: upcoming notes hidden/ })).toBeVisible();
  await expect(page.getByText('Notes as text (tablature list)')).toBeHidden();
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('summary')).toContainText('SIMULATED');
  // Simulation can never mark a piece retained.
  await expect(page.getByTestId('retention')).toHaveCount(0);
});
