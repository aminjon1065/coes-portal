import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { newId } from '@coes/core/id.ts';
import { record, type Actor } from '../audit/public.ts';
import {
  insertUnit, selectUnit, selectUnitsInScope,
  insertPosition, insertPerson, selectPerson,
  insertAssignment, selectAssignment, selectActiveAssignments, selectActiveDelegations,
  insertDelegation,
} from './queries.ts';
import type { OrgUnitRow, PositionRow, PersonRow, AssignmentRow, DelegationRow } from './queries.ts';

/**
 * Оргструктура — docs/05-ДОСТУП.md § 1, docs/04-ДАННЫЕ.md § 4.
 *
 * Субъект прав — назначение, а не человек: один человек может занимать две
 * должности в разных подразделениях, и права у них разные.
 */

export interface CreateUnit {
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly kind: string;
  readonly isRegionRoot: boolean;
}

export async function createOrgUnit(db: Client, actor: Actor, input: CreateUnit): Promise<OrgUnitRow> {
  if (input.parentId !== null && (await selectUnit(db, input.parentId)) === undefined) {
    throw new AppError('NOT_FOUND', 'Вышестоящее подразделение не найдено.');
  }
  const created = await insertUnit(db, { id: newId(), ...input, createdBy: actor.personId });
  // Ровно одна запись журнала на изменяющее действие, в той же транзакции
  // (docs/09-API.md § 10, п. 1).
  await record(db, actor, 'org_unit.create', {
    schema: 'org', table: 'org_unit', id: created.id, label: created.name,
  }, { after: created });
  return created;
}

/**
 * Область видимости — обязательный параметр, а не необязательное уточнение:
 * метод списка без области есть дефект (docs/09-API.md § 10, п. 2).
 */
export async function listOrgUnits(
  db: Client,
  scope: readonly string[],
  filter: { readonly limit: number; readonly q?: string | undefined },
): Promise<readonly OrgUnitRow[]> {
  return selectUnitsInScope(db, scope, filter);
}

export async function createPosition(
  db: Client,
  actor: Actor,
  input: { readonly orgUnitId: string; readonly name: string; readonly isHead: boolean },
): Promise<PositionRow> {
  if ((await selectUnit(db, input.orgUnitId)) === undefined) {
    throw new AppError('NOT_FOUND', 'Подразделение не найдено.');
  }
  const created = await insertPosition(db, { id: newId(), ...input, createdBy: actor.personId });
  await record(db, actor, 'position.create', {
    schema: 'org', table: 'position', id: created.id, label: created.name,
  }, { after: created });
  return created;
}

export async function createPerson(
  db: Client,
  actor: Actor,
  input: { readonly lastName: string; readonly firstName: string; readonly middleName: string | null },
): Promise<PersonRow> {
  const created = await insertPerson(db, { id: newId(), ...input, createdBy: actor.personId });
  await record(db, actor, 'person.create', {
    schema: 'org', table: 'person', id: created.id,
    label: `${created.lastName} ${created.firstName}`,
  }, { after: created });
  return created;
}

export interface CreateAssignment {
  readonly personId: string;
  readonly positionId: string;
  readonly startedOn: string;
  readonly orderNumber: string | null;
  readonly isPrimary: boolean;
}

export async function createAssignment(
  db: Client,
  actor: Actor,
  input: CreateAssignment,
): Promise<AssignmentRow> {
  const created = await insertAssignment(db, { id: newId(), ...input, createdBy: actor.personId });
  await record(db, actor, 'assignment.create', {
    schema: 'org', table: 'assignment', id: created.id,
    label: `${created.positionName}, ${created.orgUnitName}`,
  }, { after: created });
  return created;
}

/** Действующие назначения человека. Без них войти нельзя (§ 10.1). */
export async function activeAssignments(db: Client, personId: string): Promise<readonly AssignmentRow[]> {
  return selectActiveAssignments(db, personId);
}

export async function assignmentById(db: Client, id: string): Promise<AssignmentRow | undefined> {
  return selectAssignment(db, id);
}

export interface CreateDelegation {
  readonly delegatorAssignmentId: string;
  readonly delegateAssignmentId: string;
  readonly orderNumber: string;
  readonly startedOn: string;
  readonly endedOn: string;
  readonly reason: string | null;
}

/**
 * Оформление замещения приказом (§ 5.2). Замещение замещающего третьим
 * лицом прав замещаемого третьему лицу не даёт: нетранзитивность выражена
 * постройкой `access.visible_units`, а не проверкой здесь.
 */
export async function createDelegation(
  db: Client,
  actor: Actor,
  input: CreateDelegation,
): Promise<DelegationRow> {
  if (input.delegatorAssignmentId === input.delegateAssignmentId) {
    throw new AppError('VALIDATION_FAILED', 'Назначение не может замещать само себя.', {
      fields: [{ path: 'delegateAssignmentId', message: 'Укажите другое назначение' }],
    });
  }
  if (input.endedOn < input.startedOn) {
    throw new AppError('VALIDATION_FAILED', 'Конец замещения не может быть раньше начала.', {
      fields: [{ path: 'endedOn', message: 'Дата окончания раньше даты начала' }],
    });
  }
  for (const id of [input.delegatorAssignmentId, input.delegateAssignmentId]) {
    if ((await selectAssignment(db, id)) === undefined) {
      throw new AppError('NOT_FOUND', 'Назначение не найдено.');
    }
  }
  const created = await insertDelegation(db, { id: newId(), ...input, createdBy: actor.personId });
  await record(db, actor, 'delegation.create', {
    schema: 'org', table: 'delegation', id: created.id,
    label: `${created.delegatorPositionName}, приказ №${created.orderNumber}`,
  }, { after: created });
  return created;
}

/** Фамилия, имя и отчество: в шапке видна фамилия, а не должность (§ 5.2). */
export async function personById(db: Client, id: string): Promise<PersonRow | undefined> {
  return selectPerson(db, id);
}

export async function activeDelegations(db: Client, assignmentId: string): Promise<readonly DelegationRow[]> {
  return selectActiveDelegations(db, assignmentId);
}

export type { OrgUnitRow, PositionRow, PersonRow, AssignmentRow, DelegationRow } from './queries.ts';
