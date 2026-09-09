import { test, expect } from '@playwright/test';

/**
 * Диалоги — docs/07-КОМПОНЕНТЫ.md § 9.8, § 9.9.
 *
 * Отдельным снимком потому, что модальное окно живёт в верхнем слое и
 * затемняет всё под собой: на общем снимке витрины оно скрыло бы остальные
 * компоненты, а два открытых сразу запрещены 06 § 13 п. 14. Открывает их
 * проверка, а не элемент управления на витрине: § 14 п. 5 запрещает
 * интерактивные настройки на витрине.
 */
const ДИАЛОГИ = [
  { индекс: 0, имя: 'dialog' },
  { индекс: 1, имя: 'confirm-dialog' },
];

for (const { индекс, имя } of ДИАЛОГИ) {
  test(`диалог ${имя} совпадает с эталоном`, async ({ page }) => {
    await page.goto('/__ui');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((i) => {
      const узел = document.querySelectorAll('dialog')[i];
      if (узел instanceof HTMLDialogElement) узел.showModal();
    }, индекс);
    await expect(page).toHaveScreenshot(`${имя}.png`, { maxDiffPixelRatio: 0.001 });
  });
}
