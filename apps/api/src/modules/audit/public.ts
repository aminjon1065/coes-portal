/** Единственный вход в модуль audit извне (docs/03-АРХИТЕКТУРА.md § 3). */
export { record, listEvents } from './service.ts';
export type { Actor, AuditEntity, AuditChange, AuditRow } from './service.ts';

export const AUDIT_PERMISSIONS = {
  readAll: 'audit.event.read_all',
  verify: 'audit.event.verify',
} as const;
