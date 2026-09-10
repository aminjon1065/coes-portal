import type { Client } from 'pg';

/** Обращения к базе модуля org. */

export interface OrgUnitRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly path: string;
  readonly kind: string;
  readonly isRegionRoot: boolean;
  readonly isActive: boolean;
  readonly version: number;
}

const UNIT_COLUMNS = `
  id::text AS id, code, name, parent_id::text AS parent_id, path::text AS path,
  kind::text AS kind, is_region_root, is_active, version
`;

interface RawUnit {
  id: string; code: string; name: string; parent_id: string | null; path: string;
  kind: string; is_region_root: boolean; is_active: boolean; version: number;
}

function toUnit(row: RawUnit): OrgUnitRow {
  return {
    id: row.id, code: row.code, name: row.name, parentId: row.parent_id, path: row.path,
    kind: row.kind, isRegionRoot: row.is_region_root, isActive: row.is_active, version: row.version,
  };
}

export async function selectUnit(db: Client, id: string): Promise<OrgUnitRow | undefined> {
  const { rows } = await db.query<RawUnit>(`SELECT ${UNIT_COLUMNS} FROM org.org_unit WHERE id = $1`, [id]);
  const row = rows[0];
  return row === undefined ? undefined : toUnit(row);
}

/**
 * Реестр подразделений в области видимости.
 *
 * Область приходит перечнем идентификаторов, а не вычисляется здесь
 * обращением к `access.visible_units`: модуль org (5) не имеет права
 * зависеть от модуля access (6), и через SQL это правило обходится молча —
 * проверка границ читает импорты, а не запросы. Обязательный параметр
 * делает список без области невыразимым.
 */
export async function selectUnitsInScope(
  db: Client,
  scope: readonly string[],
  filter: { readonly limit: number; readonly q?: string | undefined },
): Promise<readonly OrgUnitRow[]> {
  const { rows } = await db.query<RawUnit>(
    `SELECT ${UNIT_COLUMNS}
       FROM org.org_unit u
      WHERE u.id = ANY($1::uuid[])
        AND ($2::text IS NULL OR u.name_norm LIKE '%' || public.tj_norm($2) || '%')
      ORDER BY u.path
      LIMIT $3`,
    [[...scope], filter.q ?? null, filter.limit],
  );
  return rows.map(toUnit);
}

