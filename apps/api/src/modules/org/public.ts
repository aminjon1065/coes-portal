/** Единственный вход в модуль org извне (docs/03-АРХИТЕКТУРА.md § 3). */
export {
  createOrgUnit, listOrgUnits, createPosition, createPerson,
  createAssignment, createDelegation, activeAssignments, assignmentById, activeDelegations, personById,
} from './service.ts';
export type {
  CreateUnit, CreateAssignment, CreateDelegation,
  OrgUnitRow, PositionRow, PersonRow, AssignmentRow, DelegationRow,
} from './service.ts';

export const ORG_PERMISSIONS = {
  unitRead: 'org.unit.read',
  unitManage: 'org.unit.manage',
  positionManage: 'org.position.manage',
  personRead: 'org.person.read',
  personManage: 'org.person.manage',
  assignmentManage: 'org.assignment.manage',
  delegationCreate: 'org.delegation.create',
  delegationManageAny: 'org.delegation.manage_any',
} as const;
