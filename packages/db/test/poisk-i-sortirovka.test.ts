import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';

/**
 * Основание приёмочного сценария ПС-1-06 (docs/10-ЭТАПЫ.md).
 * Порядок задан контрактом дословно — docs/04-ДАННЫЕ.md § 4.5 — и проверяется
 * целиком, а не выборочно: одна переставленная буква ломает все реестры.
 */
const ФАМИЛИИ = [
  'Гулов', 'Ғафуров', 'Иброҳимов', 'Каримов', 'Косимов',
  'Қодиров', 'Қосимов', 'Рахимов', 'Раҳимов', 'Умаров',
  'Ӯктамов', 'Хакимов', 'Ҳакимов', 'Чумаев', 'Ҷумаев',
];

describe('поиск и сортировка с таджикскими буквами', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('poisk');
    await db.client.query(`
      CREATE TABLE фамилия (
        значение text NOT NULL COLLATE public.coll_tj,
        поиск tsvector GENERATED ALWAYS AS (to_tsvector('russian_tj', значение)) STORED,
        норма text GENERATED ALWAYS AS (public.tj_norm(значение)) STORED
      )
    `);
    await db.client.query(
      `INSERT INTO фамилия (значение) SELECT unnest($1::text[])`,
      [[...ФАМИЛИИ].sort(() => 0.5 - Math.random())],
    );
  }, 60_000);
  afterAll(async () => { await db.drop(); });

  it('порядок совпадает с § 4.5 по всем пятнадцати позициям', async () => {
    const { rows } = await db.client.query<{ значение: string }>(
      'SELECT значение FROM фамилия ORDER BY значение',
    );
    expect(rows.map((r) => r.значение)).toEqual(ФАМИЛИИ);
  });

  it('запрос «Рахимов» находит и «Рахимов», и «Раҳимов»', async () => {
    const { rows } = await db.client.query<{ значение: string }>(
      `SELECT значение FROM фамилия WHERE поиск @@ plainto_tsquery('russian_tj', 'Рахимов') ORDER BY значение`,
    );
    expect(rows.map((r) => r.значение)).toEqual(['Рахимов', 'Раҳимов']);
  });

  it('запрос «Ҳакимов» находит и «Хакимов», и «Ҳакимов»', async () => {
    const { rows } = await db.client.query<{ значение: string }>(
      `SELECT значение FROM фамилия WHERE поиск @@ plainto_tsquery('russian_tj', 'Ҳакимов') ORDER BY значение`,
    );
    expect(rows.map((r) => r.значение)).toEqual(['Хакимов', 'Ҳакимов']);
  });

  it('поиск по подстроке через tj_norm нечувствителен к таджикским буквам', async () => {
    const { rows } = await db.client.query<{ значение: string }>(
      `SELECT значение FROM фамилия WHERE норма LIKE '%' || public.tj_norm($1) || '%' ORDER BY значение`,
      ['Чумаев'],
    );
    expect(rows.map((r) => r.значение)).toEqual(['Чумаев', 'Ҷумаев']);
  });

  it('различие сохраняется: одинаковыми записи не становятся', async () => {
    const { rows } = await db.client.query<{ n: string }>(
      'SELECT count(DISTINCT значение)::text AS n FROM фамилия',
    );
    expect(rows[0]?.n).toBe('15');
  });
});
