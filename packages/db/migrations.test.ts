import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readMigrations,
  validateSequence,
  validateApplied,
  planMigrations,
  MIGRATION_FILE,
} from './migrations.ts';

const withDir = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'coes-mig-'));
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
};

/** Барьер § 12: применение только вперёд, нумерация сквозная. */
describe('миграции', () => {
  it('читает и упорядочивает по номеру', () => {
    const dir = withDir({ '0002_vtoraya.sql': 'select 2;', '0001_pervaya.sql': 'select 1;' });
    try {
      expect(readMigrations(dir).map((m) => m.version)).toEqual([1, 2]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('отвергает имя не по образцу NNNN_имя.sql', () => {
    const dir = withDir({ 'первая.sql': 'select 1;' });
    try {
      expect(() => readMigrations(dir)).toThrow(/не соответствует образцу/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('образец имени: четыре цифры, подчёркивание, латиница', () => {
    expect(MIGRATION_FILE.test('0001_osnovanie.sql')).toBe(true);
    expect(MIGRATION_FILE.test('001_osnovanie.sql')).toBe(false);
    expect(MIGRATION_FILE.test('0001_Osnovanie.sql')).toBe(false);
  });

  it('пропускает сквозную нумерацию', () => {
    const m = [1, 2, 3].map((version) => ({ version, name: 'n', sql: '', checksum: 'c' }));
    expect(() => validateSequence(m)).not.toThrow();
  });

  it('ловит пропуск в нумерации: миграцию удалили или переименовали', () => {
    const m = [1, 3].map((version) => ({ version, name: 'n', sql: '', checksum: 'c' }));
    expect(() => validateSequence(m)).toThrow(/не сквозная: ожидался номер 2/);
  });

  it('ловит изменение уже применённой миграции', () => {
    const migrations = [{ version: 1, name: 'osnovanie', sql: 'select 2;', checksum: 'новая' }];
    const applied = [{ version: 1, name: 'osnovanie', checksum: 'старая' }];
    expect(() => validateApplied(migrations, applied)).toThrow(/изменена после применения/);
  });

  it('ловит применённую миграцию, файл которой исчез', () => {
    expect(() => validateApplied([], [{ version: 1, name: 'osnovanie', checksum: 'c' }])).toThrow(
      /применена к базе, но файла нет/,
    );
  });

  it('к применению остаются только непринятые', () => {
    const migrations = [1, 2, 3].map((version) => ({ version, name: 'n', sql: '', checksum: 'c' }));
    const applied = [{ version: 1, name: 'n', checksum: 'c' }];
    expect(planMigrations(migrations, applied).map((m) => m.version)).toEqual([2, 3]);
  });

  it('на пустом каталоге к применению ничего нет', () => {
    expect(planMigrations([], [])).toEqual([]);
  });
});
