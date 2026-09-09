import { describe, it, expect } from 'vitest';
import { currentProfile, isProfile, pick, PROFILES, PROFILE_VARIABLE } from './profile.ts';

/** § 6: набор значений выбирается профилем, а не догадкой. */
describe('профиль развёртывания', () => {
  it('знает ровно два профиля', () => {
    expect(PROFILES).toEqual(['local', 'server']);
  });

  it('читает профиль из окружения', () => {
    expect(currentProfile({ [PROFILE_VARIABLE]: 'local' })).toBe('local');
    expect(currentProfile({ [PROFILE_VARIABLE]: 'server' })).toBe('server');
  });

  it('незаданный профиль — отказ, а не продуктовый по умолчанию', () => {
    expect(() => currentProfile({})).toThrow(/не задана/);
    expect(() => currentProfile({})).toThrow(/DEPLOY_PROFILE/);
  });

  it('неизвестный профиль — отказ с перечнем допустимых', () => {
    expect(() => currentProfile({ [PROFILE_VARIABLE]: 'staging' })).toThrow(/«staging»/);
    expect(() => currentProfile({ [PROFILE_VARIABLE]: 'staging' })).toThrow(/local, server/);
  });

  it('отказ называет, где профиль задаётся', () => {
    expect(() => currentProfile({})).toThrow(/compose\.local\.yml/);
  });

  it('опознаёт профиль', () => {
    expect(isProfile('local')).toBe(true);
    expect(isProfile('LOCAL')).toBe(false);
    expect(isProfile(undefined)).toBe(false);
  });

  it('выбирает значение по профилю', () => {
    const предел = { local: 6, server: 20 };
    expect(pick(предел, { [PROFILE_VARIABLE]: 'local' })).toBe(6);
    expect(pick(предел, { [PROFILE_VARIABLE]: 'server' })).toBe(20);
  });

  it('выбор значения без профиля тоже отказывает', () => {
    expect(() => pick({ local: 6, server: 20 }, {})).toThrow(/DEPLOY_PROFILE/);
  });
});
