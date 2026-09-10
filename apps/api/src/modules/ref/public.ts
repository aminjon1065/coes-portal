/** Единственный вход в модуль ref извне (docs/03-АРХИТЕКТУРА.md § 3). */
export { listCatalogs, catalogByCode, listCatalogItems } from './service.ts';
export type { Catalog, CatalogItem, ItemFilter, Page } from './service.ts';

export const REF_PERMISSIONS = {
  catalogManage: 'ref.catalog.manage',
} as const;
