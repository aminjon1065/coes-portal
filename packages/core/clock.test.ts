import { describe, it, expect, afterEach } from 'vitest';
import { now, nowMs, freezeClock, resetClock } from './clock.ts';

afterEach(resetClock);

/** § 5.2: единственный источник времени, воспроизводимый в проверках. */
describe('часы', () => {
  it('системные часы идут вперёд', () => {
    expect(nowMs()).toBeGreaterThan(1_700_000_000_000);
  });

  it('остановленные часы возвращают заданный момент', () => {
    freezeClock(new Date('2026-09-09T00:00:00.000Z'));
    expect(nowMs()).toBe(1788912000000);
    expect(now().toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  it('останавливаются и по числу миллисекунд', () => {
    freezeClock(1788912000000);
    expect(now().toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  it('после сброса снова идут', () => {
    freezeClock(1788912000000);
    resetClock();
    expect(nowMs()).not.toBe(1788912000000);
  });
});
