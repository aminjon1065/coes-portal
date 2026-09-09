import { randomFillSync } from 'node:crypto';
import { nowMs } from './clock.ts';

/**
 * Первичный ключ каждой таблицы — uuid версии 7
 * (docs/03-АРХИТЕКТУРА.md § 5.1): упорядочен по времени, что даёт локальность
 * в индексе и не раскрывает количество записей.
 *
 * Пользователю идентификатор не показывается никогда: объект опознаётся
 * регистрационным номером или наименованием.
 */

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array, from: number, to: number): string {
  let out = '';
  for (let i = from; i < to; i += 1) {
    const byte = bytes[i] ?? 0;
    out += HEX[byte >> 4] ?? '0';
    out += HEX[byte & 0x0f] ?? '0';
  }
  return out;
}

/** Формирует uuid версии 7 от текущего времени. */
export function newId(): string {
  return idFromMs(nowMs());
}

/**
 * Формирует uuid версии 7 от заданного момента.
 * Вынесено отдельно, чтобы упорядоченность проверялась без ожидания часов.
 */
export function idFromMs(ms: number): string {
  const bytes = new Uint8Array(16);
  randomFillSync(bytes);

  // 48 бит времени, старший байт первым.
  let rest = Math.floor(ms);
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }

  // Версия 7 в старшей половине седьмого байта.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  // Вариант RFC 4122 в двух старших битах девятого байта.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  return (
    `${toHex(bytes, 0, 4)}-${toHex(bytes, 4, 6)}-${toHex(bytes, 6, 8)}-` +
    `${toHex(bytes, 8, 10)}-${toHex(bytes, 10, 16)}`
  );
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Проверяет, что строка — uuid версии 7. */
export function isId(value: string): boolean {
  return UUID_V7.test(value);
}
