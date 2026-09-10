import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTempDatabase, type TempDatabase } from '../../../packages/db/test/vremennaya-baza.ts';
import { buildApp, CSRF_COOKIE } from '../src/bootstrap.ts';

/**
 * Модуль sys — docs/09-API.md § 2, § 4.4; docs/03-АРХИТЕКТУРА.md § 3.
 * Проверяется наблюдаемое поведение метода, а не устройство модуля.
 */
describe('модуль sys', () => {
  let db: TempDatabase;
  let app: FastifyInstance;

  beforeAll(async () => {
    // Профиль пределов задаётся файлом сборки, а не пользователем (§ 6);
    // в проверке его задаёт сама проверка, иначе core остановит работу.
    process.env['DEPLOY_PROFILE'] = 'local';
    // Журнал приложения в выводе проверки только мешает читать отказы.
    process.env['LOG_LEVEL'] = 'silent';
    db = await createTempDatabase('sys');
    app = buildApp({ db: db.client, dataPath: '.' });
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await db.drop();
  });

  it('настройки возвращаются перечнем и упорядочены по ключу', async () => {
    const answer = await app.inject({ method: 'GET', url: '/api/v1/settings' });
    expect(answer.statusCode).toBe(200);
    const body = answer.json<{ items: { key: string; value: string }[] }>();
    expect(body.items.length).toBeGreaterThan(0);
    const keys = body.items.map((item) => item.key);
    expect([...keys].sort()).toEqual(keys);
  });

  it('состояние сервера сообщает профиль, базу, диск и последнюю миграцию', async () => {
    const answer = await app.inject({ method: 'GET', url: '/api/v1/system/status' });
    expect(answer.statusCode).toBe(200);
    const body = answer.json<{
      deployProfile: string; databaseOk: boolean;
      diskFreeBytes: number; diskTotalBytes: number; lastMigration: string | null;
    }>();
    expect(body.deployProfile).toBe('local');
    expect(body.databaseOk).toBe(true);
    expect(body.diskTotalBytes).toBeGreaterThan(0);
    expect(body.diskFreeBytes).toBeGreaterThan(0);
    expect(body.lastMigration).not.toBeNull();
  });

  // § 4.4: изменяющий запрос без совпадающего признака дальше не проходит.
  it('изменение без признака защиты от подделки отклоняется', async () => {
    const answer = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      payload: { items: [{ key: 'BASE_URL', value: 'http://localhost:8080' }] },
    });
    expect(answer.statusCode).toBe(401);
    expect(answer.json<{ error: { code: string } }>().error.code).toBe('UNAUTHENTICATED');
  });

  it('изменение с совпадающим признаком проходит', async () => {
    const token = 'proverka-podlinnosti';
    const answer = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { 'x-csrf-token': token },
      cookies: { [CSRF_COOKIE]: token },
      payload: { items: [{ key: 'SESSION_IDLE_MIN', value: '45' }] },
    });
    expect(answer.statusCode).toBe(200);
    const saved = answer.json<{ items: { key: string; value: string }[] }>().items
      .find((item) => item.key === 'SESSION_IDLE_MIN');
    expect(saved?.value).toBe('45');
  });

  /**
   * Неизвестный ключ — опечатка. Принятая опечатка означает, что настройка
   * не действует и никто об этом не знает (§ 3.2).
   */
  it('неизвестная настройка отклоняется с указанием поля', async () => {
    const token = 'proverka-podlinnosti';
    const answer = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { 'x-csrf-token': token },
      cookies: { [CSRF_COOKIE]: token },
      payload: { items: [{ key: 'SESSION_IDLE_MINUTES', value: '45' }] },
    });
    expect(answer.statusCode).toBe(400);
    const body = answer.json<{ error: { code: string; details: { fields: { path: string }[] } } }>();
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.fields[0]?.path).toBe('SESSION_IDLE_MINUTES');
  });

  it('тело, не прошедшее схему, отклоняется с перечнем полей', async () => {
    const token = 'proverka-podlinnosti';
    const answer = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { 'x-csrf-token': token },
      cookies: { [CSRF_COOKIE]: token },
      payload: { items: [] },
    });
    expect(answer.statusCode).toBe(400);
    expect(answer.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_FAILED');
  });

  /** § 10, п. 5: ответ об отказе не содержит стека, имён таблиц и SQL. */
  it('ответ о ненайденном методе содержит только вид отказа и номер запроса', async () => {
    const answer = await app.inject({ method: 'GET', url: '/api/v1/nothing' });
    expect(answer.statusCode).toBe(404);
    const body = answer.json<{ error: Record<string, unknown> }>();
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message', 'requestId']);
    expect(String(body.error['requestId']).length).toBeGreaterThan(0);
  });
});
