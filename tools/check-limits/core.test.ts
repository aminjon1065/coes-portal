import { describe, it, expect } from 'vitest';
import { checkLimits, type LimitEntry } from './core.ts';

const limit: LimitEntry = {
  key: 'LIMIT_MEETING_PARTICIPANTS',
  local: 6,
  server: 20,
  module: 'meet',
  message: 'В совещании уже {{max}} участников — это предел.',
};

/** Барьер § 5.11: предел без применения и без текста отказа запрещён. */
describe('check:limits', () => {
  it('пропускает предел, который применяется и имеет текст отказа', () => {
    expect(checkLimits([limit], ['throw limitReached(LIMIT_MEETING_PARTICIPANTS);'])).toEqual([]);
  });

  it('ловит предел, который нигде не применяется', () => {
    expect(checkLimits([limit], ['const x = 1;'])).toEqual([
      { key: 'LIMIT_MEETING_PARTICIPANTS', reason: 'не применяется' },
    ]);
  });

  it('ловит предел без текста отказа: молчаливая деградация запрещена', () => {
    const silent = { ...limit, message: '   ' };
    expect(checkLimits([silent], ['LIMIT_MEETING_PARTICIPANTS'])).toEqual([
      { key: 'LIMIT_MEETING_PARTICIPANTS', reason: 'нет текста отказа' },
    ]);
  });

  it('пустой реестр нарушений не даёт', () => {
    expect(checkLimits([], [])).toEqual([]);
  });
});
