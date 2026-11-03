import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { captureStreams, disconnectMic, freshStart, mockMicError } from './helpers';

test.describe('M1 learning loop (AC-04, AC-06, AC-20)', () => {
  test('welcome → simulation lesson → tuner → practice → summary, labeled and persisted', async ({ page }) => {
    await freshStart(page);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
    await page.getByRole('button', { name: 'Try the simulation (no guitar)' }).click();
    await expect(page.getByTestId('sim-banner')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your first sound: the high E string' })).toBeVisible();

    // Step 1 info → step 2 demo → step 3 attempt (simulated).
    await page.getByRole('button', { name: 'Got it — next' }).click();
    await page.getByRole('button', { name: 'Got it — next' }).click();
    await expect(page.getByRole('heading', { name: /Step 3/ })).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId('sim-correct').click();
    await expect(page.getByTestId('lesson-feedback')).toContainText('Simulated: I heard E.');
    await expect(page.getByText(/Step saved \(simulation only/)).toBeVisible();

    // Every screen keeps the simulation label.
    for (const r of ['setup', 'tuner', 'learn', 'practice', 'data', 'home']) {
      await page.goto(`/#/${r}`);
      await expect(page.getByTestId('sim-banner')).toBeVisible();
      await expect(page.getByTestId('input-status')).toContainText('Simulation');
    }

    // Practice the original fixture in fixed tempo at 100% with the simulated player.
    await page.goto('/#/practice/exercise.first-two-strings');
    await page.getByLabel('Fixed tempo').check();
    await page.getByLabel('100%').check();
    await expect(page.getByTestId('assessment-source')).toContainText('SIMULATED');
    await page.getByTestId('play-pause').click();
    await expect(page.getByTestId('summary')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId('summary')).toContainText('SIMULATED');
    await expect(page.getByTestId('suggestion')).toContainText('Simulation only');
    await expect(page.getByTestId('coverage')).toHaveText('100%');

    // Reload restores progress; simulated stays simulated.
    await page.reload();
    await page.goto('/#/data');
    await expect(page.getByTestId('summary').first()).toContainText('SIMULATED');
    await expect(page.getByTestId('lesson-progress')).toContainText('Your first sound');
  });

  test('wait mode waits at the target; listening off shows “not assessed”, never 0%', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Continue without listening' }).click();
    await page.goto('/#/practice/exercise.high-e-open');
    await expect(page.getByTestId('assessment-source')).toContainText('Listening off');
    await page.getByLabel('100%').check();
    await page.getByTestId('play-pause').click();
    await expect(page.getByTestId('transport-state')).toHaveText('Waiting for your note', { timeout: 10_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('transport-state')).toHaveText('Waiting for your note');
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('skip').click();
      if (i < 2) await expect(page.getByTestId('transport-state')).toHaveText('Waiting for your note', { timeout: 5000 });
    }
    await expect(page.getByTestId('summary')).toBeVisible({ timeout: 10_000 });
    // No performance percentage is claimed; coverage honestly reports 0 of 3 assessed.
    await expect(page.getByTestId('pitch-accuracy')).toHaveText('not assessed');
    await expect(page.getByTestId('coverage')).toHaveText('0%');
    await expect(page.getByTestId('summary')).toContainText('0 of 3 notes could be assessed');
  });

  test('keyboard: Space plays/pauses, Escape pauses; text note list is available', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Continue without listening' }).click();
    await page.goto('/#/practice/exercise.first-two-strings');
    await page.getByLabel('Fixed tempo').check();
    await page.locator('h1').click();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('transport-state')).toHaveText(/Count-in|Playing/);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('transport-state')).toHaveText('Paused');
    await page.getByText('Notes as text (tablature list)').click();
    await expect(page.getByRole('table', { name: 'Notes in this exercise' }).locator('tbody tr')).toHaveCount(8);
  });

  test('left-handed display mirrors diagrams but keeps string numbering', async ({ page }) => {
    await freshStart(page);
    await page.getByLabel('Right hand frets (left-handed guitar)').check();
    await page.getByRole('button', { name: 'Continue without listening' }).click();
    const img = page.getByRole('img', { name: /String 1 — high E/ });
    await expect(img).toHaveAttribute('aria-label', /mirrored for left-handed/);
    await expect(img).toHaveAttribute('aria-label', /string 1 \(high E, thinnest\) at the top/);
  });
});

