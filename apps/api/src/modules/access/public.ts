/** Единственный вход в модуль access извне (docs/03-АРХИТЕКТУРА.md § 3). */
export {
  workContext, assignmentForLogin, permissionsOf, visibleUnitsOf,
  requirePermission, requireInScope, grantRole, revokeRole, grantScope, listRoles,
} from './service.ts';
export type { WorkContext } from './service.ts';

export const ACCESS_PERMISSIONS = {
  roleRead: 'access.role.read',
  roleManage: 'access.role.manage',
  grantManage: 'access.grant.manage',
  scopeManage: 'access.scope.manage',
} as const;
