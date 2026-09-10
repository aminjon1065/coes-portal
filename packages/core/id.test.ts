import { describe, it, expect, afterEach } from 'vitest';
import { newId, idFromMs, isId } from './id.ts';
import { freezeClock, resetClock } from './clock.ts';

afterEach(resetClock);

/** § 5.1: uuid версии 7 — упорядочен по времени, не раскрывает счёт записей. */
describe('идентификаторы', () => {
  it('имеет вид uuid версии 7', () => {
    const id = newId();
    expect(isId(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
  });

  it('берёт время из часов, а не из системных', () => {
    freezeClock(new Date('2026-09-09T00:00:00.000Z'));
    // Первые 48 бит — время в миллисекундах.
    const id = newId();
    const ms = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(ms).toBe(1788912000000);
  });

  it('упорядочен по времени: более поздний больше при обычном сравнении строк', () => {
    const earlier = idFromMs(1788912000000);
    const later = idFromMs(1788912000001);
    expect(later > earlier).toBe(true);
  });

  it('не повторяется при одном и том же моменте', () => {
    const set = new Set(Array.from({ length: 500 }, () => idFromMs(1788912000000)));
    expect(set.size).toBe(500);
  });

  it('отвергает не-uuid и uuid других версий', () => {
    expect(isId('не идентификатор')).toBe(false);
    expect(isId('0193b3c0-1234-4abc-8def-0123456789ab')).toBe(false);
    expect(isId('')).toBe(false);
  });
});
