import { describe, it, expect } from 'vitest';
import { checkLimits, pendingLimits, type LimitEntry } from './core.ts';

const limit: LimitEntry = {
  key: 'LIMIT_MEETING_PARTICIPANTS',
  local: 6,
  server: 20,
  module: 'meet',
  message: 'В совещании уже {value} участников — это предел.',
};

/** Барьер § 5.11: предел без применения, без текста и с зашитым числом. */
describe('check:limits', () => {
  it('пропускает предел, который применяется и имеет текст отказа', () => {
    expect(checkLimits([limit], ['throw refuse(LIMIT_MEETING_PARTICIPANTS);'], ['meet'])).toEqual([]);
  });

  it('ловит предел, который нигде не применяется, если его модуль построен', () => {
    expect(checkLimits([limit], ['const x = 1;'], ['meet'])).toEqual([
      { key: 'LIMIT_MEETING_PARTICIPANTS', reason: 'не применяется' },
    ]);
  });

  // Предел этапа 7 нельзя применить, пока модуля совещаний нет.
  it('не требует применения от предела, чей модуль ещё не построен', () => {
    expect(checkLimits([limit], ['const x = 1;'], ['iam'])).toEqual([]);
    expect(pendingLimits([limit], ['iam'])).toEqual(['LIMIT_MEETING_PARTICIPANTS']);
  });

  it('ловит предел без текста отказа: молчаливая деградация запрещена', () => {
    const silent = { ...limit, message: '   ' };
    expect(checkLimits([silent], ['LIMIT_MEETING_PARTICIPANTS'], ['meet'])).toEqual([
      { key: 'LIMIT_MEETING_PARTICIPANTS', reason: 'нет текста отказа' },
    ]);
  });

  // Зашитое число заставило бы локальный отказ сообщать продуктовое значение.
  it('ловит зашитое в текст отказа число', () => {
    const hardcoded = { ...limit, message: 'В совещании уже 20 участников — это предел.' };
    expect(checkLimits([hardcoded], ['LIMIT_MEETING_PARTICIPANTS'], ['meet'])).toEqual([
      { key: 'LIMIT_MEETING_PARTICIPANTS', reason: 'в тексте отказа зашито число' },
    ]);
  });

  it('пустой реестр нарушений не даёт', () => {
    expect(checkLimits([], [], [])).toEqual([]);
  });
});