export async function insertUnit(
  db: Client,
  unit: {
    readonly id: string; readonly code: string; readonly name: string;
    readonly parentId: string | null; readonly kind: string;
    readonly isRegionRoot: boolean; readonly createdBy: string | null;
  },
): Promise<OrgUnitRow> {
  // Путь дерева выводится из пути вышестоящего: метка узла — его
  // идентификатор без дефисов (docs/04-ДАННЫЕ.md § 4).
  const { rows } = await db.query<RawUnit>(
    `INSERT INTO org.org_unit (id, code, name, parent_id, path, kind, is_region_root, created_by_person_id)
     VALUES (
       $1::uuid, $2, $3, $4::uuid,
       CASE WHEN $4::uuid IS NULL
            THEN text2ltree(replace($1::text, '-', ''))
            ELSE (SELECT path FROM org.org_unit WHERE id = $4::uuid) || text2ltree(replace($1::text, '-', ''))
       END,
       $5::org.unit_kind_enum, $6, $7
     )
     RETURNING ${UNIT_COLUMNS}`,
    [unit.id, unit.code, unit.name, unit.parentId, unit.kind, unit.isRegionRoot, unit.createdBy],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('Подразделение не создано.');
  return toUnit(row);
}

export interface PositionRow {
  readonly id: string;
  readonly orgUnitId: string;
  readonly name: string;
  readonly isHead: boolean;
  readonly isActive: boolean;
  readonly version: number;
}

export async function insertPosition(
  db: Client,
  position: {
    readonly id: string; readonly orgUnitId: string; readonly name: string;
    readonly isHead: boolean; readonly createdBy: string | null;
  },
): Promise<PositionRow> {
  const { rows } = await db.query<{
    id: string; org_unit_id: string; name: string; is_head: boolean; is_active: boolean; version: number;
  }>(
    `INSERT INTO org.position (id, org_unit_id, name, is_head, created_by_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text AS id, org_unit_id::text AS org_unit_id, name, is_head, is_active, version`,
    [position.id, position.orgUnitId, position.name, position.isHead, position.createdBy],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('Должность не создана.');
  return {
    id: row.id, orgUnitId: row.org_unit_id, name: row.name,
    isHead: row.is_head, isActive: row.is_active, version: row.version,
  };
}

export interface PersonRow {
  readonly id: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly middleName: string | null;
  readonly isActive: boolean;
  readonly version: number;
}

export async function selectPerson(db: Client, id: string): Promise<PersonRow | undefined> {
  const { rows } = await db.query<{
    id: string; last_name: string; first_name: string; middle_name: string | null;
    is_active: boolean; version: number;
  }>(
    `SELECT id::text AS id, last_name, first_name, middle_name, is_active, version
       FROM org.person WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row === undefined ? undefined : {
    id: row.id, lastName: row.last_name, firstName: row.first_name,
    middleName: row.middle_name, isActive: row.is_active, version: row.version,
  };
}

export async function insertPerson(
  db: Client,
  person: {
    readonly id: string; readonly lastName: string; readonly firstName: string;
    readonly middleName: string | null; readonly createdBy: string | null;
  },
): Promise<PersonRow> {
  const { rows } = await db.query<{
    id: string; last_name: string; first_name: string; middle_name: string | null;
    is_active: boolean; version: number;
  }>(
    `INSERT INTO org.person (id, last_name, first_name, middle_name, created_by_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id::text AS id, last_name, first_name, middle_name, is_active, version`,
    [person.id, person.lastName, person.firstName, person.middleName, person.createdBy],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('Сотрудник не создан.');
  return {
    id: row.id, lastName: row.last_name, firstName: row.first_name,
    middleName: row.middle_name, isActive: row.is_active, version: row.version,
  };
}

export interface AssignmentRow {
  readonly id: string;
  readonly personId: string;
  readonly positionId: string;
  readonly positionName: string;
  readonly orgUnitId: string;
  readonly orgUnitName: string;
  readonly startedOn: string;
  readonly endedOn: string | null;
  readonly orderNumber: string | null;
  readonly isPrimary: boolean;
}

const ASSIGNMENT_SELECT = `
  SELECT a.id::text AS id, a.person_id::text AS person_id, a.position_id::text AS position_id,
         p.name AS position_name, p.org_unit_id::text AS org_unit_id, u.name AS org_unit_name,
         a.started_on::text AS started_on, a.ended_on::text AS ended_on,
         a.order_number, a.is_primary
    FROM org.assignment a
    JOIN org.position p ON p.id = a.position_id
    JOIN org.org_unit u ON u.id = p.org_unit_id
`;

interface RawAssignment {
  id: string; person_id: string; position_id: string; position_name: string;
  org_unit_id: string; org_unit_name: string; started_on: string; ended_on: string | null;
  order_number: string | null; is_primary: boolean;
}

function toAssignment(row: RawAssignment): AssignmentRow {
  return {
    id: row.id, personId: row.person_id, positionId: row.position_id,
    positionName: row.position_name, orgUnitId: row.org_unit_id, orgUnitName: row.org_unit_name,
    startedOn: row.started_on, endedOn: row.ended_on,
    orderNumber: row.order_number, isPrimary: row.is_primary,
  };
}

/** Действующие назначения человека: субъект прав — назначение (§ 1). */
export async function selectActiveAssignments(db: Client, personId: string): Promise<readonly AssignmentRow[]> {
  const { rows } = await db.query<RawAssignment>(
    `${ASSIGNMENT_SELECT}
      WHERE a.person_id = $1
        AND a.started_on <= current_date
        AND (a.ended_on IS NULL OR a.ended_on >= current_date)
      ORDER BY a.is_primary DESC, u.path`,
    [personId],
  );
  return rows.map(toAssignment);
}

export async function selectAssignment(db: Client, id: string): Promise<AssignmentRow | undefined> {
  const { rows } = await db.query<RawAssignment>(`${ASSIGNMENT_SELECT} WHERE a.id = $1`, [id]);
  const row = rows[0];
  return row === undefined ? undefined : toAssignment(row);
}

export async function insertAssignment(
  db: Client,
  assignment: {
    readonly id: string; readonly personId: string; readonly positionId: string;
    readonly startedOn: string; readonly orderNumber: string | null;
    readonly isPrimary: boolean; readonly createdBy: string | null;
  },
): Promise<AssignmentRow> {
  await db.query(
    `INSERT INTO org.assignment (id, person_id, position_id, started_on, order_number, is_primary, created_by_person_id)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7)`,
    [
      assignment.id, assignment.personId, assignment.positionId, assignment.startedOn,
      assignment.orderNumber, assignment.isPrimary, assignment.createdBy,
    ],
  );
  const created = await selectAssignment(db, assignment.id);
  if (created === undefined) throw new Error('Назначение не создано.');
  return created;
}

export interface DelegationRow {
  readonly id: string;
  readonly delegatorAssignmentId: string;
  readonly delegateAssignmentId: string;
  readonly delegatorPositionName: string;
  readonly orderNumber: string;
  readonly startedOn: string;
  readonly endedOn: string;
}

/** Действующие замещения, где человек — замещающий (§ 5.2). */
export async function selectActiveDelegations(
  db: Client,
  delegateAssignmentId: string,
): Promise<readonly DelegationRow[]> {
  const { rows } = await db.query<{
    id: string; delegator_assignment_id: string; delegate_assignment_id: string;
    delegator_position_name: string; order_number: string; started_on: string; ended_on: string;
  }>(
    `SELECT d.id::text AS id,
            d.delegator_assignment_id::text AS delegator_assignment_id,
            d.delegate_assignment_id::text AS delegate_assignment_id,
            p.name AS delegator_position_name,
            d.order_number, d.started_on::text AS started_on, d.ended_on::text AS ended_on
       FROM org.delegation d
       JOIN org.assignment a ON a.id = d.delegator_assignment_id
       JOIN org.position p ON p.id = a.position_id
      WHERE d.delegate_assignment_id = $1
        AND d.is_revoked = false
        AND d.started_on <= current_date
        AND d.ended_on >= current_date
      ORDER BY d.started_on`,
    [delegateAssignmentId],
  );
  return rows.map((row) => ({
    id: row.id,
    delegatorAssignmentId: row.delegator_assignment_id,
    delegateAssignmentId: row.delegate_assignment_id,
    delegatorPositionName: row.delegator_position_name,
    orderNumber: row.order_number,
    startedOn: row.started_on,
    endedOn: row.ended_on,
  }));
}
