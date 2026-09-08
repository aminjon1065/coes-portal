/** Столбец базы, подлежащий проверке (docs/03-АРХИТЕКТУРА.md § 5.14). */
export interface ColumnRef {
  readonly schema: string;
  readonly table: string;
  readonly column: string;
}

export interface UrlViolation {
  readonly column: ColumnRef;
  readonly value: string;
}

const ABSOLUTE_URL = /^https?:\/\//i;

/** Полное имя столбца в виде «схема.таблица.столбец». */
export function columnName(column: ColumnRef): string {
  return `${column.schema}.${column.table}.${column.column}`;
}

/**
 * Перечень разрешённых задаёт ИСКЛЮЧЕНИЯ, а не охват: новый столбец
 * попадает под проверку автоматически (принцип П-5).
 */
export function isAllowed(column: ColumnRef, allowlist: readonly string[]): boolean {
  return allowlist.includes(columnName(column));
}

/** Столбцы, которые нужно прочитать: всё, кроме разрешённых. */
export function planColumnScan(
  columns: readonly ColumnRef[],
  allowlist: readonly string[],
): ColumnRef[] {
  return columns.filter((column) => !isAllowed(column, allowlist));
}

/** Нарушением считается сохранённый абсолютный адрес вне перечня исключений. */
export function findUrlViolations(
  rows: readonly { readonly column: ColumnRef; readonly value: string }[],
  allowlist: readonly string[],
): UrlViolation[] {
  return rows
    .filter((row) => !isAllowed(row.column, allowlist) && ABSOLUTE_URL.test(row.value))
    .map((row) => ({ column: row.column, value: row.value }));
}
