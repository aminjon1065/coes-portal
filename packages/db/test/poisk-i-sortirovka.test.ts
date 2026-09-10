import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';

/**
 * Основание приёмочного сценария ПС-1-06 (docs/10-ЭТАПЫ.md).
 * Порядок задан контрактом дословно — docs/04-ДАННЫЕ.md § 4.5 — и проверяется
 * целиком, а не выборочно: одна переставленная буква ломает все реестры.
 */
const SURNAMES = [
  'Гулов', 'Ғафуров', 'Иброҳимов', 'Каримов', 'Косимов',
  'Қодиров', 'Қосимов', 'Рахимов', 'Раҳимов', 'Умаров',
  'Ӯктамов', 'Хакимов', 'Ҳакимов', 'Чумаев', 'Ҷумаев',
];

describe('поиск и сортировка с таджикскими буквами', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('poisk');
    await db.client.query(`
      CREATE TABLE surname (
        value text NOT NULL COLLATE public.coll_tj,
        search tsvector GENERATED ALWAYS AS (to_tsvector('russian_tj', value)) STORED,
        norm text GENERATED ALWAYS AS (public.tj_norm(value)) STORED
      )
    `);
    await db.client.query(
      `INSERT INTO surname (value) SELECT unnest($1::text[])`,
      [[...SURNAMES].sort(() => 0.5 - Math.random())],
    );
  }, 60_000);
  afterAll(async () => { await db.drop(); });

  it('порядок совпадает с § 4.5 по всем пятнадцати позициям', async () => {
    const { rows } = await db.client.query<{ value: string }>(
      'SELECT value FROM surname ORDER BY value',
    );
    expect(rows.map((r) => r.value)).toEqual(SURNAMES);
  });

  it('запрос «Рахимов» находит и «Рахимов», и «Раҳимов»', async () => {
    const { rows } = await db.client.query<{ value: string }>(
      `SELECT value FROM surname WHERE search @@ plainto_tsquery('russian_tj', 'Рахимов') ORDER BY value`,
    );
    expect(rows.map((r) => r.value)).toEqual(['Рахимов', 'Раҳимов']);
  });

  it('запрос «Ҳакимов» находит и «Хакимов», и «Ҳакимов»', async () => {
    const { rows } = await db.client.query<{ value: string }>(
      `SELECT value FROM surname WHERE search @@ plainto_tsquery('russian_tj', 'Ҳакимов') ORDER BY value`,
    );
    expect(rows.map((r) => r.value)).toEqual(['Хакимов', 'Ҳакимов']);
  });

  it('поиск по подстроке через tj_norm нечувствителен к таджикским буквам', async () => {
    const { rows } = await db.client.query<{ value: string }>(
      `SELECT value FROM surname WHERE norm LIKE '%' || public.tj_norm($1) || '%' ORDER BY value`,
      ['Чумаев'],
    );
    expect(rows.map((r) => r.value)).toEqual(['Чумаев', 'Ҷумаев']);
  });

  it('различие сохраняется: одинаковыми записи не становятся', async () => {
    const { rows } = await db.client.query<{ n: string }>(
      'SELECT count(DISTINCT value)::text AS n FROM surname',
    );
    expect(rows[0]?.n).toBe('15');
  });
});
