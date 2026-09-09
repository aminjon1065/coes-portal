import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import coes from '@coes/eslint-plugin';

/**
 * Порядок модулей — docs/03-АРХИТЕКТУРА.md § 3, таблица.
 * Индекс в массиве совпадает с номером модуля в контракте: core — первый,
 * поэтому сообщения правила называют те же номера, что и документ.
 */
const MODULE_ORDER = [
  'core',
  'sys',
  'audit',
  'iam',
  'org',
  'access',
  'ref',
  'notify',
  'store',
  'template',
  'geo',
  'incident',
  'pdn',
  'doc',
  'office',
  'task',
  'files',
  'chat',
  'meet',
  'analytics',
];

/** Модули 11–20: их queries.ts обязаны применять область видимости (§ 4.5). */
const MODULES_WITH_SCOPE = MODULE_ORDER.slice(10);

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'docs/**',
      'coverage/**',
      'dist/**',
      'test-results/**',
      'playwright-report/**',
      'apps/web/src/api/generated/**',
      'packages/db/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Подавление правил комментарием запрещено (docs/03-АРХИТЕКТУРА.md § 10):
    // noInlineConfig лишает директиву действия, reportUnusedDisableDirectives
    // превращает её в ошибку.
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { coes },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'заглушка'], location: 'anywhere' },
      ],
    },
  },
  {
    // Файлы настройки инструментов в формате CommonJS (§ 2).
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    // П-3: собственная вёрстка на экранах запрещена.
    files: ['apps/web/src/screens/**/*.tsx', 'apps/web/src/features/**/*.tsx'],
    rules: { 'coes/no-intrinsic-jsx': 'error' },
  },
  {
    // 06 § 13 п. 11: атрибут style запрещён везде, включая библиотеку.
    // Значение, заданное атрибутом style, минует stylelint.
    files: ['apps/**/*.tsx', 'packages/**/*.tsx'],
    rules: { 'coes/no-style-attribute': 'error' },
  },
  {
    // § 3: порядок и границы модулей.
    files: ['apps/api/src/modules/**/*.ts'],
    rules: { 'coes/module-boundaries': ['error', { order: MODULE_ORDER }] },
  },
  {
    // § 5.2: единственный источник времени — packages/core/clock.ts.
    files: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.js'],
    ignores: ['packages/core/clock.ts'],
    rules: { 'coes/no-direct-date': 'error' },
  },
  {
    // § 4.5 и § 4.6: область видимости применяется всегда.
    files: [
      `apps/api/src/modules/{${MODULES_WITH_SCOPE.join(',')}}/queries.ts`,
      'apps/worker/src/jobs/**/*.ts',
    ],
    rules: { 'coes/require-scope': 'error' },
  },
  {
    // § 9: обращения к серверу — только через сгенерированный клиент.
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/api/**'],
    rules: { 'coes/no-raw-http-client': 'error' },
  },
);
