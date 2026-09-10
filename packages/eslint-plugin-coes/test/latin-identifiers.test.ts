import rule from '../rules/latin-identifiers.js';
import { tester } from './setup.ts';

/** Барьер 13 § 3: имена латиницей, тексты по-русски. */
tester.run('latin-identifiers', rule, {
  valid: [
    { code: 'const severityLevels = 5; export default severityLevels;' },
    { code: 'const TOAST_LIMIT = 3; export default TOAST_LIMIT;' },
    // Русский в строках и комментариях правилом не рассматривается.
    { code: 'const title = "Витрина компонентов"; export default title;' },
    { code: '/* Шкала важности */ const scale = []; export default scale;' },
    { code: 'const obj = { "Не строим": true }; export default obj;' },
  ],
  invalid: [
    {
      code: 'const важность = 3; export default важность;',
      errors: [{ messageId: 'nonLatin', data: { name: 'важность' } }, { messageId: 'nonLatin' }],
    },
    {
      code: 'function проверить() { return 1; } export default проверить;',
      errors: [{ messageId: 'nonLatin' }, { messageId: 'nonLatin' }],
    },
    {
      code: 'const КОЛОНКИ = []; export default КОЛОНКИ;',
      errors: [{ messageId: 'nonLatin' }, { messageId: 'nonLatin' }],
    },
    {
      code: 'const list = [1]; for (const элемент of list) { void элемент; }',
      errors: [{ messageId: 'nonLatin' }, { messageId: 'nonLatin' }],
    },
  ],
});
