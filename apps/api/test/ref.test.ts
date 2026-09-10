import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CATALOG_ATTRIBUTES, attributesSchemaFor } from '@coes/contracts';
import { prepare, asUser, type Environment } from './scenario-osnovanie.ts';

/**
 * Справочники через API — docs/09-API.md § 8, docs/04-ДАННЫЕ.md § 5.
 *
 * Проверяется не «метод отвечает 200», а то, ради чего механизм существует:
 * схема признаков в базе совпадает с перечнем в коде (§ 5.2), число
 * временных элементов видно (Э-030), опечатка в условии отбора получает
 * отказ, а не чужие данные (§ 3.2), и страница не теряет строк (§ 3.1).
 */
describe('справочники', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ref'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  const get = async (url: string): Promise<{ status: number; body: Record<string, unknown> }> => {
    const answer = await env.app.inject({
      method: 'GET', url: `/api/v1${url}`, cookies: asUser(env, env.adminSession),
    });
    return { status: answer.statusCode, body: JSON.parse(answer.body) as Record<string, unknown> };
  };

  it('перечень справочников показывает число элементов и число временных', async () => {
    const { status, body } = await get('/catalogs');
    expect(status).toBe(200);
    const items = body['items'] as { code: string; itemCount: number; provisionalCount: number }[];
    expect(items).toHaveLength(15);

    const kinds = items.find((item) => item.code === 'INCIDENT_KIND');
    expect(kinds?.itemCount).toBeGreaterThan(0);
    // Всё начальное наполнение помечено «придумано нами» (Д-01): при
    // внедрении обязано быть видно, что подлежит замене в первую очередь.
    expect(kinds?.provisionalCount).toBe(kinds?.itemCount);
  });

  it('схема признаков в базе совпадает с перечнем в коде — проверка § 5.2', async () => {
    const { body } = await get('/catalogs');
    const items = body['items'] as { code: string; attributeSchema: string[] }[];
    for (const catalog of items) {
      const declared = (CATALOG_ATTRIBUTES[catalog.code] ?? []).map((attribute) => attribute.name);
      expect([...catalog.attributeSchema].sort(), `справочник «${catalog.code}»`)
        .toEqual([...declared].sort());
    }
  });

  it('значения признаков элементов не выходят за объявленное', async () => {
    const { body } = await get('/catalogs');
    const catalogs = (body['items'] as { code: string }[]).map((item) => item.code);
    for (const code of catalogs) {
      const page = await get(`/catalogs/${code}/items?limit=200`);
      const items = page.body['items'] as { code: string; attributes: unknown }[];
      const schema = attributesSchemaFor(code);
      for (const item of items) {
        const checked = schema.safeParse(item.attributes);
        expect(checked.success, `${code} / ${item.code}: ${JSON.stringify(item.attributes)}`).toBe(true);
      }
    }
  });

  it('элементы выдаются в порядке, заданном администратором, а не по алфавиту', async () => {
    const { body } = await get('/catalogs/INCIDENT_SCALE/items');
    const items = body['items'] as { code: string; sortOrder: number; colorToken: string | null }[];
    expect(items.map((item) => item.code)).toEqual(['MSH-01', 'MSH-02', 'MSH-03', 'MSH-04', 'MSH-05']);
    expect(items.map((item) => item.colorToken)).toEqual(['sev-1', 'sev-2', 'sev-3', 'sev-4', 'sev-5']);
  });

  it('справочник по коду отдаётся целиком, а несуществующий получает отказ с названным кодом', async () => {
    const found = await get('/catalogs/DAMAGE_TYPE');
    expect(found.status).toBe(200);
    expect(found.body['name']).toBe('Виды ущерба');

    const missing = await get('/catalogs/NET_TAKOGO');
    expect(missing.status).toBe(404);
    const error = missing.body['error'] as { code: string; message: string };
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('NET_TAKOGO');
  });

  it('страница не теряет и не повторяет строк при переходе по курсору', async () => {
    const first = await get('/catalogs/INCIDENT_KIND/items?limit=10');
    const firstItems = first.body['items'] as { id: string; code: string }[];
    expect(firstItems).toHaveLength(10);
    const cursor = first.body['nextCursor'];
    expect(typeof cursor).toBe('string');

    const second = await get(`/catalogs/INCIDENT_KIND/items?limit=10&cursor=${String(cursor)}`);
    const secondItems = second.body['items'] as { id: string; code: string }[];
    expect(secondItems.length).toBeGreaterThan(0);

    const overlap = firstItems.filter((item) => secondItems.some((other) => other.id === item.id));
    expect(overlap).toEqual([]);
    expect(first.body['total']).toBe(second.body['total']);
    expect(first.body['totalIsExact']).toBe(true);
  });

  it('испорченный курсор — отказ, а не пустой список: пустой означал бы «данных нет»', async () => {
    const { status, body } = await get('/catalogs/INCIDENT_KIND/items?cursor=ne-kursor');
    expect(status).toBe(400);
    expect((body['error'] as { code: string }).code).toBe('VALIDATION_FAILED');
  });

  it('опечатка в условии сортировки получает отказ, а не чужой порядок', async () => {
    const { status, body } = await get('/catalogs/INCIDENT_KIND/items?sort=nazvanie:asc');
    expect(status).toBe(400);
    const error = body['error'] as { code: string; message: string };
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toContain('sortOrder');
  });

  it('условие onlyActive принимает только true и false', async () => {
    const good = await get('/catalogs/AGENCY/items?onlyActive=true');
    expect(good.status).toBe(200);

    const bad = await get('/catalogs/AGENCY/items?onlyActive=da');
    expect(bad.status).toBe(400);
    expect((bad.body['error'] as { code: string }).code).toBe('VALIDATION_FAILED');
  });

  it('размер страницы сверх предела отвергается с ключом предела', async () => {
    const { status, body } = await get('/catalogs/INCIDENT_KIND/items?limit=5000');
    // Предел из реестра — 409, а не 429: 429 отведён частоте обращений
    // (docs/03-АРХИТЕКТУРА.md § 5.3).
    expect(status).toBe(409);
    const error = body['error'] as { code: string; details: { limit: string } };
    expect(error.code).toBe('LIMIT_REACHED');
    expect(error.details.limit).toBe('LIMIT_LIST_PAGE_SIZE');
  });

  it('невошедший пользователь справочников не видит', async () => {
    const answer = await env.app.inject({ method: 'GET', url: '/api/v1/catalogs' });
    expect(answer.statusCode).toBe(401);
  });
});
