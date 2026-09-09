import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';
import { seed } from '../seed.ts';

/**
 * Оргструктура — основание области видимости (docs/05-ДОСТУП.md § 4.1):
 * «сотрудник видит данные своего подразделения и всех нижестоящих».
 * Поэтому путь в дереве поддерживает база, а не программа.
 */
describe('оргструктура', () => {
  let db: TempDatabase;
  beforeAll(async () => {
    db = await createTempDatabase('org');
    await seed(db.url);
  }, 90_000);
  afterAll(async () => { await db.drop(); });

  const создатьПодразделение = async (code: string, parentCode: string | null): Promise<string> => {
    const { rows } = await db.client.query<{ id: string }>(
      `INSERT INTO org.org_unit (id, code, name, parent_id, path)
       SELECT gen_random_uuid(), $1, $1, (SELECT id FROM org.org_unit WHERE code = $2), 'x'::ltree
       RETURNING id`,
      [code, parentCode],
    );
    return String(rows[0]?.id);
  };

  it('начальные подразделения и должности загружены', async () => {
    const { rows } = await db.client.query<{ подразделений: string; должностей: string }>(`
      SELECT (SELECT count(*) FROM org.org_unit)::text AS "подразделений",
             (SELECT count(*) FROM org.position)::text AS "должностей"`);
    expect(rows[0]).toEqual({ подразделений: '6', должностей: '45' });
  });

  it('в областном управлении нет должностей центрального аппарата', async () => {
    const { rows } = await db.client.query<{ n: string }>(`
      SELECT count(*)::text AS n FROM org.position p
      JOIN org.org_unit u ON u.id = p.org_unit_id
      WHERE u.code = 'SUG' AND p.name IN ('Председатель Комитета', 'Первый заместитель председателя')`);
    expect(rows[0]?.n).toBe('0');
  });

  it('путь считает база: подчинённое лежит внутри пути вышестоящего', async () => {
    const { rows } = await db.client.query<{ внутри: boolean }>(`
      SELECT (SELECT path FROM org.org_unit WHERE code = 'SUG')
             <@ (SELECT path FROM org.org_unit WHERE code = 'CA') AS "внутри"`);
    expect(rows[0]?.внутри).toBe(true);
  });

  it('глубина дерева не ограничена: пять уровней заводятся без возражений', async () => {
    await создатьПодразделение('L3', 'SUG');
    await создатьПодразделение('L4', 'L3');
    await создатьПодразделение('L5', 'L4');
    const { rows } = await db.client.query<{ n: number }>(
      "SELECT nlevel(path) AS n FROM org.org_unit WHERE code = 'L5'",
    );
    expect(rows[0]?.n).toBe(5);
  });

  it('перенос подразделения переписывает путь всего поддерева', async () => {
    await db.client.query(
      "UPDATE org.org_unit SET parent_id = (SELECT id FROM org.org_unit WHERE code = 'KHA') WHERE code = 'L3'",
    );
    const { rows } = await db.client.query<{ code: string; внутри: boolean }>(`
      SELECT code, path <@ (SELECT path FROM org.org_unit WHERE code = 'KHA') AS "внутри"
      FROM org.org_unit WHERE code IN ('L3','L4','L5') ORDER BY code`);
    expect(rows).toEqual([
      { code: 'L3', внутри: true }, { code: 'L4', внутри: true }, { code: 'L5', внутри: true },
    ]);
  });

  it('подчинить подразделение своему же подчинённому нельзя: цикл в дереве', async () => {
    await expect(
      db.client.query(
        "UPDATE org.org_unit SET parent_id = (SELECT id FROM org.org_unit WHERE code = 'L5') WHERE code = 'L3'",
      ),
    ).rejects.toThrow(/не может быть подчинено самому себе/);
  });

  it('область видимости считается путём: поддерево области — это её подразделения', async () => {
    const { rows } = await db.client.query<{ code: string }>(`
      SELECT code FROM org.org_unit
      WHERE path <@ (SELECT path FROM org.org_unit WHERE code = 'KHA') ORDER BY code`);
    expect(rows.map((r) => r.code)).toEqual(['KHA', 'L3', 'L4', 'L5']);
  });

  it('человек занимает две должности одновременно, но основная одна', async () => {
    const { rows: p } = await db.client.query<{ id: string }>(
      `INSERT INTO org.person (id, last_name, first_name, middle_name)
       VALUES (gen_random_uuid(), 'Раҳимов', 'Далер', 'Саидович') RETURNING id`,
    );
    const person = String(p[0]?.id);
    const назначить = (positionName: string, unit: string, primary: boolean): Promise<unknown> =>
      db.client.query(
        `INSERT INTO org.assignment (id, person_id, position_id, started_on, is_primary)
         SELECT gen_random_uuid(), $1, p.id, current_date, $2
         FROM org.position p JOIN org.org_unit u ON u.id = p.org_unit_id
         WHERE u.code = $3 AND p.name = $4`,
        [person, primary, unit, positionName],
      );

    await назначить('Оперативный дежурный', 'SUG', true);
    await назначить('Инспектор', 'KHA', false);          // вторая должность — допустима
    await expect(назначить('Специалист', 'DUS', true)).rejects.toThrow(/ux_assignment__one_primary/);

    const { rows } = await db.client.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM org.assignment WHERE person_id = $1', [person],
    );
    expect(rows[0]?.n).toBe('2');
  });

  it('замещение без номера приказа не оформляется', async () => {
    const { rows } = await db.client.query<{ id: string }>('SELECT id FROM org.assignment ORDER BY id LIMIT 2');
    const [a, b] = [String(rows[0]?.id), String(rows[1]?.id)];
    await expect(db.client.query(
      `INSERT INTO org.delegation (id, delegator_assignment_id, delegate_assignment_id, started_on, ended_on, order_number)
       VALUES (gen_random_uuid(), $1, $2, current_date, current_date + 14, '   ')`, [a, b],
    )).rejects.toThrow(/ck_delegation__order_number/);
  });

  it('замещение самого себя не оформляется', async () => {
    const { rows } = await db.client.query<{ id: string }>('SELECT id FROM org.assignment ORDER BY id LIMIT 1');
    const a = String(rows[0]?.id);
    await expect(db.client.query(
      `INSERT INTO org.delegation (id, delegator_assignment_id, delegate_assignment_id, started_on, ended_on, order_number)
       VALUES (gen_random_uuid(), $1, $1, current_date, current_date + 14, 'ПР-12')`, [a],
    )).rejects.toThrow(/ck_delegation__not_self/);
  });

  it('замещение с датой окончания раньше начала не оформляется', async () => {
    const { rows } = await db.client.query<{ id: string }>('SELECT id FROM org.assignment ORDER BY id LIMIT 2');
    const [a, b] = [String(rows[0]?.id), String(rows[1]?.id)];
    await expect(db.client.query(
      `INSERT INTO org.delegation (id, delegator_assignment_id, delegate_assignment_id, started_on, ended_on, order_number)
       VALUES (gen_random_uuid(), $1, $2, current_date, current_date - 1, 'ПР-12')`, [a, b],
    )).rejects.toThrow(/ck_delegation__dates/);
  });

  it('замещение приказом оформляется и находится по замещающему', async () => {
    const { rows } = await db.client.query<{ id: string }>('SELECT id FROM org.assignment ORDER BY id LIMIT 2');
    const [a, b] = [String(rows[0]?.id), String(rows[1]?.id)];
    await db.client.query(
      `INSERT INTO org.delegation (id, delegator_assignment_id, delegate_assignment_id, started_on, ended_on, order_number, reason)
       VALUES (gen_random_uuid(), $1, $2, current_date, current_date + 14, 'ПР-12', 'Отпуск')`, [a, b],
    );
    const { rows: найдено } = await db.client.query<{ order_number: string }>(
      `SELECT order_number FROM org.delegation
       WHERE delegate_assignment_id = $1 AND NOT is_revoked
         AND current_date BETWEEN started_on AND ended_on`, [b],
    );
    expect(найдено.map((r) => r.order_number)).toEqual(['ПР-12']);
  });

  it('поиск сотрудника нечувствителен к таджикским буквам', async () => {
    const { rows } = await db.client.query<{ last_name: string }>(
      `SELECT last_name FROM org.person WHERE full_name_norm LIKE '%' || public.tj_norm($1) || '%'`,
      ['Рахимов'],
    );
    expect(rows.map((r) => r.last_name)).toEqual(['Раҳимов']);
  });
});
