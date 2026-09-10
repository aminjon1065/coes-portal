import type { Client } from 'pg';
import { insertEvent, selectEvents } from './queries.ts';
import type { AuditRow } from './queries.ts';

/**
 * Журнал действий — docs/05-ДОСТУП.md § 9.
 *
 * Цепочку хешей строит триггер базы, а не этот код: код, вычисляющий
 * хеш сам, можно обойти, вставив запись мимо кода (§ 9.3).
 *
 * Обычные чтения не журналируются: при полутора сотнях пользователей это
 * дало бы миллионы записей в сутки, в которых утонули бы изменения (§ 9.2).
 */

/** Кто и в каком качестве действует. Субъект — назначение, а не человек. */
export interface Actor {
  readonly personId: string;
  readonly assignmentId: string;
  /** Замещение, в рамках которого действует замещающий (§ 5.3). */
  readonly delegationId: string | null;
  readonly sessionId: string | null;
  readonly ip: string | null;
  readonly requestId: string | null;
}

export interface AuditEntity {
  readonly schema: string;
  readonly table: string;
  readonly id: string | null;
  readonly label: string | null;
}

export interface AuditChange {
  readonly before?: unknown;
  readonly after?: unknown;
  readonly extra?: unknown;
}

/**
 * Одно изменяющее действие — ровно одна запись, в той же транзакции
 * (docs/09-API.md § 10, п. 1). Вызов вне транзакции изменения — дефект.
 */
export async function record(
  db: Client,
  actor: Actor | null,
  action: string,
  entity: AuditEntity,
  change: AuditChange = {},
): Promise<string> {
  return insertEvent(db, {
    personId: actor?.personId ?? null,
    assignmentId: actor?.assignmentId ?? null,
    delegationId: actor?.delegationId ?? null,
    sessionId: actor?.sessionId ?? null,
    ip: actor?.ip ?? null,
    requestId: actor?.requestId ?? null,
    action,
    entitySchema: entity.schema,
    entityTable: entity.table,
    entityId: entity.id,
    entityLabel: entity.label,
    beforeData: change.before,
    afterData: change.after,
    extra: change.extra,
  });
}

export async function listEvents(
  db: Client,
  filter: { readonly entityId?: string | undefined; readonly limit: number },
): Promise<readonly AuditRow[]> {
  return selectEvents(db, filter);
}

export type { AuditRow } from './queries.ts';
