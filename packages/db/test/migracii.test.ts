import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';
import { migrate } from '../migrate.ts';

/** Барьер § 10: миграции с нуля на свежей базе. */
describe('миграции на свежей базе', () => {
  let db: TempDatabase;
  beforeAll(async () => { db = await createTempDatabase('migracii'); }, 60_000);
  afterAll(async () => { await db.drop(); });

  it('создают учётную таблицу и записывают применённое', async () => {
    const { rows } = await db.client.query<{ version: number; name: string }>(
      'SELECT version, name FROM sys.migration ORDER BY version',
    );
    expect(rows).toEqual([{ version: 1, name: 'osnovanie' }]);
  });

  it('повторный запуск ничего не применяет', async () => {
    expect(await migrate(db.url)).toEqual([]);
  });

  it('создают расширения, требуемые контрактом', async () => {
    const { rows } = await db.client.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname IN ('postgis','unaccent','pg_trgm') ORDER BY extname",
    );
    expect(rows.map((r) => r.extname)).toEqual(['pg_trgm', 'postgis', 'unaccent']);
  });

  it('кластер живёт в локали UTF-8: иначе lower() не понижает кириллицу', async () => {
    // Барьер против собственной ошибки: при локали C функция lower() оставляет
    // кириллицу как есть, tj_norm (§ 4.3) молча ломается, и поиск по подстроке
    // перестаёт находить что-либо. Ошибка не видна нигде, кроме результата.
    const { rows } = await db.client.query<{ понижено: string; локаль: string }>(
      `SELECT lower('ЧУМАЕВ') AS "понижено",
              (SELECT datctype FROM pg_database WHERE datname = current_database()) AS "локаль"`,
    );
    expect(rows[0]?.понижено).toBe('чумаев');
    expect(rows[0]?.локаль).toMatch(/utf-?8/i);
  });

  it('создают словарь, конфигурацию поиска и сопоставление (§ 4)', async () => {
    const { rows } = await db.client.query<{ есть: boolean }>(`
      SELECT (SELECT count(*) FROM pg_ts_dict   WHERE dictname = 'tajik_unaccent') = 1
         AND (SELECT count(*) FROM pg_ts_config WHERE cfgname  = 'russian_tj')     = 1
         AND (SELECT count(*) FROM pg_collation WHERE collname = 'coll_tj')        = 1 AS "есть"
    `);
    expect(rows[0]?.есть).toBe(true);
  });
});
