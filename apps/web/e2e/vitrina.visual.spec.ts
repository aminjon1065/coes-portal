import { test, expect } from '@playwright/test';

/**
 * Снимки витрины — docs/06-ДИЗАЙН-СИСТЕМА.md § 14, § 15.
 * Допуск 0,1 % площади задан в playwright.config.ts. Изменение эталона
 * допускается только вместе с изменением документа.
 */
test('витрина компонентов совпадает с эталоном', async ({ page }) => {
  await page.goto('/');
  // Шрифт обязан загрузиться до снимка: иначе сравнивается не то оформление.
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Витрина компонентов' })).toBeVisible();
  await expect(page).toHaveScreenshot('vitrina.png', { fullPage: true, animations: 'disabled' });
});
