import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { endpointByName, routePath, parseRequest, parsePageParams, DEFAULT_PAGE_SIZE } from './routing.ts';
import { isAppError } from '@coes/core/errors.ts';

const LOCAL = { DEPLOY_PROFILE: 'local' } as NodeJS.ProcessEnv;
process.env['DEPLOY_PROFILE'] = 'local';

/** Работа с перечнем методов — docs/09-API.md § 9, § 3.1. */
describe('перечень методов', () => {
  it('находит метод по имени и строит путь с основанием', () => {
    expect(routePath(endpointByName('getSession'))).toBe('/api/v1/auth/session');
  });

  // Метода вне перечня не существует (§ 10, п. 8).
  it('имя вне перечня — ошибка сборки, а не пустой результат', () => {
    expect(() => endpointByName('deleteEverything')).toThrow('нет в перечне');
  });

  it('параметры пути переводятся в вид Fastify', () => {
    expect(routePath({
      name: 'x', method: 'GET', path: '/accounts/{id}/sessions',
      summary: '', response: z.object({}), permission: null,
    })).toBe('/api/v1/accounts/:id/sessions');
  });
});

describe('проверка запроса', () => {
  const schema = z.object({ login: z.string().min(1), age: z.number().int() });

  it('пропускает годное тело', () => {
    expect(parseRequest(schema, { login: 'a', age: 1 })).toEqual({ login: 'a', age: 1 });
  });

  // Пользователю нужно знать, какое поле неверно (§ 2).
  it('отказ несёт перечень полей с путями', () => {
    try {
      parseRequest(schema, { login: '', age: 'нет' });
      expect.unreachable('проверка обязана отказать');
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (!isAppError(error)) return;
      expect(error.code).toBe('VALIDATION_FAILED');
      const fields = (error.details as { fields: { path: string }[] }).fields;
      expect(fields.map((field) => field.path).sort()).toEqual(['age', 'login']);
    }
  });
});

describe('постраничный вывод', () => {
  it('умолчание — пятьдесят записей', () => {
    expect(parsePageParams({})).toEqual({ limit: DEFAULT_PAGE_SIZE, cursor: undefined });
  });

  it('курсор передаётся как есть: клиент его не разбирает', () => {
    expect(parsePageParams({ limit: 10, cursor: 'eyJvIjoi' }).cursor).toBe('eyJvIjoi');
  });

  it('нецелое и неположительное значение отклоняется', () => {
    expect(() => parsePageParams({ limit: 0 })).toThrow();
    expect(() => parsePageParams({ limit: 1.5 })).toThrow();
    expect(() => parsePageParams({ limit: 'много' })).toThrow();
  });

  /**
   * Урезав молча, система выдала бы не то, о чём спросили, и никто не
   * узнал бы об этом (§ 3.1).
   */
  it('значение больше предела — отказ с ключом предела, а не урезание', () => {
    try {
      parsePageParams({ limit: 500 });
      expect.unreachable('предел обязан отказать');
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (!isAppError(error)) return;
      expect(error.code).toBe('LIMIT_REACHED');
      expect(error.details['limit']).toBe('LIMIT_LIST_PAGE_SIZE');
      expect(error.details['current']).toBe(500);
      expect(error.details['max']).toBe(200);
    }
  });

  it('переопределённый настройкой предел действует', () => {
    expect(parsePageParams({ limit: 300 }, { LIMIT_LIST_PAGE_SIZE: '400' }).limit).toBe(300);
    expect(() => parsePageParams({ limit: 300 }, { LIMIT_LIST_PAGE_SIZE: '100' })).toThrow();
  });

  it('профиль пределов задан окружением проверки', () => {
    expect(LOCAL['DEPLOY_PROFILE']).toBe('local');
  });
});
