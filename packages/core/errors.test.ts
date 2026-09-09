import { describe, it, expect } from 'vitest';
import {
  AppError, HTTP_STATUS, isAppError, toAppError,
  validationFailed, unauthenticated, accessDeniedByScope, accessDeniedByPermission,
  notFound, conflict, preconditionFailed, limitReached, rateLimited,
} from './errors.ts';

/** § 5.3 и adr/26: отказ — типизированное исключение с готовым текстом. */
describe('отказы', () => {
  it('каждому коду соответствует состояние HTTP из таблицы § 5.3', () => {
    expect(HTTP_STATUS).toEqual({
      VALIDATION_FAILED: 400, UNAUTHENTICATED: 401, ACCESS_DENIED: 403,
      NOT_FOUND: 404, CONFLICT: 409, PRECONDITION_FAILED: 412,
      LIMIT_REACHED: 409, RATE_LIMITED: 429, INTERNAL: 500,
    });
  });

  it('знает своё состояние HTTP', () => {
    expect(new AppError('ACCESS_DENIED', 'нет доступа').status).toBe(403);
    expect(notFound().status).toBe(404);
  });

  it('опознаётся среди прочих исключений', () => {
    expect(isAppError(notFound())).toBe(true);
    expect(isAppError(new Error('обычная'))).toBe(false);
    expect(isAppError('строка')).toBe(false);
  });

  it('чужое исключение становится INTERNAL и не раскрывает подробностей', () => {
    const исходное = new Error('ошибка драйвера базы: relation "x" does not exist');
    const отказ = toAppError(исходное);
    expect(отказ.code).toBe('INTERNAL');
    expect(отказ.message).not.toContain('relation');
    expect(отказ.cause).toBe(исходное);
  });

  it('AppError через toAppError проходит без изменений', () => {
    const исходный = notFound();
    expect(toAppError(исходный)).toBe(исходный);
  });

  it('отказ по области видимости подтверждает существование объекта (adr/11)', () => {
    const отказ = accessDeniedByScope();
    expect(отказ.message).toContain('существует');
    expect(отказ.message).toContain('обратитесь к администратору');
  });

  it('отказ по разрешению называет действие и должность', () => {
    const отказ = accessDeniedByPermission('Закрыть событие', 'Специалист', 'incident.card.close');
    expect(отказ.message).toBe('Действие «Закрыть событие» недоступно для должности «Специалист».');
    expect(отказ.details['permission']).toBe('incident.card.close');
  });

  it('одновременное изменение сообщает текущую версию', () => {
    const отказ = preconditionFailed(7);
    expect(отказ.status).toBe(412);
    expect(отказ.details['currentVersion']).toBe(7);
  });

  it('предел называет свой ключ', () => {
    const отказ = limitReached('LIMIT_MEETING_PARTICIPANTS', 'В совещании уже 6 участников — это предел.', 6, 6);
    expect(отказ.details['limit']).toBe('LIMIT_MEETING_PARTICIPANTS');
    expect(отказ.status).toBe(409);
  });

  it('прочие отказы несут русский текст, говорящий что делать', () => {
    for (const отказ of [validationFailed('Проверьте поля.'), unauthenticated(), conflict('Номер занят.', 'duplicate'), rateLimited(15)]) {
      expect(отказ.message).toMatch(/[а-яА-Я]/);
      expect(отказ.message.trim().length).toBeGreaterThan(10);
    }
  });
});
