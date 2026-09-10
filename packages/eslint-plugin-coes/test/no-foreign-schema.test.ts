import rule from '../rules/no-foreign-schema.js';
import { tester } from './setup.ts';

const ORDER = ['sys', 'audit', 'iam', 'org', 'access', 'ref', 'notify'];
const options = [{ order: ORDER }];

/**
 * Барьер § 3: обращение к схеме старшего модуля из SQL невидимо для
 * проверки импортов, а по существу нарушает порядок зависимостей.
 */
tester.run('no-foreign-schema', rule, {
  valid: [
    {
      code: "const q = 'SELECT id FROM org.org_unit WHERE id = $1';",
      filename: 'apps/api/src/modules/org/queries.ts',
      options,
    },
    {
      // Младший модуль доступен: access (5) вправе читать org (4).
      code: "const q = 'SELECT a.id FROM org.assignment a JOIN iam.session s ON s.id = $1';",
      filename: 'apps/api/src/modules/access/queries.ts',
      options,
    },
    {
      code: "const q = 'SELECT public.tj_norm($1) AS norm';",
      filename: 'apps/api/src/modules/org/queries.ts',
      options,
    },
    {
      // Вне модулей правило не действует: там нет порядка зависимостей.
      code: "const q = 'SELECT id FROM access.role';",
      filename: 'packages/db/seed.ts',
      options,
    },
  ],
  invalid: [
    {
      code: "const q = 'SELECT org_unit_id FROM access.visible_units($1)';",
      filename: 'apps/api/src/modules/org/queries.ts',
      options,
      errors: [{ messageId: 'foreign', data: { schema: 'access', their: '5', mine: '4' } }],
    },
    {
      code: "const q = 'SELECT live FROM org.assignment WHERE id = $1';",
      filename: 'apps/api/src/modules/iam/queries.ts',
      options,
      errors: [{ messageId: 'foreign' }],
    },
    {
      code: 'const q = `UPDATE notify.notification SET read_at = now()`;',
      filename: 'apps/api/src/modules/iam/queries.ts',
      options,
      errors: [{ messageId: 'foreign' }],
    },
    {
      code: "const q = 'SELECT id FROM incident.card';",
      filename: 'apps/api/src/modules/org/queries.ts',
      options,
      errors: [{ messageId: 'unknown', data: { schema: 'incident' } }],
    },
  ],
});
