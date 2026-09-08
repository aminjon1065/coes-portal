/**
 * П-3 (docs/00-КОНТРАКТ.md): на экранах нечего изобретать.
 * Запрещены встроенные HTML-элементы, атрибут style и атрибут className.
 * Разрешены только компоненты библиотеки и фрагменты.
 * Область действия задаётся конфигурацией, а не правилом.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Запрет собственной вёрстки на экранах (П-3)' },
    schema: [],
    messages: {
      intrinsic:
        'Встроенный элемент <{{name}}> запрещён здесь: экран собирается только из компонентов @coes/ui (П-3).',
      styleAttr:
        'Атрибут style запрещён: значения задаются токенами дизайн-системы (П-3).',
      classNameAttr:
        'Атрибут className запрещён здесь: оформление живёт в packages/ui (П-3).',
    },
  },
  create(context) {
    /**
     * Имя элемента или атрибута. Составные имена (`Меню.Пункт`,
     * `svg:path`) встроенными элементами не являются и правилом не
     * рассматриваются.
     * @param {unknown} candidate
     * @returns {string | undefined}
     */
    const readName = (candidate) => {
      const node = /** @type {{ type?: string, name?: string } | null} */ (candidate);
      return node !== null && node !== undefined && node.type === 'JSXIdentifier'
        ? node.name
        : undefined;
    };

    return {
      /** @param {import('estree').Node & { name?: unknown }} node */
      JSXOpeningElement(node) {
        const name = readName(node.name);
        if (name !== undefined && /^[a-z]/.test(name)) {
          context.report({ node, messageId: 'intrinsic', data: { name } });
        }
      },
      /** @param {import('estree').Node & { name?: unknown }} node */
      JSXAttribute(node) {
        const name = readName(node.name);
        if (name === 'style') context.report({ node, messageId: 'styleAttr' });
        if (name === 'className') context.report({ node, messageId: 'classNameAttr' });
      },
    };
  },
};
