import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prepare, makePerson, signIn, asUser, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-04. Отказ в доступе вместо пустого экрана — docs/10-ЭТАПЫ.md § 2.
 *
 * Пустой список означал бы «объекта нет», и пользователь искал бы его
 * дальше. Поэтому по прямой ссылке — отказ с объяснением, а в реестре
 * объект не показывается и не считается (adr/11, § 7).
 */
describe('ПС-0-04. Отказ в доступе вместо пустого экрана', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps004'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  it('прямая ссылка на чужой объект даёт 403 с объяснением и без кнопки «Повторить»', async () => {
    const officer = await makePerson(env, {
      lastName: 'Раҳимов', orgUnitCode: 'SUG', positionName: 'Оперативный дежурный',
      roleCode: 'DUTY_OFFICER', login: 'rahimov',
    });
    const session = await signIn(env, officer);

    const foreign = String(env.units['KHA']);
    const answer = await env.app.inject({
      method: 'GET', url: `/api/v1/org-units/${foreign}`, cookies: asUser(env, session),
    });

    expect(answer.statusCode).toBe(403);
    const failure = answer.json<{ error: { code: string; message: string; details: unknown } }>().error;
    expect(failure.code).toBe('ACCESS_DENIED');
    expect(failure.message).toBe(
      'Этот объект существует, но не входит в вашу область видимости. Если доступ необходим для работы, обратитесь к администратору региона.',
    );
    // Отказ по области видимости не называет разрешения: его и нет (§ 2 API).
    expect(failure.details).toEqual({});
  }, 120_000);

  it('в реестре чужой объект не показывается и не считается', async () => {
    const officer = await makePerson(env, {
      lastName: 'Ғафуров', orgUnitCode: 'SUG', positionName: 'Специалист',
      roleCode: 'SPECIALIST', login: 'gafurov',
    });
    const session = await signIn(env, officer);

    const registry = await env.app.inject({
      method: 'GET', url: '/api/v1/org-units', cookies: asUser(env, session),
    });
    expect(registry.statusCode, registry.body).toBe(200);
    const body = registry.json<{ items: { id: string; code: string }[]; total: number }>();
    expect(body.items.map((item) => item.code)).not.toContain('KHA');
    // Не только не показывается, но и не считается: число совпадает с
    // показанным, иначе пользователь искал бы недостающие строки.
    expect(body.total).toBe(body.items.length);
  }, 120_000);

  it('своё подразделение по прямой ссылке открывается', async () => {
    const officer = await makePerson(env, {
      lastName: 'Ҷумъаев', orgUnitCode: 'SUG', positionName: 'Аналитик',
      roleCode: 'ANALYST', login: 'jumaev',
    });
    const session = await signIn(env, officer);
    const answer = await env.app.inject({
      method: 'GET', url: `/api/v1/org-units/${String(env.units['SUG'])}`,
      cookies: asUser(env, session),
    });
    expect(answer.statusCode, answer.body).toBe(200);
    expect(answer.json<{ code: string }>().code).toBe('SUG');
  }, 120_000);
});
