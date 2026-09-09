import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';
import { seed } from '../seed.ts';

/**
 * Справочники — механизм принципа П-1 (docs/04-ДАННЫЕ.md § 5, adr/05).
 * Проверяется не «данные загрузились», а то, ради чего механизм существует:
 * различие формы кодов, невозможность разрушить палитру и иерархию,
 * и пометка «придумано нами».
 */
describe('справочники', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('spravochniki');
    await seed(db.url);
  }, 90_000);
  afterAll(async () => { await db.drop(); });

  const вставить = (catalogCode: string, code: string): string => `
    INSERT INTO ref.catalog_item (id, catalog_id, code, name)
    SELECT gen_random_uuid(), c.id, '${code}', 'Образец'
    FROM ref.catalog c WHERE c.code = '${catalogCode}'`;

  it('начальное наполнение загружено целиком и помечено как временное', async () => {
    const { rows } = await db.client.query<{ справочников: string; элементов: string; временных: string }>(`
      SELECT (SELECT count(*) FROM ref.catalog)::text AS "справочников",
             (SELECT count(*) FROM ref.catalog_item)::text AS "элементов",
             (SELECT count(*) FROM ref.catalog_item WHERE is_provisional)::text AS "временных"`);
    expect(rows[0]).toEqual({ справочников: '15', элементов: '149', временных: '149' });
  });

  it('повторное наполнение ничего не дублирует', async () => {
    await seed(db.url);
    const { rows } = await db.client.query<{ n: string }>('SELECT count(*)::text AS n FROM ref.catalog_item');
    expect(rows[0]?.n).toBe('149');
  });

  it('код справочника без дефиса — это часть программы', async () => {
    await expect(
      db.client.query("INSERT INTO ref.catalog (id, code, name) VALUES (gen_random_uuid(), 'INCIDENT-KIND', 'С дефисом')"),
    ).rejects.toThrow(/ck_catalog__code_shape/);
  });

  it('код элемента обязан содержать дефис — это данные', async () => {
    await expect(db.client.query(вставить('MEETING_KIND', 'БЕЗДЕФИСА'))).rejects.toThrow(
      /ck_catalog_item__code_shape/,
    );
  });

  it('код элемента, годный для программы, отвергается: на этом стоит проверка П-1', async () => {
    // 'SOV-99' допустим, 'SOV_99' — нет: подчёркивание отдано кодам справочников.
    await expect(db.client.query(вставить('MEETING_KIND', 'SOV_99'))).rejects.toThrow(/code_shape/);
    await db.client.query(вставить('MEETING_KIND', 'SOV-99'));
    await db.client.query("DELETE FROM ref.catalog_item WHERE code = 'SOV-99'");
  });

  it('уровень важности выбирается из палитры, произвольный цвет не принимается', async () => {
    await expect(db.client.query(`
      INSERT INTO ref.catalog_item (id, catalog_id, code, name, color_token)
      SELECT gen_random_uuid(), c.id, 'PRT-99', 'Образец', '#ff0000'
      FROM ref.catalog c WHERE c.code = 'TASK_PRIORITY'`),
    ).rejects.toThrow(/ck_catalog_item__color_token/);

    // Токен из палитры принимается.
    await db.client.query(`
      INSERT INTO ref.catalog_item (id, catalog_id, code, name, color_token)
      SELECT gen_random_uuid(), c.id, 'PRT-99', 'Образец', 'sev-3'
      FROM ref.catalog c WHERE c.code = 'TASK_PRIORITY'`);
    await db.client.query("DELETE FROM ref.catalog_item WHERE code = 'PRT-99'");
  });

  it('вложение в неиерархический справочник отвергается', async () => {
    await expect(db.client.query(`
      INSERT INTO ref.catalog_item (id, catalog_id, code, name, parent_id)
      SELECT gen_random_uuid(), c.id, 'SOV-98', 'Образец', (SELECT id FROM ref.catalog_item i WHERE i.code = 'SOV-01')
      FROM ref.catalog c WHERE c.code = 'MEETING_KIND'`),
    ).rejects.toThrow(/не является иерархическим/);
  });

  it('родитель обязан принадлежать тому же справочнику', async () => {
    await expect(db.client.query(`
      INSERT INTO ref.catalog_item (id, catalog_id, code, name, parent_id)
      SELECT gen_random_uuid(), c.id, 'PRI-98', 'Образец', (SELECT id FROM ref.catalog_item i WHERE i.code = 'PRC-00')
      FROM ref.catalog c WHERE c.code = 'INCIDENT_KIND'`),
    ).rejects.toThrow(/fk_catalog_item__parent_same_catalog/);
  });

  it('иерархия видов событий загружена: у каждого вида есть корневая группа', async () => {
    const { rows } = await db.client.query<{ code: string; parent: string }>(`
      SELECT i.code, p.code AS parent FROM ref.catalog_item i
      JOIN ref.catalog c ON c.id = i.catalog_id AND c.code = 'INCIDENT_KIND'
      LEFT JOIN ref.catalog_item p ON p.id = i.parent_id
      WHERE i.code IN ('PRI-01','TEH-08','BIO-01','INY-03','PRI-00') ORDER BY i.code`);
    expect(rows).toEqual([
      { code: 'BIO-01', parent: 'BIO-00' }, { code: 'INY-03', parent: 'INY-00' },
      { code: 'PRI-00', parent: null }, { code: 'PRI-01', parent: 'PRI-00' },
      { code: 'TEH-08', parent: 'TEH-00' },
    ]);
  });

  it('признаки элементов читаются как объявлено: ветвление идёт по ним, а не по коду', async () => {
    const { rows } = await db.client.query<{ code: string; чс: boolean }>(`
      SELECT code, (attributes->>'isEmergency')::boolean AS "чс" FROM ref.catalog_item
      WHERE code IN ('PRI-01','TEH-01','TEH-04') ORDER BY code`);
    expect(rows).toEqual([
      { code: 'PRI-01', чс: true },   // землетрясение — всегда ЧС
      { code: 'TEH-01', чс: false },  // пожар — по последствиям, решает дежурный
      { code: 'TEH-04', чс: false },
    ]);
  });

  it('наименования сортируются с таджикскими буквами', async () => {
    const { rows } = await db.client.query<{ name: string }>(`
      SELECT name FROM ref.catalog_item WHERE code IN ('VED-01','VED-02') ORDER BY name`);
    expect(rows.length).toBe(2);
  });

  it('поиск элемента по подстроке нечувствителен к таджикским буквам', async () => {
    const { rows } = await db.client.query<{ code: string }>(
      `SELECT code FROM ref.catalog_item WHERE name_norm LIKE '%' || public.tj_norm($1) || '%'`,
      ['ЧРЕЗВЫЧАЙНЫМ'],
    );
    expect(rows.map((r) => r.code)).toContain('VED-01');
  });
});
