import { z } from 'zod';
import { uuid, isoDateTime } from './obshchee.ts';
import { PASSWORD_MIN_LENGTH } from './auth.ts';

/** Учётные записи — docs/09-API.md § 8, docs/05-ДОСТУП.md § 10. */

export const account = z.object({
  id: uuid,
  personId: uuid,
  login: z.string(),
  mustChangePassword: z.boolean(),
  isBlocked: z.boolean(),
  blockedReason: z.string().nullable(),
  version: z.number().int(),
});

export const accountCreateRequest = z.object({
  personId: uuid,
  login: z.string().min(1),
  /** Одноразовый пароль. Первый вход требует его смены (§ 10.2). */
  oneTimePassword: z.string().min(PASSWORD_MIN_LENGTH),
});

export const accountBlockRequest = z.object({
  /** Основание обязательно: блокировка без причины необъяснима. */
  reason: z.string().min(1),
});

export const accountBlockResponse = z.object({
  closedSessions: z.number().int().nonnegative(),
});

export const auditEvent = z.object({
  id: z.string(),
  occurredAt: isoDateTime,
  action: z.string(),
  entityTable: z.string(),
  entityId: uuid.nullable(),
  entityLabel: z.string().nullable(),
  personId: uuid.nullable(),
  assignmentId: uuid.nullable(),
  delegationId: uuid.nullable(),
});

export const auditListResponse = z.object({
  items: z.array(auditEvent),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  totalIsExact: z.boolean(),
});

export const auditVerifyResponse = z.object({
  /** Номер первой нарушенной связи или null, если нарушений нет. */
  firstBreak: z.string().nullable(),
  checked: z.number().int().nonnegative(),
});
