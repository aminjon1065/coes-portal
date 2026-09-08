import { defineConfig } from '@playwright/test';

/**
 * Три набора — три шага pnpm verify (docs/03-АРХИТЕКТУРА.md § 10).
 * Шаблоны не пересекаются:
 *   e2e    — приёмочные сценарии ps-N-XX.spec.ts (docs/10-ЭТАПЫ.md § 1);
 *   visual — снимки витрины компонентов, допуск 0,1 % площади;
 *   a11y   — axe-core на каждом экране.
 */
export default defineConfig({
  testDir: 'apps/web/e2e',
  forbidOnly: true,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: 'e2e', testMatch: /ps-\d+-\d+\.spec\.ts$/ },
    { name: 'visual', testMatch: /\.visual\.spec\.ts$/ },
    { name: 'a11y', testMatch: /\.a11y\.spec\.ts$/ },
  ],
});
