import rule from '../rules/module-boundaries.js';
import { tester } from './setup.ts';

/** Порядок модулей — docs/03-АРХИТЕКТУРА.md § 3, таблица. */
const order = [
  'core', 'sys', 'audit', 'iam', 'org', 'access', 'ref', 'notify', 'store',
  'template', 'geo', 'incident', 'pdn', 'doc', 'office', 'task', 'files',
  'chat', 'meet', 'analytics',
];
const options = [{ order }];
const incident = '/repo/apps/api/src/modules/incident/service.ts';
const org = '/repo/apps/api/src/modules/org/service.ts';

tester.run('module-boundaries', rule, {
  valid: [
    // incident (№12) → org (№5): младший номер, через public — разрешено.
    { code: "import { findUnit } from '../org/public.ts';", filename: incident, options },
    // Внутри своего модуля ограничений нет.
    { code: "import { q } from './queries.ts';", filename: incident, options },
    // Внешние пакеты правилом не рассматриваются.
    { code: "import ts from 'typescript';", filename: incident, options },
    // Файл вне модулей правило не трогает.
    { code: "import x from '../org/service.ts';", filename: '/repo/apps/api/src/server.ts', options },
  ],
  invalid: [
    {
      // org (№5) → incident (№12): импорт модуля со старшим номером.
      code: "import { card } from '../incident/public.ts';",
      filename: org,
      options,
      errors: [{ messageId: 'order', data: { from: 'org', to: 'incident', fromIndex: '5', toIndex: '12' } }],
    },
    {
      // Импорт мимо public.ts.
      code: "import { findUnit } from '../org/queries.ts';",
      filename: incident,
      options,
      errors: [{ messageId: 'notPublic', data: { to: 'org', imported: 'queries.ts' } }],
    },
    {
      // Модуль отсутствует в перечне порядка.
      code: "import { x } from '../выдуманный/public.ts';",
      filename: incident,
      options,
      errors: [{ messageId: 'unknown', data: { name: 'выдуманный' } }],
    },
    {
      // Реэкспорт подчиняется тому же правилу.
      code: "export { card } from '../incident/public.ts';",
      filename: org,
      options,
      errors: [{ messageId: 'order' }],
    },
  ],
});
