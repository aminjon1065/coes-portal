/** Запись реестра пределов (docs/03-АРХИТЕКТУРА.md § 6). */
export interface LimitEntry {
  readonly key: string;
  readonly local: number | string;
  readonly server: number | string;
  readonly module: string;
  readonly message: string;
}

export interface LimitViolation {
  readonly key: string;
  readonly reason: 'не применяется' | 'нет текста отказа';
}

/**
 * Предел без точки применения не ограничивает ничего, предел без текста
 * отказа заставляет систему деградировать молча. Контракт запрещает и то,
 * и другое (docs/03-АРХИТЕКТУРА.md § 5.11).
 */
export function checkLimits(registry: readonly LimitEntry[], sources: readonly string[]): LimitViolation[] {
  const haystack = sources.join('\n');
  const violations: LimitViolation[] = [];
  for (const entry of registry) {
    if (entry.message.trim() === '') {
      violations.push({ key: entry.key, reason: 'нет текста отказа' });
    }
    if (!haystack.includes(entry.key)) {
      violations.push({ key: entry.key, reason: 'не применяется' });
    }
  }
  return violations;
}
