import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { listEvents } from '../src/modules/audit/public.ts';
import { prepare, makePerson, signIn, asUser, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-12. Блокировка немедленно прекращает работу — docs/10-ЭТАПЫ.md § 2.
 * Блокировка закрывает все сессии учётной записи, а не только будущие
 * входы (docs/05-ДОСТУП.md § 10.3).
 */
describe('ПС-0-12. Блокировка немедленно прекращает работу', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps012'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  it('действие в открытом окне отклоняется, все сессии закрыты', async () => {
    const officer = await makePerson(env, {
      lastName: 'Раҳимов', orgUnitCode: 'SUG', positionName: 'Оперативный дежурный',
      roleCode: 'DUTY_OFFICER', login: 'rahimov',
    });

    // 1) пользователь работает в открытом окне
    const session = await signIn(env, officer);
    const working = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, session),
    });
    expect(working.statusCode).toBe(200);

    const account = await env.db.client.query<{ id: string }>(
      "SELECT id::text AS id FROM iam.account WHERE login = 'rahimov'",
    );
    const accountId = String(account.rows[0]?.id);

    // 2) администратор блокирует учётную запись
    const blocked = await env.app.inject({
      method: 'POST', url: `/api/v1/accounts/${accountId}/block`,
      headers: { 'x-csrf-token': env.csrf }, cookies: asUser(env, env.adminSession),
      payload: { reason: 'Перевод в другое подразделение' },
    });
    expect(blocked.statusCode, blocked.body).toBe(200);
    expect(blocked.json<{ closedSessions: number }>().closedSessions).toBeGreaterThan(0);

    // 3) пользователь выполняет любое действие
    const after = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, session),
    });
    expect(after.statusCode, 'сессия недействительна сразу, а не после истечения').toBe(401);
    expect(after.json<{ error: { code: string; message: string } }>().error.message)
      .toContain('Войдите заново');

    // Причина названа: пользователь возвращён на вход с указанием причины.
    const { rows } = await env.db.client.query<{ close_reason: string | null }>(
      'SELECT close_reason FROM iam.session WHERE account_id = $1', [accountId],
    );
    expect(rows.every((row) => row.close_reason !== null)).toBe(true);

    // Повторный вход тоже отклоняется, и текст объясняет, что делать.
    const relogin = await env.app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': env.csrf }, cookies: { 'X-CSRF-Token': env.csrf },
      payload: { login: officer.login, password: officer.password },
    });
    expect(relogin.statusCode).toBe(403);
    expect(relogin.json<{ error: { message: string } }>().error.message)
      .toContain('Обратитесь к администратору');

    // Блокировка журналируется (§ 9.1).
    const events = await listEvents(env.db.client, { limit: 100 });
    expect(events.some((event) => event.action === 'account.block')).toBe(true);

    // Снятие блокировки возвращает возможность входа.
    const unblocked = await env.app.inject({
      method: 'POST', url: `/api/v1/accounts/${accountId}/unblock`,
      headers: { 'x-csrf-token': env.csrf }, cookies: asUser(env, env.adminSession),
    });
    expect(unblocked.statusCode, unblocked.body).toBe(200);
    const again = await signIn(env, officer);
    expect(again.length).toBeGreaterThan(0);
  }, 120_000);
});
