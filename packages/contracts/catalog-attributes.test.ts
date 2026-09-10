import { describe, it, expect } from 'vitest';
import {
  CATALOG_ATTRIBUTES, CATALOG_CODES, SEVERITY_TOKENS,
  attributeValueSchema, attributesSchemaFor,
} from './catalog-attributes.ts';
import { CATALOG_CODE } from './ref.ts';

/**
 * Перечень признаков — код (docs/04-ДАННЫЕ.md § 5.2). Проверяется то, ради
 * чего он существует: ветвление логики допустимо только по признакам, а
 * значит признак не может быть ни произвольным по имени, ни произвольным
 * по значению.
 */
describe('признаки справочников', () => {
  it('коды справочников имеют форму кода программы — без дефиса', () => {
    for (const code of CATALOG_CODES) {
      expect(CATALOG_CODE.test(code), `код «${code}»`).toBe(true);
    }
  });

  it('перечень содержит все пятнадцать справочников § 5.3', () => {
    expect(CATALOG_CODES).toHaveLength(15);
  });

  it('имена признаков внутри справочника не повторяются', () => {
    for (const [code, attributes] of Object.entries(CATALOG_ATTRIBUTES)) {
      const names = attributes.map((attribute) => attribute.name);
      expect(new Set(names).size, `справочник «${code}»`).toBe(names.length);
    }
  });

  it('уровень важности вне шкалы 1–5 отвергается', () => {
    const level = attributeValueSchema('level');
    expect(level.safeParse(3).success).toBe(true);
    expect(level.safeParse(0).success).toBe(false);
    expect(level.safeParse(7).success).toBe(false);
  });

  it('цвет вне палитры дизайн-системы отвергается: иначе администратор её разрушит', () => {
    const token = attributeValueSchema('colorToken');
    for (const value of SEVERITY_TOKENS) expect(token.safeParse(value).success).toBe(true);
    expect(token.safeParse('#00FF00').success).toBe(false);
    expect(token.safeParse('sev-6').success).toBe(false);
  });

  it('признак, не объявленный справочнику, не принимается', () => {
    const schema = attributesSchemaFor('INCIDENT_SCALE');
    expect(schema.safeParse({ severityLevel: 2, colorToken: 'sev-2' }).success).toBe(true);
    expect(schema.safeParse({ isEmergency: true }).success).toBe(false);
  });

  it('справочник без признаков не принимает ни одного', () => {
    const schema = attributesSchemaFor('AGENCY');
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ isHead: true }).success).toBe(false);
  });
});
