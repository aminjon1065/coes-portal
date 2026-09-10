import type { Client } from 'pg';

/** Обращения к базе модуля ref. Наружу через public.ts не выходят (§ 3). */

export interface CatalogRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isHierarchical: boolean;
  readonly isSystem: boolean;
  readonly attributeSchema: readonly string[];
  readonly itemCount: number;
  readonly provisionalCount: number;
  readonly version: number;
}

export interface CatalogItemRow {
  readonly id: string;
  readonly catalogId: string;
  readonly parentId: string | null;
  readonly code: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly isProvisional: boolean;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly colorToken: string | null;
  readonly version: number;
}

/**
 * Число элементов и число временных считаются здесь же, одним запросом:
 * колонка «временных» существует ради того, чтобы при внедрении было видно,
 * что подлежит замене (docs/08-ЭКРАНЫ.md § 4, Э-030), и отдельным запросом
 * на строку она обошлась бы в N обращений к базе.
 */
const CATALOG_COLUMNS = `
  c.id, c.code, c.name, c.description, c.is_hierarchical, c.is_system,
  c.attribute_schema, c.version,
  coalesce(n.item_count, 0)        AS item_count,
  coalesce(n.provisional_count, 0) AS provisional_count`;

const CATALOG_COUNTS = `
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS item_count,
           count(*) FILTER (WHERE i.is_provisional)::int AS provisional_count
      FROM ref.catalog_item i
     WHERE i.catalog_id = c.id
  ) n ON true`;

interface RawCatalog {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_hierarchical: boolean;
  is_system: boolean;
  attribute_schema: unknown;
  item_count: number;
  provisional_count: number;
  version: number;
}

function toCatalog(row: RawCatalog): CatalogRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isHierarchical: row.is_hierarchical,
    isSystem: row.is_system,
    attributeSchema: Array.isArray(row.attribute_schema)
      ? row.attribute_schema.map((value) => String(value))
      : [],
    itemCount: row.item_count,
    provisionalCount: row.provisional_count,
    version: row.version,
  };
}

export async function selectCatalogs(
  db: Client,
  options: { readonly limit: number; readonly q?: string | undefined },
): Promise<readonly CatalogRow[]> {
  const { rows } = await db.query<RawCatalog>(
    `SELECT ${CATALOG_COLUMNS}
       FROM ref.catalog c ${CATALOG_COUNTS}
      WHERE ($2::text IS NULL OR public.tj_norm(c.name) LIKE '%' || public.tj_norm($2) || '%')
      ORDER BY c.name
      LIMIT $1`,
    [options.limit, options.q ?? null],
  );
  return rows.map(toCatalog);
}

/**
 * Подсчёт с потолком (docs/09-API.md § 3.1): считаются не все строки, а на
 * одну больше потолка — этого достаточно, чтобы отличить точное число от
 * «более чем», и не заставляет базу пересчитывать полмиллиона строк.
 */
export async function countCatalogs(db: Client, cap: number, q?: string): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM (
       SELECT 1 FROM ref.catalog c
        WHERE ($2::text IS NULL OR public.tj_norm(c.name) LIKE '%' || public.tj_norm($2) || '%')
        LIMIT $1
     ) counted`,
    [cap + 1, q ?? null],
  );
  return rows[0]?.total ?? 0;
}

export async function selectCatalogByCode(db: Client, code: string): Promise<CatalogRow | undefined> {
  const { rows } = await db.query<RawCatalog>(
    `SELECT ${CATALOG_COLUMNS} FROM ref.catalog c ${CATALOG_COUNTS} WHERE c.code = $1`,
    [code],
  );
  const row = rows[0];
  return row === undefined ? undefined : toCatalog(row);
}

/** Поля, по которым разрешено упорядочивать элементы (docs/09-API.md § 3.2). */
export const ITEM_SORT_COLUMNS: Readonly<Record<string, string>> = {
  sortOrder: 'i.sort_order',
  code: 'i.code',
  name: 'i.name',
};

interface RawItem {
  id: string;
  catalog_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  short_name: string | null;
  sort_order: number;
  is_active: boolean;
  is_provisional: boolean;
  valid_from: Date | null;
  valid_to: Date | null;
  attributes: unknown;
  color_token: string | null;
  version: number;
}

/** Дата без времени: срок действия элемента — день, а не момент. */
function asDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

function toItem(row: RawItem): CatalogItemRow {
  return {
    id: row.id,
    catalogId: row.catalog_id,
    parentId: row.parent_id,
    code: row.code,
    name: row.name,
    shortName: row.short_name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isProvisional: row.is_provisional,
    validFrom: asDate(row.valid_from),
    validTo: asDate(row.valid_to),
    attributes:
      typeof row.attributes === 'object' && row.attributes !== null
        ? (row.attributes as Record<string, unknown>)
        : {},
    colorToken: row.color_token,
    version: row.version,
  };
}

export interface ItemQuery {
  readonly catalogId: string;
  readonly limit: number;
  readonly after?: { readonly sortValue: string; readonly id: string } | undefined;
  readonly q?: string | undefined;
  readonly onlyActive?: boolean | undefined;
  readonly sortColumn: string;
  readonly descending: boolean;
}

/**
 * Страница элементов. Запрашивается на одну строку больше запрошенного:
 * так и становится известно, есть ли следующая страница, без отдельного
 * запроса и без смещения (docs/09-API.md § 3.1).
 */
export async function selectCatalogItems(
  db: Client,
  query: ItemQuery,
): Promise<readonly CatalogItemRow[]> {
  const direction = query.descending ? 'DESC' : 'ASC';
  const comparison = query.descending ? '<' : '>';
  const { rows } = await db.query<RawItem>(
    `SELECT i.id, i.catalog_id, i.parent_id, i.code, i.name, i.short_name, i.sort_order,
            i.is_active, i.is_provisional, i.valid_from, i.valid_to, i.attributes,
            i.color_token, i.version
       FROM ref.catalog_item i
      WHERE i.catalog_id = $1
        AND ($3::boolean IS NOT TRUE OR i.is_active)
        AND ($4::text IS NULL OR i.name_norm LIKE '%' || public.tj_norm($4) || '%')
        AND ($5::text IS NULL OR (${query.sortColumn}::text, i.id::text) ${comparison} ($5, $6))
      ORDER BY ${query.sortColumn} ${direction}, i.id ${direction}
      LIMIT $2`,
    [
      query.catalogId,
      query.limit + 1,
      query.onlyActive ?? null,
      query.q ?? null,
      query.after?.sortValue ?? null,
      query.after?.id ?? null,
    ],
  );
  return rows.map(toItem);
}

export async function countCatalogItems(
  db: Client,
  query: {
    readonly catalogId: string;
    readonly cap: number;
    readonly q?: string | undefined;
    readonly onlyActive?: boolean | undefined;
  },
): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM (
       SELECT 1 FROM ref.catalog_item i
        WHERE i.catalog_id = $1
          AND ($3::boolean IS NOT TRUE OR i.is_active)
          AND ($4::text IS NULL OR i.name_norm LIKE '%' || public.tj_norm($4) || '%')
        LIMIT $2
     ) counted`,
    [query.catalogId, query.cap + 1, query.onlyActive ?? null, query.q ?? null],
  );
  return rows[0]?.total ?? 0;
}
