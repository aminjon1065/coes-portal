/**
 * docs/13-ГЛОССАРИЙ.md § 3: идентификатор в коде — camelCase, английский.
 * Глоссарий в вопросах именования старше всех остальных документов
 * (docs/00-КОНТРАКТ.md § 3, п. 12), поэтому правило действует на весь код.
 *
 * Проверяются только имена. Русский текст в строках и комментариях —
 * требование контракта, и правило его не касается.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Имена в коде только латиницей (13 § 3)' },
    schema: [],
    messages: {
      nonLatin:
        'Имя «{{name}}» содержит нелатинские буквы: 13-ГЛОССАРИЙ § 3 требует английских имён в коде. Русский остаётся в текстах и комментариях.',
    },
  },
  create(context) {
    const LATIN_ONLY = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
    return {
      /** @param {import('estree').Identifier} node */
      Identifier(node) {
        if (!LATIN_ONLY.test(node.name)) {
          context.report({ node, messageId: 'nonLatin', data: { name: node.name } });
        }
      },
    };
  },
};
