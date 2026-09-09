import rule from '../rules/no-direct-date.js';
import { tester } from './setup.ts';

/** Барьер § 5.2: единственный источник времени — packages/core/clock.ts. */
tester.run('no-direct-date', rule, {
  valid: [
    { code: "import { now } from '@coes/core/clock.ts'; const t = now();" },
    { code: 'const d = parseDate("08.09.2026");' },
    { code: 'const y = new DateRange();' },
    // Разбор заданного момента воспроизводим и часов не читает.
    { code: 'const t = new Date("2026-09-08T00:00:00.000Z");' },
    { code: 'const t = new Date(1788912000000);' },
  ],
  invalid: [
    { code: 'const t = new Date();', errors: [{ messageId: 'direct', data: { call: 'new Date()' } }] },
    { code: 'const t = Date.now();', errors: [{ messageId: 'direct', data: { call: 'Date.now()' } }] },
  ],
});
