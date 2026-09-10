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
    const original = new Error('ошибка драйвера базы: relation "x" does not exist');
    const errorResponse = toAppError(original);
    expect(errorResponse.code).toBe('INTERNAL');
    expect(errorResponse.message).not.toContain('relation');
    expect(errorResponse.cause).toBe(original);
  });

  it('AppError через toAppError проходит без изменений', () => {
    const source = notFound();
    expect(toAppError(source)).toBe(source);
  });

  it('отказ по области видимости подтверждает существование объекта (adr/11)', () => {
    const errorResponse = accessDeniedByScope();
    expect(errorResponse.message).toContain('существует');
    expect(errorResponse.message).toContain('обратитесь к администратору');
  });

  it('отказ по разрешению называет действие и должность', () => {
    const errorResponse = accessDeniedByPermission('Закрыть событие', 'Специалист', 'incident.card.close');
    expect(errorResponse.message).toBe('Действие «Закрыть событие» недоступно для должности «Специалист».');
    expect(errorResponse.details['permission']).toBe('incident.card.close');
  });

  it('одновременное изменение сообщает текущую версию', () => {
    const errorResponse = preconditionFailed(7);
    expect(errorResponse.status).toBe(412);
    expect(errorResponse.details['currentVersion']).toBe(7);
  });

  it('предел называет свой ключ', () => {
    const errorResponse = limitReached('LIMIT_MEETING_PARTICIPANTS', 'В совещании уже 6 участников — это предел.', 6, 6);
    expect(errorResponse.details['limit']).toBe('LIMIT_MEETING_PARTICIPANTS');
    expect(errorResponse.status).toBe(409);
  });

  it('прочие отказы несут русский текст, говорящий что делать', () => {
    for (const errorResponse of [validationFailed('Проверьте поля.'), unauthenticated(), conflict('Номер занят.', 'duplicate'), rateLimited(15)]) {
      expect(errorResponse.message).toMatch(/[а-яА-Я]/);
      expect(errorResponse.message.trim().length).toBeGreaterThan(10);
    }
  });
});
