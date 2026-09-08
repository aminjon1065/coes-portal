import { describe, it, expect } from 'vitest';
import { findCatalogCodeLiterals } from './core.ts';

/** Барьер П-1: ветвление по коду элемента справочника запрещено. */
describe('check:literals', () => {
  it('находит код элемента справочника в коде программы', () => {
    const found = findCatalogCodeLiterals(
      'apps/api/src/modules/incident/service.ts',
      "if (kind.code === 'PRI-01') { return true; }",
    );
    expect(found).toEqual([
      { file: 'apps/api/src/modules/incident/service.ts', line: 1, value: 'PRI-01' },
    ]);
  });

  it('находит код и в шаблонной строке без подстановок', () => {
    expect(findCatalogCodeLiterals('a.ts', 'const c = `TEH-12`;')).toHaveLength(1);
  });

  it('пропускает код справочника: он часть программы и пишется без дефиса', () => {
    expect(findCatalogCodeLiterals('a.ts', "catalog('INCIDENT_KIND')")).toEqual([]);
  });

  it('пропускает признак элемента: ветвление по нему разрешено', () => {
    expect(findCatalogCodeLiterals('a.ts', 'if (kind.isEmergency) { return true; }')).toEqual([]);
  });

  it('пропускает совпадение в комментарии: это не литерал', () => {
    expect(findCatalogCodeLiterals('a.ts', '// пример кода вида: PRI-01\nconst x = 1;')).toEqual([]);
  });

  it('пустой файл нарушений не даёт', () => {
    expect(findCatalogCodeLiterals('a.ts', '')).toEqual([]);
  });
});
