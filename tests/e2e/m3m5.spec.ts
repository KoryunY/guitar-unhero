/** Song workspace (M3), experimental transcription (M4) and camera view (M5). */
import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { onboard, practiceOptions } from './helpers';

const MELODY = join(process.cwd(), 'tests/fixtures/generated/melody.wav');

test('write my own notes: edit, save versions, make an easy version, practise it', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/practice');
  await page.getByTestId('add-song').click();
  await page.getByTestId('song-title').fill('My tune');
  await page.getByTestId('new-notes').click();
  await page.getByTestId('create-song').click();
  await expect(page.getByTestId('score-editor')).toBeVisible();
  await page.getByRole('button', { name: 'String 1, bar 1 beat 1: place fret 0' }).click();
  await page.getByRole('group', { name: 'Fret for new notes' }).getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'String 1, bar 1 beat 2: place fret 3' }).click();
  await page.getByRole('group', { name: 'Fret for new notes' }).getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'String 2, bar 1 beat 3: place fret 1' }).click();
  await expect(page.getByRole('button', { name: /Note G4, string 1 fret 3/ })).toBeVisible();
  await page.getByTestId('save-version').click();
  await expect(page.getByText('Saved version 2')).toBeVisible();

  await page.getByTestId('song-tabs').getByRole('button', { name: 'Easy' }).click();
  await expect(page.getByTestId('easy-result')).toBeVisible();
  await page.getByTestId('save-easy').click();
  await expect(page.getByText(/Easy version saved/)).toBeVisible();

  await page.getByTestId('song-tabs').getByRole('button', { name: 'Play' }).click();
  await practiceOptions(page, { mode: 'Keep the beat', speed: '100%' });
  await page.getByTestId('play-pause').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('song-tabs').getByRole('button', { name: 'More' }).click();
  await expect(page.getByText(/My tune · v2/)).toBeVisible();
});

test('import a recording, tap along to line it up, then turn it into reviewed notes (experimental)', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/song/new');
  await page.getByTestId('song-file').setInputFiles(MELODY);
  await page.getByTestId('create-song').click();
  await expect(page.getByRole('img', { name: /Recording waveform/ })).toBeVisible({ timeout: 15_000 });

  // Tap along at 80 BPM (the recording's first beat is at 1 s).
  await page.getByTestId('tap-start').click();
  await page.waitForTimeout(1000);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('t');
    await page.waitForTimeout(750);
  }
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/beats per minute/)).toBeVisible();
  await page.getByTestId('use-timing').click();
  await expect(page.getByText('Lined up with the beat')).toBeVisible();

  await page.getByTestId('song-tabs').getByRole('button', { name: 'To notes' }).click();
  await page.getByTestId('transcribe').click();
  await expect(page.getByTestId('transcribe-result')).toContainText(/Found [4-9] clear notes/, { timeout: 30_000 });
  await page.getByTestId('create-candidate').click();
  await expect(page.getByText(/Candidate notes from the recording/)).toBeVisible();
  await page.getByTestId('mark-reviewed').click();
  await expect(page.getByText(/Reviewed — notes will now be checked/)).toBeVisible();
  await page.getByTestId('song-tabs').getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('practice-player')).toBeVisible();
  await expect(page.getByText(/haven’t been reviewed/)).toHaveCount(0);
});

test('a non-audio file is rejected with a helpful message', async ({ page }) => {
  await onboard(page, 'sim');
  await page.goto('/#/song/new');
  await page.getByTestId('song-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.getByTestId('create-song').click();
  await expect(page.getByText(/cannot be played here|could not be decoded/)).toBeVisible();
});

test('camera view (experimental): mirror, fretboard marks and on-device hand tracking', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|CSP/.test(m.text())) errors.push(m.text()); });
  await onboard(page, 'none');
  await page.goto('/#/settings');
  await page.getByTestId('advanced-toggle').check();
  await page.getByTestId('camera-toggle').check();
  await page.getByRole('link', { name: /Open camera view/ }).click();
  await page.getByTestId('camera-start').click();
  await page.getByTestId('camera-mark').click();
  await page.waitForTimeout(600); // smooth scroll to the video
  const box = (await page.locator('.camera-wrap canvas').boundingBox())!;
  for (const [x, y] of [[0.2, 0.35], [0.2, 0.65], [0.8, 0.65], [0.8, 0.35]] as const) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }
  await expect(page.getByText('Fretboard marked')).toBeVisible();
  await page.getByTestId('camera-track').click();
  await expect(page.getByTestId('camera-evidence')).toContainText(/Hand|can't see your hand/, { timeout: 45_000 });
  expect(errors).toEqual([]);
});
