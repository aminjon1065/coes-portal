/** Запись реестра пределов (docs/03-АРХИТЕКТУРА.md § 6). */
export interface LimitEntry {
  readonly key: string;
  readonly local: number | string;
  readonly server: number | string;
  /** Где применяется — по таблице § 6. */
  readonly module: string;
  /**
   * Что должно быть построено, чтобы предел стало где применять. Предел
   * подписок на видео применяется в веб-приложении, но бессмыслен без
   * модуля совещаний, поэтому ждёт именно его.
   */
  readonly requires?: string;
  readonly message: string;
}

export type LimitProblem =
  | 'не применяется'
  | 'нет текста отказа'
  | 'в тексте отказа зашито число';

export interface LimitViolation {
  readonly key: string;
  readonly reason: LimitProblem;
}

/**
 * Предел без точки применения не ограничивает ничего, предел без текста
 * отказа заставляет систему деградировать молча, а зашитое в текст число
 * заставляет локальный отказ сообщать продуктовое значение. Контракт
 * запрещает всё три (docs/03-АРХИТЕКТУРА.md § 5.11, § 6).
 *
 * Применение требуется только от пределов, чей модуль уже построен:
 * предел этапа 7 нельзя применить, пока модуля совещаний нет. Перечень
 * построенных модулей выводится из состава репозитория, а не из настройки,
 * поэтому проверка краснеет сама в тот день, когда модуль появляется без
 * своего предела.
 */
export function checkLimits(
  registry: readonly LimitEntry[],
  sources: readonly string[],
  builtModules: readonly string[] = [],
): LimitViolation[] {
  const haystack = sources.join('\n');
  const built = new Set(builtModules);
  const violations: LimitViolation[] = [];
  for (const entry of registry) {
    if (entry.message.trim() === '') {
      violations.push({ key: entry.key, reason: 'нет текста отказа' });
    } else if (hasHardcodedNumber(entry)) {
      violations.push({ key: entry.key, reason: 'в тексте отказа зашито число' });
    }
    if (built.has(entry.requires ?? entry.module) && !haystack.includes(entry.key)) {
      violations.push({ key: entry.key, reason: 'не применяется' });
    }
  }
  return violations;
}

/** Значение предела, попавшее в текст буквой, а не подстановкой. */
function hasHardcodedNumber(entry: LimitEntry): boolean {
  return [entry.local, entry.server]
    .map((value) => String(value))
    .some((value) => value.length > 1 && entry.message.includes(value));
}

/** Пределы, применение которых ещё не требуется: их модуля нет. */
export function pendingLimits(
  registry: readonly LimitEntry[],
  builtModules: readonly string[],
): readonly string[] {
  const built = new Set(builtModules);
  return registry.filter((entry) => !built.has(entry.requires ?? entry.module)).map((entry) => entry.key);
}
