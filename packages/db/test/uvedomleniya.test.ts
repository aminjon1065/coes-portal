import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTempDatabase, type TempDatabase } from './vremennaya-baza.ts';

/**
 * Уведомления (docs/03-АРХИТЕКТУРА.md § 5.7).
 * Проверяется главное: ссылка хранится относительной — иначе переезд на
 * домен Комитета потребовал бы правки данных (принцип П-5).
 */
describe('уведомления', () => {
  let db: TempDatabase;
  let человек = '';

  beforeAll(async () => {
    db = await createTempDatabase('notify');
    const { rows } = await db.client.query<{ id: string }>(
      `INSERT INTO org.person (id, last_name, first_name)
       VALUES (gen_random_uuid(), 'Гулов', 'Фаррух') RETURNING id`,
    );
    человек = String(rows[0]?.id);
  }, 60_000);
  afterAll(async () => { await db.drop(); });

  const уведомление = (path: string | null, requiresAck = false): Promise<{ rows: { id: string }[] }> =>
    db.client.query<{ id: string }>(
      `INSERT INTO notify.notification (id, kind, title, entity_path, requires_ack)
       VALUES (gen_random_uuid(), 'org.assignment.created', 'Вы назначены на должность', $1, $2) RETURNING id`,
      [path, requiresAck],
    );

  it('относительный путь принимается', async () => {
    const { rows } = await уведомление('/persons/0193b3c0-1111-7000-8000-000000000001');
    expect(rows[0]?.id).toBeTruthy();
  });

  it('абсолютный адрес не принимается: он сделал бы переезд невозможным', async () => {
    await expect(уведомление('https://cmc.techdev.tj/persons/1')).rejects.toThrow(
      /ck_notification__entity_path_relative/,
    );
    await expect(уведомление('http://localhost:8080/persons/1')).rejects.toThrow(
      /ck_notification__entity_path_relative/,
    );
    // Двойная косая черта — начало адреса без схемы, тоже не путь.
    await expect(уведомление('//cmc.techdev.tj/persons/1')).rejects.toThrow(
      /ck_notification__entity_path_relative/,
    );
  });

  it('уведомление без ссылки на объект допустимо', async () => {
    const { rows } = await уведомление(null);
    expect(rows[0]?.id).toBeTruthy();
  });

  it('канал доставки один: почты нет ни в каком виде', async () => {
    const { rows } = await db.client.query<{ значения: string[] }>(
      `SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)::text[] AS "значения"
       FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'channel_enum'`,
    );
    expect(rows[0]?.значения).toEqual(['in_app']);
  });

  it('подтвердить можно только доставленное уведомление, требующее подтверждения', async () => {
    const { rows: n } = await уведомление('/persons/x', true);
    const { rows: d } = await db.client.query<{ id: string }>(
      `INSERT INTO notify.delivery (id, notification_id, person_id) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
      [n[0]?.id, человек],
    );
    const доставка = String(d[0]?.id);

    // Ещё не доставлено.
    await expect(db.client.query(
      'INSERT INTO notify.acknowledgement (id, delivery_id) VALUES (gen_random_uuid(), $1)', [доставка],
    )).rejects.toThrow(/не доставлено/);

    await db.client.query('UPDATE notify.delivery SET delivered_at = now() WHERE id = $1', [доставка]);
    await db.client.query(
      'INSERT INTO notify.acknowledgement (id, delivery_id) VALUES (gen_random_uuid(), $1)', [доставка],
    );

    const { rows } = await db.client.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM notify.acknowledgement WHERE delivery_id = $1', [доставка],
    );
    expect(rows[0]?.n).toBe('1');
  });

  it('уведомление, не требующее подтверждения, подтвердить нельзя', async () => {
    const { rows: n } = await уведомление('/persons/y', false);
    const { rows: d } = await db.client.query<{ id: string }>(
      `INSERT INTO notify.delivery (id, notification_id, person_id, delivered_at)
       VALUES (gen_random_uuid(), $1, $2, now()) RETURNING id`, [n[0]?.id, человек],
    );
    await expect(db.client.query(
      'INSERT INTO notify.acknowledgement (id, delivery_id) VALUES (gen_random_uuid(), $1)', [d[0]?.id],
    )).rejects.toThrow(/не требует подтверждения/);
  });

  it('одному человеку уведомление доставляется один раз', async () => {
    const { rows: n } = await уведомление('/persons/z');
    const доставить = (): Promise<unknown> => db.client.query(
      'INSERT INTO notify.delivery (id, notification_id, person_id) VALUES (gen_random_uuid(), $1, $2)',
      [n[0]?.id, человек],
    );
    await доставить();
    await expect(доставить()).rejects.toThrow(/ux_delivery__once/);
  });
});
