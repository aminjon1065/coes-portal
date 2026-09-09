import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { Result } from 'axe-core';

/**
 * Доступность — docs/06-ДИЗАЙН-СИСТЕМА.md § 12, § 15.
 * Ноль нарушений уровня serious и critical. Контраст текста не менее 4,5:1
 * проверяется здесь же: палитра § 2 выбиралась под это требование.
 */
test('витрина не содержит нарушений доступности', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const тяжёлые = violations.filter((v: Result) => v.impact === 'serious' || v.impact === 'critical');

  if (тяжёлые.length > 0) {
    console.error(тяжёлые.map((v: Result) => `${v.id} (${v.impact}): ${v.help}`).join('\n'));
  }
  expect(тяжёлые.map((v: Result) => v.id)).toEqual([]);
});
