import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prepare, makePerson, signIn, asUser, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-11. Предел выдаёт понятный отказ — docs/10-ЭТАПЫ.md § 2.
 *
 * Проверяется ПОВЕДЕНИЕ предела, а не число: локально и на сервере числа
 * разные, и сценарий, написанный через число, проходил бы только в одной
 * среде (docs/03-АРХИТЕКТУРА.md § 6).
 */
describe('ПС-0-11. Предел выдаёт понятный отказ', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps011'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  it('третий вход удаётся, самая старая сессия закрывается с указанием причины', async () => {
    await env.app.inject({
      method: 'PUT', url: '/api/v1/settings',
      headers: { 'x-csrf-token': env.csrf }, cookies: asUser(env, env.adminSession),
      payload: { items: [{ key: 'LIMIT_SESSION_PER_ACCOUNT', value: '2' }] },
    });

    const officer = await makePerson(env, {
      lastName: 'Раҳимов', orgUnitCode: 'SUG', positionName: 'Оперативный дежурный',
      roleCode: 'DUTY_OFFICER', login: 'rahimov',
    });

    const first = await signIn(env, officer);
    const second = await signIn(env, officer);
    const third = await signIn(env, officer);
    expect(third.length, 'третий вход удаётся: предел закрывает старое, а не отказывает').toBeGreaterThan(0);

    const alive = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, third),
    });
    expect(alive.statusCode).toBe(200);

    const oldest = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, first),
    });
    expect(oldest.statusCode, 'самая старая сессия закрыта').toBe(401);

    const stillAlive = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, second),
    });
    expect(stillAlive.statusCode, 'вторая сессия остаётся: закрывается только старейшая').toBe(200);

    // Пользователь закрытой сессии получает понятную причину, а не пустой
    // отказ: текст берётся из реестра пределов с подставленным числом.
    const { rows } = await env.db.client.query<{ close_reason: string | null }>(
      'SELECT close_reason FROM iam.session WHERE id = $1', [first],
    );
    expect(rows[0]?.close_reason).toBe('Открыто 2 сессий — это предел. Самая старая сессия закрыта.');
  }, 120_000);

  it('запрос страницы больше предела отказывает с ключом предела и числами', async () => {
    await env.app.inject({
      method: 'PUT', url: '/api/v1/settings',
      headers: { 'x-csrf-token': env.csrf }, cookies: asUser(env, env.adminSession),
      payload: { items: [{ key: 'LIMIT_LIST_PAGE_SIZE', value: '10' }] },
    });

    const answer = await env.app.inject({
      method: 'GET', url: '/api/v1/org-units?limit=50', cookies: asUser(env, env.adminSession),
    });
    expect(answer.statusCode).toBe(409);
    const failure = answer.json<{
      error: { code: string; message: string; details: { limit: string; current: number; max: number } };
    }>().error;
    expect(failure.code).toBe('LIMIT_REACHED');
    expect(failure.details.limit).toBe('LIMIT_LIST_PAGE_SIZE');
    expect(failure.details.current).toBe(50);
    expect(failure.details.max).toBe(10);
    // Число в тексте — действующее, а не зашитое: иначе локальный отказ
    // сообщал бы продуктовое значение (§ 6).
    expect(failure.message).toBe('За один раз выдаётся не более 10 записей. Запросите меньше.');
  }, 120_000);
});
