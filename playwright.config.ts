import { defineConfig } from '@playwright/test';

const WEB_PORT = Number(process.env['WEB_PORT'] ?? 8080);
const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;

/**
 * Три набора — три шага pnpm verify (docs/03-АРХИТЕКТУРА.md § 10).
 * Шаблоны не пересекаются:
 *   e2e    — приёмочные сценарии ps-N-XX.spec.ts (docs/10-ЭТАПЫ.md § 1);
 *   visual — снимки витрины компонентов, допуск 0,1 % площади;
 *   a11y   — axe-core на каждом экране.
 */
export default defineConfig({
  testDir: 'apps/web/e2e',
  // Дерево § 2 docs/03-АРХИТЕКТУРА.md называет каталог эталонов поимённо:
  // apps/web/e2e/__snapshots__/. Умолчание Playwright кладёт их рядом со
  // спецификацией, а создание каталогов вне дерева запрещено.
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}-{platform}{ext}',
  // Веб-приложение поднимается самой проверкой: сценарий обязан выполняться
  // из пустого состояния, а не на заранее запущенном сервере.
  webServer: {
    command: 'pnpm exec vite --config apps/web/vite.config.ts',
    url: BASE_URL,
    // Переиспользовать чужой сервер нельзя: проверка молча тестировала бы
    // постороннее приложение и сообщала бы о ЕГО нарушениях как о наших.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: BASE_URL },
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
