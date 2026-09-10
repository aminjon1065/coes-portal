import { z } from 'zod';
import { uuid } from './obshchee.ts';

/** Оргструктура — docs/09-API.md § 8, docs/05-ДОСТУП.md § 1. */

/** Код подразделения: заглавные латинские, цифры и подчёркивание (13 § 3). */
export const ORG_UNIT_CODE = /^[A-Z][A-Z0-9_]{0,15}$/;

export const UNIT_KINDS = ['central', 'region', 'district', 'other'] as const;

export const orgUnit = z.object({
  id: uuid,
  code: z.string(),
  name: z.string(),
  parentId: uuid.nullable(),
  path: z.string(),
  kind: z.enum(UNIT_KINDS),
  isRegionRoot: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int(),
});

export const orgUnitCreateRequest = z.object({
  code: z.string().regex(ORG_UNIT_CODE, 'Код: заглавные латинские буквы, цифры и подчёркивание'),
  name: z.string().min(1),
  parentId: uuid.nullable(),
  kind: z.enum(UNIT_KINDS),
  isRegionRoot: z.boolean(),
});

export const orgUnitListResponse = z.object({
  items: z.array(orgUnit),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  totalIsExact: z.boolean(),
});

export const position = z.object({
  id: uuid,
  orgUnitId: uuid,
  name: z.string(),
  isHead: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int(),
});

export const positionCreateRequest = z.object({
  orgUnitId: uuid,
  name: z.string().min(1),
  isHead: z.boolean(),
});

export const person = z.object({
  id: uuid,
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
});

export const personCreateRequest = z.object({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().nullable(),
});

export const assignment = z.object({
  id: uuid,
  personId: uuid,
  positionId: uuid,
  positionName: z.string(),
  orgUnitId: uuid,
  orgUnitName: z.string(),
  startedOn: z.string(),
  endedOn: z.string().nullable(),
  orderNumber: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const assignmentCreateRequest = z.object({
  personId: uuid,
  positionId: uuid,
  startedOn: z.string(),
  /** Номер приказа: назначение оформляется приказом (§ 1). */
  orderNumber: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const delegation = z.object({
  id: uuid,
  delegatorAssignmentId: uuid,
  delegateAssignmentId: uuid,
  delegatorPositionName: z.string(),
  orderNumber: z.string(),
  startedOn: z.string(),
  endedOn: z.string(),
});

export const delegationCreateRequest = z.object({
  delegatorAssignmentId: uuid,
  delegateAssignmentId: uuid,
  /** Номер приказа обязателен: замещение оформляется приказом (§ 5.2). */
  orderNumber: z.string().min(1),
  startedOn: z.string(),
  endedOn: z.string(),
  reason: z.string().nullable(),
});

export const roleGrantRequest = z.object({
  roleCode: z.string().min(1),
});
