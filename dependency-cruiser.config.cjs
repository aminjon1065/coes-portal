/**
 * Границы модулей: docs/03-АРХИТЕКТУРА.md § 3, «Механизм проверки».
 * Числовой порядок модулей проверяет правило coes/module-boundaries;
 * здесь — запреты, выразимые через пути.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Циклическая зависимость между модулями запрещена (§ 3).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'module-public-only',
      severity: 'error',
      comment:
        'Импорт из другого модуля допустим только через его public.ts (§ 3).',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/([^/]+)/(?!public\\.ts$)',
        pathNot: '^apps/api/src/modules/$1/',
      },
    },
    {
      name: 'api-web-separation',
      severity: 'error',
      comment: 'apps/api и apps/web не импортируют друг друга (§ 3).',
      from: { path: '^apps/(api|web)/' },
      to: { path: '^apps/(api|web)/', pathNot: '^apps/$1/' },
    },
    {
      name: 'db-restricted',
      severity: 'error',
      comment:
        'packages/db импортируется только из apps/api и apps/worker (§ 3).',
      from: { pathNot: '^(packages/db|apps/api|apps/worker)/' },
      to: { path: '^packages/db/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(node_modules|docs|coverage|dist|\\.git|test-results|playwright-report)(/|$)',
    },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
