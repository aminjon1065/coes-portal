/** Звено цепочки журнала действий (docs/04-ДАННЫЕ.md § 9.6). */
export interface ChainLink {
  readonly id: string;
  readonly prevHash: string | null;
  readonly hash: string;
  /** Хеш, пересчитанный базой по содержимому записи. */
  readonly expectedHash: string;
}

export interface ChainBreak {
  readonly id: string;
  readonly reason: 'содержимое записи изменено' | 'связь с предыдущей записью разорвана';
}

/**
 * Находит ПЕРВОЕ нарушение цепочки (adr/12): дальше искать бессмысленно —
 * всё последующее нарушено по построению, а важно место, где историю
 * попытались исправить.
 *
 * Звенья подаются по возрастанию номера.
 */
export function findFirstBreak(links: readonly ChainLink[]): ChainBreak | null {
  let previous: ChainLink | undefined;
  for (const link of links) {
    if (link.hash !== link.expectedHash) {
      return { id: link.id, reason: 'содержимое записи изменено' };
    }
    const expectedPrev = previous === undefined ? null : previous.hash;
    if (link.prevHash !== expectedPrev) {
      return { id: link.id, reason: 'связь с предыдущей записью разорвана' };
    }
    previous = link;
  }
  return null;
}
