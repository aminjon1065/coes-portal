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
const DIALOGS = [
  { index: 0, name: 'dialog' },
  { index: 1, name: 'confirm-dialog' },
];

for (const { index, name } of DIALOGS) {
  test(`диалог ${name} совпадает с эталоном`, async ({ page }) => {
    await page.goto('/__ui');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((i) => {
      const node = document.querySelectorAll('dialog')[i];
      if (node instanceof HTMLDialogElement) node.showModal();
    }, index);
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.001 });
  });
}
