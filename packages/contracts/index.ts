/** Схемы запросов и ответов — docs/09-API.md. Описаны один раз (П-2). */
export * from './obshchee.ts';
export * from './auth.ts';
export * from './sys.ts';
export * from './org.ts';
export * from './iam-schema.ts';
export * from './catalog-attributes.ts';
export * from './ref.ts';
export * from './registry.ts';
export * from './routing.ts';
export { PERMISSIONS, PERMISSION_CODE, PERMISSION_CODES, isPermissionCode } from './permissions.ts';
export type { Permission } from './permissions.ts';
