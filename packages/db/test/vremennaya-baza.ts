import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { databaseUrl } from '../connect.ts';
import { migrate } from '../migrate.ts';
import { seed } from '../seed.ts';

/**
 * Каждая проверка схемы выполняется на СВЕЖЕЙ базе: «миграции с нуля»
 * (docs/03-АРХИТЕКТУРА.md § 10) нельзя проверить на базе, где они уже
 * применены. База создаётся, проверяется и удаляется.
 */
export interface TempDatabase {
  readonly url: string;
  readonly client: Client;
  drop(): Promise<void>;
}

/**
 * Приёмочный сценарий выполняется на развёрнутой системе, а развёртывание
 * загружает начальное наполнение (ПС-0-09). Проверки схемы обходятся без
 * него, поэтому наполнение включается признаком.
 */
export interface TempDatabaseOptions {
  readonly withSeed?: boolean;
}

export async function createTempDatabase(
  label: string,
  options: TempDatabaseOptions = {},
): Promise<TempDatabase> {
  const base = databaseUrl();
  // Уникальность — из случайности, а не из часов: правило coes/no-direct-date
  // запрещает обращаться к системному времени мимо packages/core/clock.ts (§ 5.2),
  // и для имени временной базы случайный суффикс надёжнее при parallel-прогонах.
  const name = `coes_test_${label}_${randomBytes(4).toString('hex')}`;

  const admin = new Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);
  await admin.end();

  const url = base.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
  await migrate(url);
  if (options.withSeed === true) await seed(url);

  const client = new Client({ connectionString: url });
  await client.connect();

  return {
    url,
    client,
    async drop(): Promise<void> {
      await client.end();
      const cleaner = new Client({ connectionString: base });
      await cleaner.connect();
      await cleaner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await cleaner.end();
    },
  };
}
