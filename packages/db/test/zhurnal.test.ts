import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';

/**
 * Журнал действий: только добавление, цепочка хешей, запрет держится
 * правами базы, а не добросовестностью программы.
 * docs/05-ДОСТУП.md § 9.3, docs/04-ДАННЫЕ.md § 13, adr/12.
 */
const записать = (n: number): string => `
  INSERT INTO audit.event (action, entity_schema, entity_table, entity_label)
  VALUES ('org.unit.create', 'org', 'org_unit', 'Запись ${n}')
`;

describe('журнал действий', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('zhurnal');
    for (const n of [1, 2, 3]) await db.client.query(записать(n));
  }, 60_000);
  afterAll(async () => { await db.drop(); });

  it('связывает записи в цепочку: prev_hash равен хешу предыдущей', async () => {
    const { rows } = await db.client.query<{ связано: boolean }>(`
      SELECT bool_and(
        CASE WHEN предыдущий IS NULL THEN prev_hash IS NULL ELSE prev_hash = предыдущий END
      ) AS "связано"
      FROM (SELECT prev_hash, lag(hash) OVER (ORDER BY id) AS предыдущий FROM audit.event) t
    `);
    expect(rows[0]?.связано).toBe(true);
  });

  it('пересчитанный хеш совпадает с записанным', async () => {
    const { rows } = await db.client.query<{ совпало: boolean }>(`
      SELECT bool_and(hash = digest(coalesce(prev_hash, ''::bytea) || audit.canonical(e)::bytea, 'sha256')) AS "совпало"
      FROM audit.event e
    `);
    expect(rows[0]?.совпало).toBe(true);
  });

  it('роль приложения не может изменить запись — это право в базе', async () => {
    await db.client.query('SET ROLE coes_app');
    try {
      await expect(
        db.client.query("UPDATE audit.event SET entity_label = 'подмена' WHERE id = 1"),
      ).rejects.toThrow(/permission denied|нет прав/i);
    } finally {
      await db.client.query('RESET ROLE');
    }
  });

  it('роль приложения не может удалить запись', async () => {
    await db.client.query('SET ROLE coes_app');
    try {
      await expect(db.client.query('DELETE FROM audit.event WHERE id = 1')).rejects.toThrow(
        /permission denied|нет прав/i,
      );
    } finally {
      await db.client.query('RESET ROLE');
    }
  });

  it('роль приложения может добавить запись: журнал обязан пополняться', async () => {
    await db.client.query('SET ROLE coes_app');
    try {
      await db.client.query(записать(4));
    } finally {
      await db.client.query('RESET ROLE');
    }
    const { rows } = await db.client.query<{ n: string }>('SELECT count(*)::text AS n FROM audit.event');
    expect(rows[0]?.n).toBe('4');
  });

  it('даже владелец схемы не изменит запись: мешает триггер', async () => {
    await expect(
      db.client.query("UPDATE audit.event SET entity_label = 'подмена' WHERE id = 1"),
    ).rejects.toThrow(/только на добавление/);
  });
});

/** Обнаружение вмешательства требует отдельной базы: цепочка ломается навсегда. */
describe('обнаружение вмешательства в журнал', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('podmena');
    for (const n of [1, 2, 3]) await db.client.query(записать(n));
  }, 60_000);
  afterAll(async () => { await db.drop(); });

  const проверить = async (): Promise<{ id: string; reason: string } | null> => {
    const { rows } = await db.client.query<{
      id: string; prevHash: string | null; hash: string; expectedHash: string;
    }>(`
      SELECT e.id::text AS "id",
             encode(e.prev_hash, 'hex') AS "prevHash",
             encode(e.hash, 'hex') AS "hash",
             encode(digest(coalesce(e.prev_hash, ''::bytea) || audit.canonical(e)::bytea, 'sha256'), 'hex') AS "expectedHash"
      FROM audit.event e ORDER BY e.id
    `);
    const { findFirstBreak } = await import('../../../tools/audit-verify/core.ts');
    return findFirstBreak(rows);
  };

  it('до вмешательства нарушений нет', async () => {
    expect(await проверить()).toBeNull();
  });

  it('подмена содержимого в обход триггеров обнаруживается', async () => {
    // Так выглядит вмешательство в базу мимо системы: триггеры отключают,
    // строку правят, триггеры возвращают. Цепочка это переживает и помнит.
    await db.client.query('ALTER TABLE audit.event DISABLE TRIGGER forbid_change');
    await db.client.query("UPDATE audit.event SET entity_label = 'подмена' WHERE id = 2");
    await db.client.query('ALTER TABLE audit.event ENABLE TRIGGER forbid_change');

    expect(await проверить()).toEqual({ id: '2', reason: 'содержимое записи изменено' });
  });

  it('изъятие записи обнаруживается как разрыв связи', async () => {
    await db.client.query('ALTER TABLE audit.event DISABLE TRIGGER forbid_change');
    await db.client.query("UPDATE audit.event SET entity_label = 'Запись 2' WHERE id = 2");
    await db.client.query('DELETE FROM audit.event WHERE id = 2');
    await db.client.query('ALTER TABLE audit.event ENABLE TRIGGER forbid_change');

    expect(await проверить()).toEqual({ id: '3', reason: 'связь с предыдущей записью разорвана' });
  });
});
