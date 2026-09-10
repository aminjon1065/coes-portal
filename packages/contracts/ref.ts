import { z } from 'zod';
import { uuid, pageParams, listOf } from './obshchee.ts';
import { SEVERITY_TOKENS } from './catalog-attributes.ts';

/** Справочники — docs/09-API.md § 8, docs/04-ДАННЫЕ.md § 5. */

/**
 * Код справочника — часть программы: заглавные латинские и подчёркивание,
 * без дефиса. Код элемента — данные, и дефис в нём обязателен. По этой
 * разнице проверка check:literals отличает допустимый литерал от нарушения
 * принципа П-1 (§ 5.1).
 */
export const CATALOG_CODE = /^[A-Z][A-Z_]{1,40}$/;
export const CATALOG_ITEM_CODE = /^[A-ZА-Я]{2,5}(-[0-9A-Z]{1,4})+$/u;

/** Календарная дата без времени: срок действия элемента — день, не момент. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const catalog = z.object({
  id: uuid,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isHierarchical: z.boolean(),
  isSystem: z.boolean(),
  /** Имена признаков, объявленных справочнику (§ 5.2). */
  attributeSchema: z.array(z.string()),
  itemCount: z.number().int().nonnegative(),
  /**
   * Число элементов, придуманных нами без нормативного подтверждения (Д-01).
   * Колонка существует специально: при внедрении должно быть видно, что
   * подлежит замене в первую очередь (docs/08-ЭКРАНЫ.md § 4, Э-030).
   */
  provisionalCount: z.number().int().nonnegative(),
  version: z.number().int(),
});

export const catalogListResponse = listOf(catalog);

export const catalogItem = z.object({
  id: uuid,
  catalogId: uuid,
  parentId: uuid.nullable(),
  code: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  isProvisional: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  attributes: z.record(z.unknown()),
  colorToken: z.enum(SEVERITY_TOKENS).nullable(),
  version: z.number().int(),
});

export const catalogItemListResponse = listOf(catalogItem);

/**
 * Условия отбора элементов. Подразделения у справочника нет, поэтому
 * общего `orgUnitId` здесь не бывает: неизвестный параметр — отказ, а не
 * молчаливое игнорирование (§ 3.2).
 */
export const catalogItemFilter = pageParams.extend({
  q: z.string().optional(),
  sort: z.string().optional(),
  /**
   * Неактивный элемент не предлагается в новых формах, но отображается
   * в существующих записях и в отчётах за прошлые периоды (§ 5.4, п. 2).
   */
  onlyActive: z.boolean().optional(),
});
