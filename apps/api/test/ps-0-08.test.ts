import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { findFirstBreak, type ChainLink } from '../../../tools/audit-verify/core.ts';
import { prepare, makePerson, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-08. Целостность журнала действий — docs/10-ЭТАПЫ.md § 2.
 *
 * Первая проверка — «нарушений не обнаружено»; после подмены записи от
 * имени владельца базы вторая указывает номер первой нарушенной связи.
 * Роль приложения изменить запись не может — это право в базе, а не
 * проверка в коде (docs/05-ДОСТУП.md § 9.3).
 */
describe('ПС-0-08. Целостность журнала действий', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps008'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  interface ChainRow {
    readonly id: string;
    readonly prev_hash: Buffer | null;
    readonly hash: Buffer;
    readonly expected_hash: Buffer;
  }

  /**
   * Ожидаемый хеш пересчитывает база той же функцией, которой его считает
   * триггер: пересчёт своей копией формулы проверял бы копию, а не журнал.
   */
  async function chain(): Promise<readonly ChainLink[]> {
    const { rows } = await env.db.client.query<ChainRow>(
      // ORDER BY e.id, а не ORDER BY id: после «id::text AS id» имя выхода
      // перекрывает столбец, и сортировка стала бы текстовой — «1, 10, 2».
      // Цепочка при этом выглядела бы разорванной, хотя цела.
      `SELECT id::text AS id, prev_hash, hash,
              digest(coalesce(prev_hash, ''::bytea) || audit.canonical(e)::bytea, 'sha256') AS expected_hash
         FROM audit.event e ORDER BY e.id`,
    );
    return rows.map((row) => ({
      id: row.id,
      prevHash: row.prev_hash === null ? null : row.prev_hash.toString('hex'),
      hash: row.hash.toString('hex'),
      expectedHash: row.expected_hash.toString('hex'),
    }));
  }

  it('первая проверка не находит нарушений, подмена записи обнаруживается', async () => {
    await makePerson(env, {
      lastName: 'Раҳимов', orgUnitCode: 'SUG', positionName: 'Оперативный дежурный',
      roleCode: 'DUTY_OFFICER', login: 'rahimov',
    });

    const before = await chain();
    expect(before.length).toBeGreaterThan(5);
    expect(findFirstBreak(before)).toBeNull();

    // 2) от имени владельца базы изменяется одна запись журнала.
    // Запрет держится в двух местах, и второе — триггер, закрывающий даже
    // владельца схемы. Поэтому подмена требует осознанного отключения
    // запрета: случайно испортить журнал нельзя.
    const target = before[Math.floor(before.length / 2)];
    expect(target).toBeDefined();
    let refusedWhileGuarded = false;
    try {
      await env.db.client.query(
        "UPDATE audit.event SET entity_label = 'подменено' WHERE id = $1",
        [String(target?.id)],
      );
    } catch {
      refusedWhileGuarded = true;
    }
    expect(refusedWhileGuarded, 'триггер закрывает изменение и владельцу схемы').toBe(true);

    await env.db.client.query('ALTER TABLE audit.event DISABLE TRIGGER forbid_change');
    await env.db.client.query(
      "UPDATE audit.event SET entity_label = 'подменено' WHERE id = $1",
      [String(target?.id)],
    );
    await env.db.client.query('ALTER TABLE audit.event ENABLE TRIGGER forbid_change');

    // Вторая проверка указывает номер ПЕРВОЙ нарушенной связи: дальше
    // искать бессмысленно, всё последующее нарушено по построению (adr/12).
    const after = findFirstBreak(await chain());
    expect(after).not.toBeNull();
    expect(after?.id).toBe(String(target?.id));
    expect(after?.reason).toBe('содержимое записи изменено');
  }, 120_000);

  it('роль приложения не может изменить или удалить запись — это право базы', async () => {
    const app = await env.db.client.query<{ ok: boolean }>('SELECT true AS ok');
    expect(app.rows[0]?.ok).toBe(true);

    for (const statement of [
      "UPDATE audit.event SET action = 'подмена'",
      'DELETE FROM audit.event',
    ]) {
      await env.db.client.query('BEGIN');
      await env.db.client.query('SET LOCAL ROLE coes_app');
      let refused = false;
      try {
        await env.db.client.query(statement);
      } catch {
        refused = true;
      }
      await env.db.client.query('ROLLBACK');
      expect(refused, `«${statement}» обязано быть отклонено правами базы`).toBe(true);
    }
  }, 120_000);
});
