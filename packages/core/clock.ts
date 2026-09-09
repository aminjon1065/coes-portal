/**
 * Единственный источник текущего времени в программе
 * (docs/03-АРХИТЕКТУРА.md § 5.2). Прямой вызов `new Date()` вне этого файла
 * запрещён правилом `coes/no-direct-date`: иначе проверки сроков хранения
 * невоспроизводимы — они зависели бы от того, когда их запустили.
 *
 * Хранение и передача — UTC (§ 5.2). Пояс `Asia/Dushanbe` применяется только
 * при отображении и живёт в клиенте, а не здесь.
 */

/** Источник времени. Подменяется только проверками. */
export type ClockSource = () => number;

const systemClock: ClockSource = () => new Date().getTime();

let current: ClockSource = systemClock;

/** Текущее время в миллисекундах с начала эпохи, UTC. */
export function nowMs(): number {
  return current();
}

/** Текущее время как момент, UTC. */
export function now(): Date {
  return new Date(current());
}

/**
 * Останавливает часы на заданном моменте. Только для проверок: правило
 * линтера не пускает `new Date()` в прикладной код, а проверка сроков
 * хранения обязана быть воспроизводимой.
 */
export function freezeClock(at: Date | number): void {
  const value = typeof at === 'number' ? at : at.getTime();
  current = () => value;
}

/** Возвращает системные часы. */
export function resetClock(): void {
  current = systemClock;
}
