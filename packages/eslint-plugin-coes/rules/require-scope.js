/**
 * Область видимости применяется всегда (docs/05-ДОСТУП.md § 4.5, § 4.6):
 * каждая экспортируемая функция в queries.ts модулей 11–20 и в заданиях
 * обработчика обязана вызвать applyScope. Область действия задаётся
 * конфигурацией, а не правилом.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Обязательное применение области видимости (§ 4.5)' },
    schema: [],
    messages: {
      missing:
        'Функция «{{name}}» читает предметные данные, но не вызывает applyScope: область видимости обязательна (§ 4.5).',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {import('estree').Node} node
     * @returns {boolean}
     */
    const callsApplyScope = (node) => {
      const text = sourceCode.getText(node);
      return /\bapplyScope\s*\(/.test(text);
    };

    /**
     * @param {import('estree').Node & { id?: unknown, key?: unknown }} node
     * @returns {string}
     */
    const nameOf = (node) => {
      const id = /** @type {{ name?: string } | undefined} */ (node.id);
      if (id && typeof id.name === 'string') return id.name;
      return 'без имени';
    };

    /** @param {import('estree').ExportNamedDeclaration} node */
    const inspectExport = (node) => {
      const declaration = node.declaration;
      if (!declaration) return;
      if (declaration.type === 'FunctionDeclaration') {
        if (!callsApplyScope(declaration)) {
          context.report({
            node: declaration,
            messageId: 'missing',
            data: { name: nameOf(declaration) },
          });
        }
        return;
      }
      if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          const init = declarator.init;
          if (
            init &&
            (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') &&
            !callsApplyScope(init)
          ) {
            const id = declarator.id;
            context.report({
              node: declarator,
              messageId: 'missing',
              data: { name: id.type === 'Identifier' ? id.name : 'без имени' },
            });
          }
        }
      }
    };

    return { ExportNamedDeclaration: inspectExport };
  },
};
