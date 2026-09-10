import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { newId } from '@coes/core/id.ts';
import { record, type Actor } from '../audit/public.ts';
import { activeAssignments, activeDelegations, assignmentById, personById } from '../org/public.ts';
import type { AssignmentRow, DelegationRow } from '../org/public.ts';
import {
  selectPermissions, selectVisibleUnits, insertAssignmentRole, deleteAssignmentRole,
  selectRoleByCode, selectRoles, insertScopeGrant,
} from './queries.ts';

/**
 * Права, роли, область видимости — docs/05-ДОСТУП.md § 2–4.
 *
 * Здесь же составляется рабочий контекст сессии. Причина: контекст —
 * это назначение (модуль org), права (этот модуль) и учётная запись
 * (модуль iam). Модуль iam не имеет права знать об org, поэтому свести их
 * может только модуль старше обоих (docs/03-АРХИТЕКТУРА.md § 3).
 */

export interface WorkContext {
  readonly personId: string;
  /** Фамилия и инициалы: в шапке видна фамилия человека (§ 5.2). */
  readonly fullName: string;
  readonly assignment: AssignmentRow;
  readonly assignments: readonly AssignmentRow[];
  readonly permissions: readonly string[];
  readonly visibleOrgUnitIds: readonly string[];
  readonly delegations: readonly DelegationRow[];
}

export async function permissionsOf(db: Client, assignmentId: string): Promise<readonly string[]> {
  return selectPermissions(db, assignmentId);
}

export async function visibleUnitsOf(db: Client, assignmentId: string): Promise<readonly string[]> {
  return selectVisibleUnits(db, assignmentId);
}

/**
 * Рабочий контекст назначения. Назначение обязано быть действующим:
 * прекращение назначения немедленно делает сессию недействительной
 * (docs/05-ДОСТУП.md § 10.3).
 */
export async function workContext(
  db: Client,
  personId: string,
  assignmentId: string,
): Promise<WorkContext> {
  const all = await activeAssignments(db, personId);
  const assignment = all.find((item) => item.id === assignmentId);
  if (assignment === undefined) {
    throw new AppError('UNAUTHENTICATED', 'Назначение прекращено. Войдите заново.');
  }
  const [permissions, visibleOrgUnitIds, delegations, person] = await Promise.all([
    selectPermissions(db, assignmentId),
    selectVisibleUnits(db, assignmentId),
    activeDelegations(db, assignmentId),
    personById(db, personId),
  ]);
  if (person === undefined) throw new AppError('UNAUTHENTICATED', 'Карточка сотрудника не найдена. Войдите заново.');
  const middle = person.middleName === null ? '' : ` ${person.middleName}`;
  return {
    personId,
    fullName: `${person.lastName} ${person.firstName}${middle}`,
    assignment,
    assignments: all,
    permissions,
    visibleOrgUnitIds,
    delegations,
  };
}

/** Назначение, которое станет активным при входе: основное или первое. */
export async function assignmentForLogin(db: Client, personId: string): Promise<AssignmentRow> {
  const all = await activeAssignments(db, personId);
  const first = all[0];
  if (first === undefined) {
    // Учётная запись без действующего назначения войти не может: субъектом
    // прав является назначение (docs/05-ДОСТУП.md § 10.1).
    throw new AppError(
      'ACCESS_DENIED',
      'У вас нет действующего назначения на должность. Обратитесь к администратору: без назначения работа в системе невозможна.',
    );
  }
  return first;
}

/**
 * Проверка права. Сервер проверяет права независимо и всегда, даже если
 * интерфейс кнопку не показал (docs/09-API.md § 8).
 */
export function requirePermission(context: WorkContext, permission: string): void {
  if (!context.permissions.includes(permission)) {
    throw new AppError(
      'ACCESS_DENIED',
      'Действие недоступно: у вашей должности нет нужного разрешения. Если оно необходимо для работы, обратитесь к администратору.',
      { permission },
    );
  }
}

/**
 * Проверка области видимости. Отказ, а не пустой список: пустой список
 * означал бы «объекта нет», и пользователь искал бы его дальше
 * (adr/11, docs/05-ДОСТУП.md § 7).
 */
export function requireInScope(context: WorkContext, orgUnitId: string): void {
  if (!context.visibleOrgUnitIds.includes(orgUnitId)) {
    throw new AppError(
      'ACCESS_DENIED',
      'Этот объект существует, но не входит в вашу область видимости. Если доступ необходим для работы, обратитесь к администратору региона.',
    );
  }
}

export async function grantRole(
  db: Client,
  actor: Actor,
  input: { readonly assignmentId: string; readonly roleCode: string },
): Promise<void> {
  const role = await selectRoleByCode(db, input.roleCode);
  if (role === undefined) throw new AppError('NOT_FOUND', 'Роль не найдена.');
  const assignment = await assignmentById(db, input.assignmentId);
  if (assignment === undefined) throw new AppError('NOT_FOUND', 'Назначение не найдено.');
  await insertAssignmentRole(db, input.assignmentId, role.id, actor.personId);
  // Выдача роли журналируется (docs/05-ДОСТУП.md § 9.1).
  await record(db, actor, 'role.grant', {
    schema: 'access', table: 'assignment_role', id: input.assignmentId,
    label: `${role.name} → ${assignment.positionName}, ${assignment.orgUnitName}`,
  }, { after: { roleCode: role.code } });
}

export async function revokeRole(
  db: Client,
  actor: Actor,
  input: { readonly assignmentId: string; readonly roleCode: string },
): Promise<void> {
  const role = await selectRoleByCode(db, input.roleCode);
  if (role === undefined) throw new AppError('NOT_FOUND', 'Роль не найдена.');
  await deleteAssignmentRole(db, input.assignmentId, role.id);
  await record(db, actor, 'role.revoke', {
    schema: 'access', table: 'assignment_role', id: input.assignmentId, label: role.name,
  }, { before: { roleCode: role.code } });
}

export async function grantScope(
  db: Client,
  actor: Actor,
  input: {
    readonly assignmentId: string; readonly kind: 'own_subtree' | 'all_regions' | 'extra_subtree';
    readonly orgUnitId: string | null; readonly reason: string;
  },
): Promise<void> {
  if (input.reason.trim() === '') {
    throw new AppError('VALIDATION_FAILED', 'Основание обязательно: область, выданная без объяснения, через год необъяснима.', {
      fields: [{ path: 'reason', message: 'Укажите основание' }],
    });
  }
  await insertScopeGrant(db, { id: newId(), ...input, grantedBy: actor.personId });
  await record(db, actor, 'scope.grant', {
    schema: 'access', table: 'scope_grant', id: input.assignmentId, label: input.kind,
  }, { after: { kind: input.kind, orgUnitId: input.orgUnitId, reason: input.reason } });
}

export async function listRoles(db: Client): Promise<readonly { readonly id: string; readonly code: string; readonly name: string }[]> {
  return selectRoles(db);
}
