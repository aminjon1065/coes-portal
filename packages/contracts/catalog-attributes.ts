import { z } from 'zod';

/**
 * Признаки элементов справочников — КОД (docs/04-ДАННЫЕ.md § 5.2).
 *
 * «Ветвление логики допустимо только по признакам»: программа никогда не
 * сравнивает код элемента (§ 5.1), она читает признак. Поэтому перечень
 * признаков, читаемых программой, обязан быть здесь — рядом с остальным
 * кодом, а не в данных. Справочник администратор заменит целиком; набор
 * признаков он заменить не может, потому что каждому признаку отвечает
 * ветвь программы.
 *
 * Схема признаков справочника (`ref.catalog.attribute_schema`) обязана
 * совпадать с этим перечнем. Совпадение удерживает проверка, названная
 * в том же § 5.2, — она живёт в packages/db/test/spravochniki.test.ts и
 * сверяет живую базу с перечнем.
 */

/** Уровни важности дизайн-системы (docs/06-ДИЗАЙН-СИСТЕМА.md § Шкала важности). */
export const SEVERITY_TOKENS = ['sev-1', 'sev-2', 'sev-3', 'sev-4', 'sev-5'] as const;

/**
 * Вид значения признака. Произвольного значения не бывает: администратор,
 * вводящий цвет вне палитры или уровень важности «7», разрушил бы и палитру,
 * и шкалу.
 */
export const ATTRIBUTE_KINDS = ['flag', 'level', 'colorToken', 'text', 'reference'] as const;
export type AttributeKind = (typeof ATTRIBUTE_KINDS)[number];

export interface CatalogAttribute {
  /** Имя признака, каким его читает программа. */
  readonly name: string;
  readonly kind: AttributeKind;
  /** Что признак означает. Показывается администратору справочников (Э-031). */
  readonly title: string;
}

const flag = (name: string, title: string): CatalogAttribute => ({ name, kind: 'flag', title });

/**
 * Признаки по справочникам — § 5.3. Справочники этапов 1–7 объявлены здесь
 * целиком: перечень описывает начальный состав справочников, а он задан
 * одной таблицей и загружается одним наполнением, не по этапам.
 */
export const CATALOG_ATTRIBUTES: Readonly<Record<string, readonly CatalogAttribute[]>> = {
  INCIDENT_KIND: [
    flag('isEmergency', 'Относится к чрезвычайным ситуациям'),
    flag('requiresCasualties', 'Требует заполнения блока «Люди»'),
    flag('requiresArea', 'Требует указания площади'),
    flag('requiresDamage', 'Требует заполнения блока «Ущерб»'),
  ],
  INCIDENT_SCALE: [
    { name: 'severityLevel', kind: 'level', title: 'Уровень важности, 1–5' },
    { name: 'colorToken', kind: 'colorToken', title: 'Цвет уровня важности' },
  ],
  INCIDENT_CAUSE: [],
  INCIDENT_SOURCE: [],
  DAMAGE_TYPE: [
    { name: 'unit', kind: 'text', title: 'Единица измерения' },
  ],
  AGENCY: [],
  SETTLEMENT_TYPE: [],
  POSITION_KIND: [
    flag('isHead', 'Должность руководителя подразделения'),
  ],
  AFFECTED_STATUS: [
    flag('isDead', 'Погибший'),
    flag('isInjured', 'Пострадавший'),
    flag('isMissing', 'Пропавший без вести'),
    flag('isEvacuated', 'Эвакуированный'),
    flag('isRescued', 'Спасённый'),
  ],
  HEALTH_CATEGORY: [
    flag('isSensitive', 'Сведения ограниченного доступа'),
  ],
  DOC_KIND: [
    flag('requiresApproval', 'Требует утверждения по маршруту'),
    flag('isIncoming', 'Входящий документ'),
    flag('isOutgoing', 'Исходящий документ'),
  ],
  CASE_FILE: [
    { name: 'retentionRuleId', kind: 'reference', title: 'Правило хранения (код office.retention_rule)' },
  ],
  RETENTION_ACTION: [
    flag('isDestroy', 'Уничтожить по акту'),
    flag('isPermanent', 'Хранить постоянно'),
    flag('isTransfer', 'Передать в архив'),
  ],
  TASK_PRIORITY: [
    { name: 'severityLevel', kind: 'level', title: 'Уровень важности, 1–5' },
    { name: 'colorToken', kind: 'colorToken', title: 'Цвет уровня важности' },
  ],
  MEETING_KIND: [],
};

/** Коды справочников, известных программе (§ 5.1). */
export const CATALOG_CODES: readonly string[] = Object.keys(CATALOG_ATTRIBUTES);

/** Схема значения признака по его виду. Из неё же проверяются значения. */
export function attributeValueSchema(kind: AttributeKind): z.ZodTypeAny {
  switch (kind) {
    case 'flag':
      return z.boolean();
    case 'level':
      return z.number().int().min(1).max(5);
    case 'colorToken':
      return z.enum(SEVERITY_TOKENS);
    case 'text':
    case 'reference':
      return z.string().min(1);
  }
}

/**
 * Проверка значений признаков одного элемента. Признак, не объявленный
 * у справочника, — отказ, а не молчаливое сохранение: принятый лишний
 * признак не читается ни одной ветвью программы, и никто об этом не узнает.
 */
export function attributesSchemaFor(catalogCode: string): z.ZodTypeAny {
  const declared = CATALOG_ATTRIBUTES[catalogCode] ?? [];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const attribute of declared) {
    shape[attribute.name] = attributeValueSchema(attribute.kind).optional();
  }
  return z.object(shape).strict();
}
