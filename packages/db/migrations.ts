import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Миграция: нумерованный SQL-файл (docs/04-ДАННЫЕ.md § 12). */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

/** Запись о применённой миграции — таблица `sys.migration`. */
export interface AppliedMigration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export const MIGRATION_FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** Читает каталог миграций и упорядочивает их по номеру. */
export function readMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = MIGRATION_FILE.exec(file);
      if (match === null) {
        throw new Error(
          `Имя миграции «${file}» не соответствует образцу NNNN_имя.sql (docs/04-ДАННЫЕ.md § 12).`,
        );
      }
      const sql = readFileSync(join(dir, file), 'utf8');
      return {
        version: Number(match[1]),
        name: String(match[2]),
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    })
    .sort((a, b) => a.version - b.version);
}

/**
 * Нумерация сквозная (§ 12): пропуск или повтор номера означает, что
 * миграцию удалили или переименовали, а применение — только вперёд.
 */
export function validateSequence(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const expected = index + 1;
    if (migration.version !== expected) {
      throw new Error(
        `Нумерация миграций не сквозная: ожидался номер ${expected}, получен ${migration.version} («${migration.name}»).`,
      );
    }
  });
}

/**
 * Применённая миграция неизменна: откатов нет, значит её содержимое
 * не может измениться задним числом.
 */
export function validateApplied(
  migrations: readonly Migration[],
  applied: readonly AppliedMigration[],
): void {
  for (const record of applied) {
    const migration = migrations.find((m) => m.version === record.version);
    if (migration === undefined) {
      throw new Error(
        `Миграция ${record.version} («${record.name}») применена к базе, но файла нет. Применение только вперёд, удалять применённые миграции нельзя.`,
      );
    }
    if (migration.checksum !== record.checksum) {
      throw new Error(
        `Миграция ${record.version} («${record.name}») изменена после применения. Применение только вперёд: исправление вносится новой миграцией.`,
      );
    }
  }
}

/** Что осталось применить. */
export function planMigrations(
  migrations: readonly Migration[],
  applied: readonly AppliedMigration[],
): Migration[] {
  const done = new Set(applied.map((record) => record.version));
  return migrations.filter((migration) => !done.has(migration.version));
}
