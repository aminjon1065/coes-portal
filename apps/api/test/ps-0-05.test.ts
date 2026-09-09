import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { nowMs } from '../../../packages/core/clock.ts';

/**
 * ПС-0-05. Восстановление из резервной копии (docs/10-ЭТАПЫ.md § 2).
 *
 * Проверяется не наличие файла копии, а то, ради чего копия существует:
 * после потери тома базы возвращаются и данные копии, и изменения, сделанные
 * ПОСЛЕ неё. «Копия считается существующей только после успешного
 * восстановления из неё» (docs/03-АРХИТЕКТУРА.md § 9).
 */
const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://coes_owner:coes_local@127.0.0.1:5432/coes';
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

const запустить = (script: string, ...args: string[]): string =>
  execFileSync('bash', [script, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const подключиться = async (): Promise<Client> => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  return client;
};

const пауза = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

describe('ПС-0-05. Восстановление из резервной копии', () => {
  it(
    'возвращает и копию, и изменения, сделанные после неё',
    async () => {
      let db = await подключиться();
      // Журнал только на добавление, поэтому записи прошлых прогонов остаются
      // в базе навсегда. Метка прогона делает проверку независимой от них.
      const прогон = randomBytes(4).toString('hex');

      // 1. Зафиксировать состояние.
      const состояние = async (c: Client): Promise<Record<string, string>> => {
        const { rows } = await c.query<Record<string, string>>(`
          SELECT (SELECT count(*) FROM org.org_unit)::text     AS "подразделений",
                 (SELECT count(*) FROM ref.catalog_item)::text AS "справочники",
                 (SELECT count(*) FROM audit.event)::text      AS "журнал"`);
        return rows[0] ?? {};
      };
      const до = await состояние(db);

      // 2. Снять полную копию.
      const вывод = запустить('deploy/backup/backup.sh');
      const метка = /Копия снята: (\S+)/.exec(вывод)?.[1];
      expect(метка, 'скрипт копии обязан назвать метку').toBeTruthy();

      // 3. Внести десять изменений ПОСЛЕ копии — именно они и проверяются.
      for (let i = 1; i <= 10; i += 1) {
        await db.query(
          `INSERT INTO audit.event (action, entity_schema, entity_table, entity_label)
           VALUES ('org.unit.create', 'org', 'org_unit', $1)`,
          [`Изменение после копии ${прогон} № ${i}`],
        );
      }
      const { rows: п } = await db.query<{ файл: string; момент: string }>(
        `SELECT pg_walfile_name(pg_current_wal_lsn()) AS "файл", now()::text AS "момент"`,
      );
      const текущийФайл = String(п[0]?.файл);

      // 4. Дождаться, пока журнал транзакций попадёт в архив. Ждём именно
      //    архивации, а не форсируем её: в настоящем отказе никто ничего не
      //    форсирует, и потеря ограничена archive_timeout.
      let заархивирован = false;
      for (let i = 0; i < 60 && !заархивирован; i += 1) {
        const { rows } = await db.query<{ последний: string | null }>(
          'SELECT last_archived_wal AS "последний" FROM pg_stat_archiver',
        );
        заархивирован = (rows[0]?.последний ?? '') >= текущийФайл;
        if (!заархивирован) await пауза(1000);
      }
      expect(заархивирован, 'журнал транзакций обязан попасть в архив').toBe(true);
      await db.end();

      // 5–6. Отказ и восстановление: скрипт останавливает базу, стирает том
      //      и разворачивает копию, доигрывая архив.
      const начало = nowMs();
      const отчёт = запустить('deploy/backup/restore.sh', String(метка));
      const секунд = Math.round((nowMs() - начало) / 1000);

      expect(отчёт).toMatch(/Восстановление завершено/);
      expect(отчёт).toMatch(/нарушений цепочки не обнаружено/);

      // 7. Сверить состояние.
      db = await подключиться();
      const после = await состояние(db);

      expect(после['подразделений']).toBe(до['подразделений']);
      expect(после['справочники']).toBe(до['справочники']);

      const { rows: восстановленные } = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit.event WHERE entity_label LIKE $1`,
        [`Изменение после копии ${прогон} %`],
      );
      expect(восстановленные[0]?.n, 'изменения после копии обязаны вернуться').toBe('10');

      // Потеря данных: все десять изменений на месте, значит потеряно ноль.
      // Норматив Н-19 — не более 15 минут — выдержан с запасом.
      await db.end();

      console.log(
        `ПС-0-05: восстановление за ${секунд} с; изменений после копии возвращено 10 из 10; потеря 0.`,
      );
    },
    240_000,
  );
});
