import { defineConfig } from 'vitest/config';

/**
 * Три набора проверок — три шага pnpm verify (docs/03-АРХИТЕКТУРА.md § 10):
 *   unit — модульные, включая проверки самих барьеров;
 *   db   — миграции, целостность, права ролей базы;
 *   api  — интеграционные на живой базе.
 *
 * Наборы не пересекаются по шаблонам файлов: проверка не может попасть в
 * чужой шаг и там потеряться. Набор выбирается переменной COES_SUITE —
 * файл настройки в корне репозитория ровно один (§ 2), поэтому разделение
 * сделано внутри него, а не отдельными файлами.
 */
const SUITES = {
  unit: ['tools/**/*.test.ts', 'packages/**/*.test.ts'],
  db: ['packages/db/test/**/*.test.ts'],
  api: ['apps/api/test/**/*.test.ts', 'apps/worker/test/**/*.test.ts'],
} as const;

type Suite = keyof typeof SUITES;

const requested = process.env['COES_SUITE'];
if (requested === undefined || !(requested in SUITES)) {
  throw new Error(
    `COES_SUITE должен быть одним из: ${Object.keys(SUITES).join(', ')}. Получено: ${String(requested)}.`,
  );
}
const suite = requested as Suite;

export default defineConfig({
  test: {
    name: suite,
    include: [...SUITES[suite]],
    exclude: ['**/node_modules/**', ...(suite === 'unit' ? ['packages/db/test/**'] : [])],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['packages/core/**/*.ts', 'apps/api/src/modules/**/service.ts'],
      thresholds: { branches: 80 },
    },
  },
});
