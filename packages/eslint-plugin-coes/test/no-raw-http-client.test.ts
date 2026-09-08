import rule from '../rules/no-raw-http-client.js';
import { tester } from './setup.ts';

/** Барьер § 9: обращения к серверу — только через сгенерированный клиент. */
tester.run('no-raw-http-client', rule, {
  valid: [
    { code: "import { getIncidents } from '../api/client.ts'; getIncidents();" },
    { code: 'const x = obj.fetch();' },
  ],
  invalid: [
    { code: 'fetch("/api/v1/incidents");', errors: [{ messageId: 'raw', data: { what: 'fetch()' } }] },
    { code: 'const r = new XMLHttpRequest();', errors: [{ messageId: 'raw', data: { what: 'XMLHttpRequest' } }] },
    { code: "import axios from 'axios';", errors: [{ messageId: 'raw', data: { what: 'axios' } }] },
  ],
});