test.describe('microphone states (AC-05)', () => {
  for (const [name, title] of [
    ['NotAllowedError', 'Microphone permission was blocked'],
    ['NotFoundError', 'No microphone was found'],
    ['NotReadableError', 'The microphone is busy or unavailable'],
  ] as const) {
    test(`${name} shows recovery controls and fabricates nothing`, async ({ page }) => {
      await mockMicError(page, name);
      await freshStart(page);
      await page.getByRole('button', { name: 'Set up listening' }).click();
      await page.getByRole('button', { name: 'Start listening' }).click();
      await expect(page.getByRole('alert').filter({ hasText: title })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue without listening' })).toBeVisible();
      await expect(page.getByTestId('input-status')).toContainText('Mic problem');
      await page.goto('/#/practice');
      await expect(page.getByTestId('assessment-source')).toContainText('not assessed');
    });
  }

  test('disconnect during practice pauses without marking notes wrong', async ({ page }) => {
    await captureStreams(page);
    await freshStart(page);
    await page.getByRole('button', { name: 'Set up listening' }).click();
    await page.getByRole('button', { name: 'Start listening' }).click();
    await expect(page.getByTestId('mic-on')).toBeVisible();
    await page.goto('/#/practice/exercise.first-two-strings');
    await page.getByLabel('Fixed tempo').check();
    await page.getByTestId('play-pause').click();
    await expect(page.getByTestId('transport-state')).toHaveText('Playing', { timeout: 15_000 });
    await disconnectMic(page);
    await expect(page.getByTestId('transport-state')).toHaveText('Paused — input lost');
    await expect(page.getByTestId('feedback')).toContainText('nothing was marked wrong');
    await expect(page.getByTestId('input-status')).toContainText('Mic problem');
  });
});

test.describe('local data (AC-20)', () => {
  test('export, delete and import round-trip through the UI', async ({ page }) => {
    await freshStart(page);
    await page.getByRole('button', { name: 'Continue without listening' }).click();
    await page.getByRole('button', { name: 'Got it — next' }).click();
    await page.goto('/#/data');
    await expect(page.getByTestId('lesson-progress')).toContainText('1/6 steps');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
    const path = await download.path();
    const json = JSON.parse(readFileSync(path!, 'utf8'));
    expect(json.format).toBe('guitar-unhero-progress');
    expect(json.settings.deviceId).toBeNull();
    expect(json.lessons[0].completedSteps[0].evidence).toBe('self_reported');

    await page.getByRole('button', { name: 'Delete selected…' }).click();
    await page.getByTestId('confirm-delete').click();
    await expect(page.getByTestId('lesson-progress')).toContainText('not started');
    await page.reload();
    await expect(page.getByTestId('lesson-progress')).not.toContainText('1/6 steps');

    page.once('dialog', (d) => d.accept());
    await page.getByTestId('import-file').setInputFiles(path!);
    await expect(page.getByTestId('data-msg')).toContainText('Imported 1 lesson');
    await page.reload();
    await expect(page.getByTestId('lesson-progress')).toContainText('1/6 steps');
    await expect(page.getByTestId('lesson-progress')).toContainText('imported');

    // Malformed import is rejected and changes nothing.
    await page.getByTestId('import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') });
    await expect(page.getByTestId('data-msg')).toContainText('Import rejected');
  });
});

test('no network requests other than the app itself during practice (AC-21)', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await captureStreams(page);
  await freshStart(page);
  await page.getByRole('button', { name: 'Set up listening' }).click();
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByTestId('mic-on')).toBeVisible();
  await page.goto('/#/practice/exercise.high-e-open');
  await page.getByLabel('Fixed tempo').check();
  await page.getByLabel('100%').check();
  await page.getByTestId('play-pause').click();
  await page.waitForTimeout(6000);
  expect(foreign).toEqual([]);
});

test('an interrupted AudioContext pauses practice and requires Play with a count-in (AC-17)', async ({ page }) => {
  await page.addInitScript(() => {
    const Orig = window.AudioContext;
    // Keep a reference to every context so the test can suspend it like the OS would.
    window.AudioContext = class extends Orig {
      constructor(o?: AudioContextOptions) {
        super(o);
        (window as unknown as { __ctxs: AudioContext[] }).__ctxs = [...((window as unknown as { __ctxs?: AudioContext[] }).__ctxs ?? []), this];
      }
    } as typeof AudioContext;
  });
  await freshStart(page);
  await page.getByRole('button', { name: 'Continue without listening' }).click();
  await page.goto('/#/practice/exercise.first-two-strings');
  await page.getByLabel('Fixed tempo').check();
  await page.getByLabel('100%').check();
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('transport-state')).toHaveText('Playing', { timeout: 10_000 });
  await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.suspend());
  await expect(page.getByTestId('transport-state')).toHaveText('Paused');
  await expect(page.getByTestId('feedback')).toContainText('Audio was interrupted');
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('transport-state')).toHaveText(/Count-in/);
});

test('after one visit the app loads and practises offline (GU-104)', async ({ page, context }) => {
  await freshStart(page);
  await page.goto('/#/data');
  await expect(page.getByTestId('offline-status')).toContainText('Saved for offline use', { timeout: 15_000 });
  await context.setOffline(true);
  await page.goto('/#/practice/exercise.high-e-open');
  await page.reload();
  await expect(page.getByTestId('practice-player')).toBeVisible();
  await page.goto('/#/tuner');
  await expect(page.getByRole('heading', { name: 'Tuner' })).toBeVisible();
  await context.setOffline(false);
});
