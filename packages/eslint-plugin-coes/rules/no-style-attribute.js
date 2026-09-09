/**
 * docs/06-ДИЗАЙН-СИСТЕМА.md § 13 п. 11: атрибут style запрещён в разметке.
 * Запрет действует на весь код, включая packages/ui: встроенные элементы
 * там разрешены, а встроенные значения — нет. Значение, пришедшее атрибутом
 * style, минует stylelint и потому минует всю проверку токенов.
 * Правило no-intrinsic-jsx этот запрет тоже содержит, но только в границах
 * screens/** и features/**, где живёт П-3.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Запрет атрибута style (06 § 13 п. 11)' },
    schema: [],
    messages: {
      styleAttr:
        'Атрибут style запрещён (06 § 13 п. 11): значение задаётся классом в файле .module.css, где его проверяет stylelint.',
    },
  },
  create(context) {
    return {
      /** @param {import('estree').Node & { name?: unknown }} node */
      JSXAttribute(node) {
        const name = /** @type {{ type?: string, name?: string } | null} */ (node.name);
        if (name !== null && name !== undefined && name.type === 'JSXIdentifier' && name.name === 'style') {
          context.report({ node, messageId: 'styleAttr' });
        }
      },
    };
  },
};
