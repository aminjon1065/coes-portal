import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { connect } from './connect.ts';
import {
  readMigrations,
  validateSequence,
  validateApplied,
  planMigrations,
  type AppliedMigration,
} from './migrations.ts';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const BOOTSTRAP = `
  CREATE SCHEMA IF NOT EXISTS sys;
  CREATE TABLE IF NOT EXISTS sys.migration (
    version    integer     PRIMARY KEY,
    name       text        NOT NULL,
    checksum   text        NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`;

/**
 * Применяет непринятые миграции по возрастанию номера, каждую в своей
 * транзакции (docs/04-ДАННЫЕ.md § 12). Применение только вперёд: откатов нет.
 * Возвращает номера применённых.
 */
export async function migrate(url?: string): Promise<number[]> {
  const client = url === undefined ? await connect() : await connect(url);
  try {
    await client.query(BOOTSTRAP);

    const migrations = readMigrations(MIGRATIONS_DIR);
    validateSequence(migrations);

    const { rows } = await client.query<AppliedMigration>(
      'SELECT version, name, checksum FROM sys.migration ORDER BY version',
    );
    validateApplied(migrations, rows);

    const pending = planMigrations(migrations, rows);
    for (const migration of pending) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO sys.migration (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Миграция ${migration.version} («${migration.name}») не применилась: ${reason}`);
      }
    }
    return pending.map((migration) => migration.version);
  } finally {
    await client.end();
  }
}

// Запуск как команда: pnpm run db:migrate
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const applied = await migrate();
  console.log(
    applied.length === 0
      ? 'Миграции: все применены, новых нет.'
      : `Миграции применены: ${applied.join(', ')}.`,
  );
}
