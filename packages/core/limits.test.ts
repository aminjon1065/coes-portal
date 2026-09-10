import { describe, it, expect } from 'vitest';
import { LIMITS, limitEntry, limitValue, refuse } from './limits.ts';

const LOCAL = { DEPLOY_PROFILE: 'local' } as NodeJS.ProcessEnv;
const SERVER = { DEPLOY_PROFILE: 'server' } as NodeJS.ProcessEnv;

/** Реестр пределов — docs/03-АРХИТЕКТУРА.md § 6, § 5.11. */
describe('реестр пределов', () => {
  it('содержит все восемнадцать записей таблицы § 6, ключи не повторяются', () => {
    expect(LIMITS.length).toBe(18);
    expect(new Set(LIMITS.map((entry) => entry.key)).size).toBe(18);
  });

  it('каждая запись имеет точку применения и текст отказа', () => {
    for (const entry of LIMITS) {
      expect(entry.module, entry.key).not.toBe('');
      expect(entry.message.trim(), entry.key).not.toBe('');
    }
  });

  // Одно значение на обе среды означало бы, что локальная среда упадёт.
  it('локальный и продуктовый наборы выбираются по профилю', () => {
    expect(limitValue('LIMIT_MEETING_PARTICIPANTS', {}, LOCAL)).toBe(6);
    expect(limitValue('LIMIT_MEETING_PARTICIPANTS', {}, SERVER)).toBe(20);
  });

  /** Порядок § 5.11: переменная окружения → sys.setting → умолчание. */
  it('переменная окружения старше строки настройки, а та — умолчания', () => {
    expect(limitValue('LIMIT_UPLOAD_SIZE_MB', {}, LOCAL)).toBe(128);
    expect(limitValue('LIMIT_UPLOAD_SIZE_MB', { LIMIT_UPLOAD_SIZE_MB: '64' }, LOCAL)).toBe(64);
    expect(limitValue(
      'LIMIT_UPLOAD_SIZE_MB',
      { LIMIT_UPLOAD_SIZE_MB: '64' },
      { ...LOCAL, LIMIT_UPLOAD_SIZE_MB: '32' },
    )).toBe(32);
  });

  it('пустая строка настройки умолчания не отменяет', () => {
    expect(limitValue('LIMIT_UPLOAD_SIZE_MB', { LIMIT_UPLOAD_SIZE_MB: '' }, LOCAL)).toBe(128);
    expect(limitValue('LIMIT_UPLOAD_SIZE_MB', {}, { ...LOCAL, LIMIT_UPLOAD_SIZE_MB: '' })).toBe(128);
  });

  it('нечисловое значение остаётся строкой, а не превращается в NaN', () => {
    expect(limitValue('LIMIT_UPLOAD_SIZE_MB', { LIMIT_UPLOAD_SIZE_MB: 'много' }, LOCAL)).toBe('много');
  });

  // Зашитое число заставило бы локальный отказ сообщать продуктовое значение.
  it('текст отказа подставляет действующее значение, а не зашитое', () => {
    expect(refuse('LIMIT_MEETING_PARTICIPANTS', {}, {}, LOCAL))
      .toBe('В совещании уже 6 участников — это предел.');
    expect(refuse('LIMIT_MEETING_PARTICIPANTS', {}, {}, SERVER))
      .toBe('В совещании уже 20 участников — это предел.');
  });

  it('текст отказа подставляет и требуемую величину', () => {
    expect(refuse('LIMIT_DISK_FREE_GB', { need: 3 }, {}, LOCAL))
      .toContain('осталось 3 ГБ из необходимых 20');
  });

  it('незаявленный предел — ошибка, а не молчаливое умолчание', () => {
    expect(() => limitEntry('LIMIT_NOTHING')).toThrow('не объявлен в реестре');
  });
});
