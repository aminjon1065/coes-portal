import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { TOTAL_CAP, encodeCursor, decodeCursor, parseSort } from '@coes/contracts';
import {
  selectCatalogs, countCatalogs, selectCatalogByCode,
  selectCatalogItems, countCatalogItems, ITEM_SORT_COLUMNS,
} from './queries.ts';
import type { CatalogRow, CatalogItemRow } from './queries.ts';

/**
 * Прикладная логика модуля ref — справочники (docs/04-ДАННЫЕ.md § 5).
 *
 * Справочник читают все вошедшие: docs/05-ДОСТУП.md § 2 относит
 * ref.catalog.read к разрешениям, которые «есть у всех и в ролях не
 * перечисляются». Области видимости у справочника нет: он один на систему.
 */

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number;
  readonly totalIsExact: boolean;
}

export type Catalog = CatalogRow;
export type CatalogItem = CatalogItemRow;

function pageOf<T>(rows: readonly T[], counted: number, limit: number, cursorOf: (row: T) => string): Page<T> {
  // Строк запрошено на одну больше предела: лишняя не выдаётся, она лишь
  // отвечает на вопрос, есть ли следующая страница.
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last !== undefined ? cursorOf(last) : null,
    total: Math.min(counted, TOTAL_CAP),
    totalIsExact: counted <= TOTAL_CAP,
  };
}

export async function listCatalogs(
  db: Client,
  options: { readonly limit: number; readonly q?: string | undefined },
): Promise<Page<Catalog>> {
  const rows = await selectCatalogs(db, options);
  const counted = await countCatalogs(db, TOTAL_CAP, options.q);
  return {
    items: rows,
    nextCursor: null,
    total: Math.min(counted, TOTAL_CAP),
    totalIsExact: counted <= TOTAL_CAP,
  };
}

/**
 * Справочник по коду. Отсутствие — отказ NOT_FOUND с названным кодом:
 * пустой экран на опечатку в коде не объясняет пользователю ничего (adr/11).
 */
export async function catalogByCode(db: Client, code: string): Promise<Catalog> {
  const found = await selectCatalogByCode(db, code);
  if (found === undefined) {
    throw new AppError('NOT_FOUND', `Справочника с кодом «${code}» в системе нет.`);
  }
  return found;
}

export interface ItemFilter {
  readonly limit: number;
  readonly cursor?: string | undefined;
  readonly q?: string | undefined;
  readonly onlyActive?: boolean | undefined;
  readonly sort?: unknown;
}

export async function listCatalogItems(
  db: Client,
  code: string,
  filter: ItemFilter,
): Promise<Page<CatalogItem>> {
  const catalog = await catalogByCode(db, code);
  // Порядок по умолчанию — заданный администратором (§ 5, sort_order),
  // а не алфавитный: порядок элементов справочника осмыслен сам по себе.
  const sort = parseSort(filter.sort, ITEM_SORT_COLUMNS, { field: 'sortOrder', descending: false });
  const rows = await selectCatalogItems(db, {
    catalogId: catalog.id,
    limit: filter.limit,
    after: filter.cursor === undefined ? undefined : decodeCursor(filter.cursor),
    q: filter.q,
    onlyActive: filter.onlyActive,
    sortColumn: sort.column,
    descending: sort.descending,
  });
  const counted = await countCatalogItems(db, {
    catalogId: catalog.id,
    cap: TOTAL_CAP,
    q: filter.q,
    onlyActive: filter.onlyActive,
  });
  return pageOf(rows, counted, filter.limit, (item) =>
    encodeCursor({ sortValue: sortValueOf(item, sort.field), id: item.id }));
}

/**
 * Значение, по которому продолжается страница. Оно обязано совпадать с
 * колонкой сортировки: иначе курсор укажет не туда и часть строк
 * потеряется — молча, без единой ошибки.
 */
function sortValueOf(item: CatalogItem, field: string): string {
  switch (field) {
    case 'code':
      return item.code;
    case 'name':
      return item.name;
    default:
      return String(item.sortOrder);
  }
}
