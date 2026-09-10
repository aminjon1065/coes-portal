import type { Client } from 'pg';

/** Обращения к базе модуля audit. Наружу через public.ts не выходят. */

export interface AuditInsert {
  readonly personId: string | null;
  readonly assignmentId: string | null;
  readonly delegationId: string | null;
  readonly sessionId: string | null;
  readonly ip: string | null;
  readonly requestId: string | null;
  readonly action: string;
  readonly entitySchema: string;
  readonly entityTable: string;
  readonly entityId: string | null;
  /** Наименование объекта НА МОМЕНТ действия: объект переименуют. */
  readonly entityLabel: string | null;
  readonly beforeData: unknown;
  readonly afterData: unknown;
  readonly extra: unknown;
}

export async function insertEvent(db: Client, event: AuditInsert): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO audit.event (
       person_id, assignment_id, delegation_id, session_id, ip, request_id,
       action, entity_schema, entity_table, entity_id, entity_label,
       before_data, after_data, extra
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id::text AS id`,
    [
      event.personId, event.assignmentId, event.delegationId, event.sessionId,
      event.ip, event.requestId, event.action, event.entitySchema, event.entityTable,
      event.entityId, event.entityLabel,
      event.beforeData === undefined ? null : JSON.stringify(event.beforeData),
      event.afterData === undefined ? null : JSON.stringify(event.afterData),
      event.extra === undefined ? null : JSON.stringify(event.extra),
    ],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('Запись журнала не создана.');
  return id;
}

export interface AuditRow {
  readonly id: string;
  readonly occurredAt: string;
  readonly action: string;
  readonly entityTable: string;
  readonly entityId: string | null;
  readonly entityLabel: string | null;
  readonly personId: string | null;
  readonly assignmentId: string | null;
  readonly delegationId: string | null;
}

export async function selectEvents(
  db: Client,
  filter: { readonly entityId?: string | undefined; readonly limit: number },
): Promise<readonly AuditRow[]> {
  const { rows } = await db.query<{
    id: string; occurred_at: Date; action: string; entity_table: string;
    entity_id: string | null; entity_label: string | null;
    person_id: string | null; assignment_id: string | null; delegation_id: string | null;
  }>(
    `SELECT id::text AS id, occurred_at, action, entity_table, entity_id::text AS entity_id,
            entity_label, person_id::text AS person_id, assignment_id::text AS assignment_id,
            delegation_id::text AS delegation_id
       FROM audit.event
      WHERE ($1::uuid IS NULL OR entity_id = $1::uuid)
      ORDER BY id DESC
      LIMIT $2`,
    [filter.entityId ?? null, filter.limit],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at.toISOString(),
    action: row.action,
    entityTable: row.entity_table,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    personId: row.person_id,
    assignmentId: row.assignment_id,
    delegationId: row.delegation_id,
  }));
}
