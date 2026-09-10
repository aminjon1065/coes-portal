import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { Result } from 'axe-core';

/**
 * Доступность — docs/06-ДИЗАЙН-СИСТЕМА.md § 12, § 15.
 * Ноль нарушений уровня serious и critical. Контраст текста не менее 4,5:1
 * проверяется здесь же: палитра § 2 выбиралась под это требование.
 */
test('витрина не содержит нарушений доступности', async ({ page }) => {
  await page.goto('/__ui');
  await page.evaluate(() => document.fonts.ready);

  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v: Result) => v.impact === 'serious' || v.impact === 'critical');

  // Одного кода нарушения мало: без указания узла и замеренной величины
  // отчёт заставляет искать место вручную.
  if (severe.length > 0) {
    console.error(severe.map((v: Result) => [
      `${v.id} (${String(v.impact)}): ${v.help}`,
      ...v.nodes.map((node) => `    ${node.target.join(' ')}\n    ${node.failureSummary ?? ''}`),
    ].join('\n')).join('\n'));
  }
  expect(severe.map((v: Result) => v.id)).toEqual([]);
});
