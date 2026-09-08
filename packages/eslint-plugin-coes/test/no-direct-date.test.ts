import rule from '../rules/no-direct-date.js';
import { tester } from './setup.ts';

/** Барьер § 5.2: единственный источник времени — packages/core/clock.ts. */
tester.run('no-direct-date', rule, {
  valid: [
    { code: "import { now } from '@coes/core/clock.ts'; const t = now();" },
    { code: 'const d = parseDate("08.09.2026");' },
    { code: 'const y = new DateRange();' },
  ],
  invalid: [
    { code: 'const t = new Date();', errors: [{ messageId: 'direct', data: { call: 'new Date()' } }] },
    { code: 'const t = Date.now();', errors: [{ messageId: 'direct', data: { call: 'Date.now()' } }] },
    { code: 'const t = new Date("2026-09-08");', errors: [{ messageId: 'direct' }] },
  ],
});
