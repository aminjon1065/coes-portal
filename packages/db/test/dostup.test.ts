import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';
import { seed } from '../seed.ts';
import { PERMISSIONS } from '../../contracts/permissions.ts';

/**
 * Модель доступа (docs/05-ДОСТУП.md). Ошибка здесь не видна на экране и
 * обнаруживается только последствиями, поэтому формула области видимости
 * проверяется целиком, включая запрет транзитивности замещений.
 */
describe('доступ', () => {
  let db: TempDatabase;
  const назначения: Record<string, string> = {};

  const создатьНазначение = async (кто: string, подразделение: string): Promise<string> => {
    const { rows } = await db.client.query<{ id: string }>(
      `WITH p AS (
         INSERT INTO org.person (id, last_name, first_name) VALUES (gen_random_uuid(), $1, 'Имя') RETURNING id
       ), d AS (
         INSERT INTO org.position (id, org_unit_id, name)
         SELECT gen_random_uuid(), u.id, 'Должность ' || $1 FROM org.org_unit u WHERE u.code = $2 RETURNING id
       )
       INSERT INTO org.assignment (id, person_id, position_id, started_on, is_primary)
       -- Начало в прошлом: назначение, начатое сегодня, нельзя прекратить вчера,
       -- а именно это и требуется проверить.
       SELECT gen_random_uuid(), p.id, d.id, current_date - 30, true FROM p, d RETURNING id`,
      [кто, подразделение],
    );
    return String(rows[0]?.id);
  };

  const замещение = (кого: string, кто: string, дней = 14): Promise<unknown> =>
    db.client.query(
      `INSERT INTO org.delegation (id, delegator_assignment_id, delegate_assignment_id, started_on, ended_on, order_number)
       VALUES (gen_random_uuid(), $1, $2, current_date, current_date + ($3::integer), 'ПР-1')`,
      [назначения[кого], назначения[кто], дней],
    );

  const область = async (кто: string): Promise<string[]> => {
    const { rows } = await db.client.query<{ code: string }>(
      `SELECT u.code FROM access.visible_units($1) v JOIN org.org_unit u ON u.id = v.org_unit_id ORDER BY u.code`,
      [назначения[кто]],
    );
    return rows.map((r) => r.code);
  };

  beforeAll(async () => {
    db = await createTempDatabase('dostup');
    await seed(db.url);
    // Район внутри Согдийской области — чтобы поддерево было не пустым.
    await db.client.query(
      `INSERT INTO org.org_unit (id, code, name, parent_id, path)
       SELECT gen_random_uuid(), 'SUGR1', 'Районный отдел', id, 'x'::ltree FROM org.org_unit WHERE code = 'SUG'`,
    );
    назначения['А'] = await создатьНазначение('Алиев', 'CA');
    назначения['Б'] = await создатьНазначение('Бобоев', 'SUG');
    назначения['В'] = await создатьНазначение('Валиев', 'KHA');
    назначения['Г'] = await создатьНазначение('Гулов', 'SUGR1');
  }, 90_000);
  afterAll(async () => { await db.drop(); });

  it('перечень разрешений в базе совпадает с перечнем-кодом', async () => {
    const { rows } = await db.client.query<{ code: string; name: string }>(
      'SELECT code, name FROM access.permission ORDER BY code',
    );
    const ожидается = [...PERMISSIONS].map((p) => ({ code: p.code, name: p.name }))
      .sort((a, b) => a.code.localeCompare(b.code));
    expect(rows).toEqual(ожидается);
  });

  it('роли загружены, системные не помечены как придуманные', async () => {
    const { rows } = await db.client.query<{ n: string; системных: string; придуманных: string }>(`
      SELECT count(*)::text AS n,
             count(*) FILTER (WHERE is_system)::text AS "системных",
             count(*) FILTER (WHERE is_provisional)::text AS "придуманных"
      FROM access.role`);
    expect(rows[0]).toEqual({ n: '11', системных: '3', придуманных: '8' });
  });

  it('администратор не читает рабочее содержимое: у него нет incident.card.read', async () => {
    const { rows } = await db.client.query<{ code: string }>(`
      SELECT r.code FROM access.role r JOIN access.role_permission rp ON rp.role_id = r.id
      WHERE rp.permission_code = 'incident.card.read' AND r.code IN ('SYS_ADMIN','REGION_ADMIN')`);
    expect(rows).toEqual([]);
  });

  it('область видимости — своё подразделение и всё поддерево под ним', async () => {
    expect(await область('Б')).toEqual(['SUG', 'SUGR1']);
    expect(await область('Г')).toEqual(['SUGR1']);
  });

  it('центральный аппарат видит всё — без отдельной ветви программы', async () => {
    expect(await область('А')).toEqual(['CA', 'DUS', 'GBA', 'KHA', 'RRP', 'SUG', 'SUGR1']);
  });

  it('право «все регионы» выдаётся точечно и открывает всё', async () => {
    await db.client.query(
      `INSERT INTO access.scope_grant (id, assignment_id, kind, reason)
       VALUES (gen_random_uuid(), $1, 'all_regions', 'Поручение руководства')`, [назначения['В']],
    );
    expect(await область('В')).toEqual(['CA', 'DUS', 'GBA', 'KHA', 'RRP', 'SUG', 'SUGR1']);
    await db.client.query('DELETE FROM access.scope_grant WHERE assignment_id = $1', [назначения['В']]);
    expect(await область('В')).toEqual(['KHA']);
  });

  it('право «все регионы» без основания не выдаётся', async () => {
    await expect(db.client.query(
      `INSERT INTO access.scope_grant (id, assignment_id, kind, reason)
       VALUES (gen_random_uuid(), $1, 'all_regions', '  ')`, [назначения['В']],
    )).rejects.toThrow(/ck_scope_grant__reason/);
  });

  it('дополнительная область добавляет чужое поддерево', async () => {
    await db.client.query(
      `INSERT INTO access.scope_grant (id, assignment_id, kind, org_unit_id, reason)
       SELECT gen_random_uuid(), $1, 'extra_subtree', u.id, 'Курирует область'
       FROM org.org_unit u WHERE u.code = 'SUG'`, [назначения['В']],
    );
    expect(await область('В')).toEqual(['KHA', 'SUG', 'SUGR1']);
    await db.client.query('DELETE FROM access.scope_grant WHERE assignment_id = $1', [назначения['В']]);
  });

  it('замещающий получает область замещаемого', async () => {
    await замещение('А', 'Б');
    expect(await область('Б')).toEqual(['CA', 'DUS', 'GBA', 'KHA', 'RRP', 'SUG', 'SUGR1']);
  });

  it('ТРАНЗИТИВНОСТЬ ЗАПРЕЩЕНА: замещающий замещающего прав не получает', async () => {
    // Б замещает А (центральный аппарат). В замещает Б.
    // В обязан получить область Б, вычисленную БЕЗ её собственных замещений,
    // то есть Согдийскую область — но не центральный аппарат (§ 5.2, п. 3).
    await замещение('Б', 'В');
    expect(await область('В')).toEqual(['KHA', 'SUG', 'SUGR1']);
    expect(await область('В')).not.toContain('CA');
    expect(await область('В')).not.toContain('DUS');
  });

  it('отозванное замещение прав не даёт немедленно', async () => {
    await db.client.query(
      `UPDATE org.delegation SET is_revoked = true, revoked_at = now()
       WHERE delegate_assignment_id = $1`, [назначения['Б']],
    );
    expect(await область('Б')).toEqual(['SUG', 'SUGR1']);
  });

  it('прекращение назначения замещаемого немедленно прекращает замещение', async () => {
    await db.client.query(
      `UPDATE org.delegation SET is_revoked = false, revoked_at = NULL WHERE delegate_assignment_id = $1`,
      [назначения['Б']],
    );
    expect(await область('Б')).toContain('CA');
    await db.client.query(
      'UPDATE org.assignment SET ended_on = current_date - 1 WHERE id = $1', [назначения['А']],
    );
    expect(await область('Б')).toEqual(['SUG', 'SUGR1']);
  });

  it('обращение к чужому содержимому нельзя утвердить самому себе', async () => {
    await expect(db.client.query(
      `INSERT INTO access.foreign_access
         (id, requester_person_id, requester_assignment_id, target_schema, target_table,
          purpose, basis, approved_by_person_id, approved_at, valid_until)
       SELECT gen_random_uuid(), a.person_id, a.id, 'doc', 'document',
              'Расследование', 'Поручение № 5', a.person_id, now(), now() + interval '72 hours'
       FROM org.assignment a WHERE a.id = $1`, [назначения['В']],
    )).rejects.toThrow(/ck_foreign_access__not_self/);
  });

  it('на человека заводится одна учётная запись', async () => {
    const создать = (login: string): Promise<unknown> => db.client.query(
      `INSERT INTO iam.account (id, person_id, login, password_hash)
       SELECT gen_random_uuid(), a.person_id, $2, 'hash' FROM org.assignment a WHERE a.id = $1`,
      [назначения['Г'], login],
    );
    await создать('gulov');
    await expect(создать('gulov2')).rejects.toThrow(/account_person_id_key|duplicate key/);
  });
});
