/**
 * docs/03-АРХИТЕКТУРА.md § 3: модуль обращается только к модулям с меньшим
 * номером и только через их `public.ts`.
 *
 * Проверка границ читает импорты, а SQL — строка. Запрос
 * `SELECT ... FROM access.visible_units(...)` в модуле `org` формально
 * никаких импортов не добавляет, а по существу это обращение к старшему
 * модулю мимо его входа. Такое обращение опаснее импорта: оно невидимо.
 *
 * Схема базы совпадает с именем модуля (13-ГЛОССАРИЙ § 3), поэтому имя
 * схемы в строке — достаточный признак.
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Запрет обращения к схеме чужого модуля из SQL (§ 3)' },
    schema: [{
      type: 'object',
      properties: { order: { type: 'array', items: { type: 'string' } } },
      required: ['order'],
      additionalProperties: false,
    }],
    messages: {
      foreign:
        'Запрос обращается к схеме «{{schema}}» модуля {{their}}, а этот модуль — {{mine}} (§ 3). Схема чужого модуля недоступна даже из SQL: обращайтесь через его public.ts.',
      unknown:
        'Запрос обращается к схеме «{{schema}}», которой нет в порядке модулей § 3. Схема совпадает с именем модуля (13 § 3).',
    },
  },
  create(context) {
    const order = /** @type {{ order: string[] }} */ (context.options[0] ?? { order: [] }).order;
    const mine = moduleOf(context.filename);
    if (mine === undefined) return {};
    const myIndex = order.indexOf(mine);
    if (myIndex === -1) return {};

    // Схемы, доступные всегда: своя и общая.
    const allowed = new Set([mine, 'public', 'pg_catalog', 'information_schema']);
    const SCHEMA_REFERENCE = /\b(?:from|join|into|update|table)\s+([a-z_]+)\./giu;

    /** @param {string} text @param {import('estree').Node} node */
    const inspect = (text, node) => {
      for (const match of text.matchAll(SCHEMA_REFERENCE)) {
        const schema = String(match[1]);
        if (allowed.has(schema)) continue;
        const theirIndex = order.indexOf(schema);
        if (theirIndex === -1) {
          context.report({ node, messageId: 'unknown', data: { schema } });
          continue;
        }
        if (theirIndex >= myIndex) {
          context.report({
            node,
            messageId: 'foreign',
            data: { schema, their: String(theirIndex + 1), mine: String(myIndex + 1) },
          });
        }
      }
    };

    return {
      /** @param {import('estree').Literal} node */
      Literal(node) {
        if (typeof node.value === 'string') inspect(node.value, node);
      },
      /** @param {import('estree').TemplateElement} node */
      TemplateElement(node) {
        inspect(String(node.value.cooked ?? node.value.raw), node);
      },
    };
  },
};

/**
 * Имя модуля из пути apps/api/src/modules/<модуль>/…
 * @param {string} filename
 * @returns {string | undefined}
 */
function moduleOf(filename) {
  const match = /modules[\\/]([a-z_]+)[\\/]/u.exec(filename);
  return match === null ? undefined : String(match[1]);
}
