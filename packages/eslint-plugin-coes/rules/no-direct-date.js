/**
 * Единственный источник текущего времени — packages/core/clock.ts
 * (docs/03-АРХИТЕКТУРА.md § 5.2). Иначе проверки сроков хранения
 * невоспроизводимы. Исключение для самого clock.ts задаётся конфигурацией.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Запрет прямого обращения к системным часам (§ 5.2)' },
    schema: [],
    messages: {
      direct:
        'Прямое обращение к часам ({{call}}) запрещено: используйте packages/core/clock.ts (§ 5.2).',
    },
  },
  create(context) {
    return {
      /** @param {import('estree').NewExpression} node */
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
          context.report({ node, messageId: 'direct', data: { call: 'new Date()' } });
        }
      },
      /** @param {import('estree').CallExpression} node */
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Date' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'now'
        ) {
          context.report({ node, messageId: 'direct', data: { call: 'Date.now()' } });
        }
      },
    };
  },
};
