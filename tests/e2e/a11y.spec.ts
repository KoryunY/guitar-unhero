/**
 * Automated accessibility audit (AC-22, part). axe-core finds a subset of WCAG
 * issues; it does not replace a keyboard + screen-reader review by a person.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { freshStart } from './helpers';

const ROUTES = ['/#/home', '/#/setup', '/#/tuner', '/#/learn', '/#/learn/lesson.high-e.first-sound.v1', '/#/practice', '/#/data', '/#/diagnostics'];

for (const theme of ['light', 'dark'] as const) {
  test(`axe: no WCAG 2.x A/AA violations on any screen (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await freshStart(page);
    const scan = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    };
    await scan('welcome');
    await page.getByRole('button', { name: 'Continue without listening' }).click();
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForTimeout(300);
      await scan(r);
    }
    // High contrast and simulation banner states.
    await page.goto('/#/data');
    await page.getByLabel('High contrast').check();
    await scan('high-contrast');
    await page.goto('/#/setup');
    await page.getByRole('button', { name: 'Use labeled simulation' }).click();
    await scan('simulation');
  });
}
