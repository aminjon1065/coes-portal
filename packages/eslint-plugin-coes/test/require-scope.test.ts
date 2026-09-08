import rule from '../rules/require-scope.js';
import { tester } from './setup.ts';

/** Барьер § 4.5: область видимости применяется всегда. */
tester.run('require-scope', rule, {
  valid: [
    { code: 'export function listIncidents(db, scope) { return applyScope(db.selectFrom("incident"), scope).execute(); }' },
    { code: 'export const listUnits = (db, scope) => applyScope(db.selectFrom("org_unit"), scope).execute();' },
    { code: 'function helper() { return 1; }' },
    { code: 'export const LIMIT = 50;' },
  ],
  invalid: [
    {
      code: 'export function listIncidents(db) { return db.selectFrom("incident").execute(); }',
      errors: [{ messageId: 'missing', data: { name: 'listIncidents' } }],
    },
    {
      code: 'export const listUnits = (db) => db.selectFrom("org_unit").execute();',
      errors: [{ messageId: 'missing', data: { name: 'listUnits' } }],
    },
  ],
});
