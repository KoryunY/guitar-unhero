import type { Page } from '@playwright/test';

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
