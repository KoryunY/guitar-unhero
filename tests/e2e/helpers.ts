import { expect, type Page } from '@playwright/test';

/** Make getUserMedia fail with a given DOMException name (mocked device states). */
export async function mockMicError(page: Page, name: string) {
  await page.addInitScript((errName) => {
    const md = navigator.mediaDevices;
    if (md) md.getUserMedia = async () => { throw new DOMException('mocked', errName); };
  }, name);
}

/** Keep a handle on the real stream so a test can simulate a device disconnect. */
export async function captureStreams(page: Page) {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      const s = await orig(c);
      (window as unknown as { __streams: MediaStream[] }).__streams = [...((window as unknown as { __streams?: MediaStream[] }).__streams ?? []), s];
      return s;
    };
  });
}

export async function disconnectMic(page: Page) {
  await page.evaluate(() => {
    const ss = (window as unknown as { __streams: MediaStream[] }).__streams;
    const t = ss[ss.length - 1]!.getAudioTracks()[0]!;
    t.stop();
    t.dispatchEvent(new Event('ended'));
  });
}

export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => new Promise<void>((r) => { const q = indexedDB.deleteDatabase('guitar-unhero'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.reload();
}

/** Complete first-run setup in one of three ways. */
export async function onboard(page: Page, how: 'sim' | 'none' | 'mic', opts: { leftHanded?: boolean } = {}) {
  await freshStart(page);
  if (opts.leftHanded) await page.getByRole('radio', { name: /Left hand/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  if (how === 'sim') {
    await page.getByRole('button', { name: /No guitar yet\? Try the simulation/ }).click();
    await expect(page.getByTestId('sim-banner')).toBeVisible();
    return;
  }
  if (how === 'none') {
    await page.getByRole('button', { name: /Start without the mic/ }).click();
  } else {
    await page.getByRole('button', { name: /Let the app hear me play/ }).click();
    await page.getByRole('button', { name: 'Allow the microphone' }).click();
    await expect(page.getByTestId('mic-on')).toBeVisible();
    await page.getByRole('button', { name: /Sounds good/ }).click();
  }
  await page.getByRole('radio', { name: /Speakers/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start lesson 1' }).click();
}

/** Set practice options through the options sheet. */
export async function practiceOptions(page: Page, o: { mode?: 'Wait for me' | 'Keep the beat' | 'Just listen'; speed?: '50%' | '75%' | '100%'; hints?: 'All hints' | 'Strings only' | 'From memory'; text?: boolean }) {
  await page.getByTestId('options').click();
  const sheet = page.getByTestId('options-sheet');
  if (o.mode) await sheet.getByTestId('mode').getByRole('button', { name: o.mode }).click();
  if (o.speed) await sheet.getByTestId('speed').getByRole('button', { name: o.speed }).click();
  if (o.hints) await sheet.getByTestId('cues').getByRole('button', { name: o.hints }).click();
  if (o.text) await sheet.getByTestId('show-text').check();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
}
