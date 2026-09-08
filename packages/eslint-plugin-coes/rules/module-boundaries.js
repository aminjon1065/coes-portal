import path from 'node:path';

/**
 * Границы модулей (docs/03-АРХИТЕКТУРА.md § 3):
 *   — модуль импортирует только модули с меньшим номером;
 *   — импорт допустим только через public.ts другого модуля.
 * Порядок модулей передаётся настройкой: он часть контракта, а не кода правила.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Порядок и границы модулей (§ 3)' },
    schema: [
      {
        type: 'object',
        properties: { order: { type: 'array', items: { type: 'string' } } },
        required: ['order'],
        additionalProperties: false,
      },
    ],
    messages: {
      order:
        'Модуль «{{from}}» (№{{fromIndex}}) не может импортировать «{{to}}» (№{{toIndex}}): разрешён импорт только модулей с меньшим номером (§ 3).',
      notPublic:
        'Импорт из модуля «{{to}}» допустим только через его public.ts, получено «{{imported}}» (§ 3).',
      unknown:
        'Модуль «{{name}}» отсутствует в перечне порядка модулей (§ 3). Добавьте его в настройку правила.',
    },
  },
  create(context) {
    const options = /** @type {{ order: string[] } | undefined} */ (context.options[0]);
    const order = options ? options.order : [];
    const filename = context.filename.split(path.sep).join('/');
    const selfMatch = /apps\/api\/src\/modules\/([^/]+)\//.exec(filename);
    if (selfMatch === null) return {};
    const from = /** @type {string} */ (selfMatch[1]);
    const fromIndex = order.indexOf(from);

    /**
     * @param {import('estree').Node} node
     * @param {string} specifier
     */
    const check = (node, specifier) => {
      if (!specifier.startsWith('.')) return;
      const resolved = path
        .resolve(path.dirname(filename), specifier)
        .split(path.sep)
        .join('/');
      const targetMatch = /apps\/api\/src\/modules\/([^/]+)\/(.*)$/.exec(resolved);
      if (targetMatch === null) return;
      const to = /** @type {string} */ (targetMatch[1]);
      const imported = /** @type {string} */ (targetMatch[2]);
      if (to === from) return;

      const toIndex = order.indexOf(to);
      if (fromIndex === -1) {
        context.report({ node, messageId: 'unknown', data: { name: from } });
        return;
      }
      if (toIndex === -1) {
        context.report({ node, messageId: 'unknown', data: { name: to } });
        return;
      }
      if (imported.replace(/\.(ts|js)$/, '') !== 'public') {
        context.report({ node, messageId: 'notPublic', data: { to, imported } });
        return;
      }
      if (toIndex >= fromIndex) {
        context.report({
          node,
          messageId: 'order',
          data: {
            from,
            to,
            fromIndex: String(fromIndex + 1),
            toIndex: String(toIndex + 1),
          },
        });
      }
    };

    return {
      /** @param {import('estree').ImportDeclaration} node */
      ImportDeclaration(node) {
        check(node, String(node.source.value));
      },
      /** @param {import('estree').ExportNamedDeclaration} node */
      ExportNamedDeclaration(node) {
        if (node.source) check(node, String(node.source.value));
      },
      /** @param {import('estree').ExportAllDeclaration} node */
      ExportAllDeclaration(node) {
        if (node.source) check(node, String(node.source.value));
      },
    };
  },
};
