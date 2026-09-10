import type { Client } from 'pg';

/** Обращения к базе модуля access. */

/**
 * Разрешения назначения: объединение разрешений всех выданных ему ролей.
 * Своих разрешений у человека нет — субъект прав есть назначение (§ 1).
 */
export async function selectPermissions(db: Client, assignmentId: string): Promise<readonly string[]> {
  const { rows } = await db.query<{ code: string }>(
    `SELECT DISTINCT p.code
       FROM access.assignment_role ar
       JOIN access.role_permission rp ON rp.role_id = ar.role_id
       JOIN access.permission p ON p.code = rp.permission_code
      WHERE ar.assignment_id = $1
      ORDER BY p.code`,
    [assignmentId],
  );
  return rows.map((row) => row.code);
}

/**
 * Область видимости назначения — функция базы (docs/05-ДОСТУП.md § 4.5).
 * Нетранзитивность выражена самой её постройкой, а не проверкой в коде.
 */
export async function selectVisibleUnits(db: Client, assignmentId: string): Promise<readonly string[]> {
  const { rows } = await db.query<{ org_unit_id: string }>(
    'SELECT org_unit_id::text AS org_unit_id FROM access.visible_units($1)',
    [assignmentId],
  );
  return rows.map((row) => row.org_unit_id);
}

export async function insertAssignmentRole(
  db: Client,
  assignmentId: string,
  roleId: string,
  grantedBy: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO access.assignment_role (assignment_id, role_id, granted_by_person_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [assignmentId, roleId, grantedBy],
  );
}

export async function deleteAssignmentRole(db: Client, assignmentId: string, roleId: string): Promise<void> {
  await db.query(
    'DELETE FROM access.assignment_role WHERE assignment_id = $1 AND role_id = $2',
    [assignmentId, roleId],
  );
}

export interface RoleRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export async function selectRoleByCode(db: Client, code: string): Promise<RoleRow | undefined> {
  const { rows } = await db.query<{ id: string; code: string; name: string }>(
    'SELECT id::text AS id, code, name FROM access.role WHERE code = $1',
    [code],
  );
  return rows[0];
}

export async function selectRoles(db: Client): Promise<readonly RoleRow[]> {
  const { rows } = await db.query<{ id: string; code: string; name: string }>(
    'SELECT id::text AS id, code, name FROM access.role ORDER BY code',
  );
  return rows;
}

/**
 * Расширение области видимости. Основание обязательно: область, выданная
 * без объяснения, через год необъяснима (docs/05-ДОСТУП.md § 4.4).
 */
export async function insertScopeGrant(
  db: Client,
  grant: {
    readonly id: string; readonly assignmentId: string; readonly kind: string;
    readonly orgUnitId: string | null; readonly reason: string; readonly grantedBy: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO access.scope_grant (id, assignment_id, kind, org_unit_id, reason, granted_by_person_id)
     VALUES ($1, $2, $3::access.scope_kind_enum, $4, $5, $6)`,
    [grant.id, grant.assignmentId, grant.kind, grant.orgUnitId, grant.reason, grant.grantedBy],
  );
}
