import { describe, it, expect } from 'vitest';
import { PERMISSIONS, PERMISSION_CODES, PERMISSION_CODE, isPermissionCode } from './permissions.ts';

/** § 2.1: перечень разрешений — код. Ошибка здесь не видна на экране. */
describe('разрешения', () => {
  it('перечень Выпуска 1 состоит из пятидесяти разрешений (§ 2.3)', () => {
    expect(PERMISSIONS).toHaveLength(50);
  });

  it('коды не повторяются', () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length);
  });

  it('каждый код соответствует форме «модуль.объект.действие» (§ 2.2)', () => {
    const плохие = PERMISSION_CODES.filter((code) => !PERMISSION_CODE.test(code));
    expect(плохие).toEqual([]);
  });

  it('модуль выводится из кода и не задаётся отдельно', () => {
    expect(PERMISSIONS.find((x) => x.code === 'incident.card.close')?.module).toBe('incident');
    expect(PERMISSIONS.find((x) => x.code === 'system.content.read_foreign')?.module).toBe('system');
  });

  it('у каждого разрешения есть русское наименование', () => {
    const безымянные = PERMISSIONS.filter((x) => !/[а-яА-Я]/.test(x.name) || x.name.length < 5);
    expect(безымянные).toEqual([]);
  });

  it('опознаёт свой код и отвергает чужой', () => {
    expect(isPermissionCode('incident.card.close')).toBe(true);
    expect(isPermissionCode('incident.card.выдумка')).toBe(false);
    expect(isPermissionCode('')).toBe(false);
  });

  it('перечень покрывает все модули Выпуска 1', () => {
    const модули = new Set(PERMISSIONS.map((x) => x.module));
    expect([...модули].sort()).toEqual([
      'access', 'analytics', 'audit', 'geo', 'iam', 'incident',
      'org', 'pdn', 'ref', 'store', 'sys', 'system', 'template',
    ]);
  });
});
