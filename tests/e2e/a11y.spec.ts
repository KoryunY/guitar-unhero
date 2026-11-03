/**
 * Automated accessibility audit (AC-22, part). axe-core finds a subset of WCAG
 * issues; it does not replace a keyboard + screen-reader review by a person.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, devices } from '@playwright/test';
import { freshStart, onboard } from './helpers';

const ROUTES = [
  '/#/today', '/#/learn', '/#/learn/lesson.high-e.first-sound.v1', '/#/learn/lesson.em-chord.v1', '/#/learn/lesson.pulse.v1',
  '/#/practice', '/#/practice/piece.morning-steps', '/#/tune', '/#/settings', '/#/settings/mic', '/#/settings/lab', '/#/settings/backup', '/#/song/new',
];

async function scan(page: import('@playwright/test').Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(summary, summary.join('\n')).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`axe: no WCAG 2.x A/AA violations on any screen (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await freshStart(page);
    await scan(page, 'welcome');
    await onboard(page, 'none');
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForTimeout(300);
      await scan(page, r);
    }
    await page.goto('/#/settings');
    await page.getByTestId('high-contrast').check();
    await page.getByTestId('advanced-toggle').check();
    await scan(page, 'settings-high-contrast-advanced');
    await page.goto('/#/practice/piece.morning-steps');
    await page.getByTestId('options').click();
    await scan(page, 'options-sheet');
  });
}

test('axe on a phone-sized screen in simulation', async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await onboard(page, 'sim');
  for (const r of ['/#/today', '/#/learn/lesson.meet-guitar.v1', '/#/practice/piece.morning-steps', '/#/tune']) {
    await page.goto(r);
    await page.waitForTimeout(300);
    await scan(page, `phone ${r}`);
  }
  await ctx.close();
});
