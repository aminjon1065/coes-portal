// Обращения к серверу — только через сгенерированный клиент
// (docs/09-API.md § 9). Ручной запрос обходит контракт, описанный один раз
// в packages/contracts, и расходится с ним молча.
// Область действия задаётся конфигурацией, а не правилом.

/** Клиенты HTTP, которые обходят сгенерированный клиент. */
const FORBIDDEN_MODULES = new Set(['axios', 'superagent', 'got', 'node-fetch', 'ky']);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Запрет ручных обращений к серверу (§ 9)' },
    schema: [],
    messages: {
      raw: 'Ручное обращение к серверу ({{what}}) запрещено: используйте сгенерированный клиент из apps/web/src/api (§ 9).',
    },
  },
  create(context) {
    return {
      /** @param {import('estree').CallExpression} node */
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          context.report({ node, messageId: 'raw', data: { what: 'fetch()' } });
        }
      },
      /** @param {import('estree').NewExpression} node */
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'XMLHttpRequest') {
          context.report({ node, messageId: 'raw', data: { what: 'XMLHttpRequest' } });
        }
      },
      /** @param {import('estree').ImportDeclaration} node */
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (FORBIDDEN_MODULES.has(source)) {
          context.report({ node, messageId: 'raw', data: { what: source } });
        }
      },
    };
  },
};
