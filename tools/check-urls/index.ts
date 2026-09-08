import { existsSync, globSync } from 'node:fs';
import { connect } from '../../packages/db/connect.ts';
import { URL_ALLOWLIST } from '../../packages/db/url-allowlist.ts';
import { findUrlViolations, planColumnScan, columnName, type ColumnRef } from './core.ts';

/**
 * Принцип П-5: абсолютный адрес системы не хранится в данных.
 *
 * Входом проверки являются столбцы базы, а база описывается миграциями.
 * Пока миграций нет, столбцов нет — набор входов пуст, и это успех
 * (docs/03-АРХИТЕКТУРА.md § 10). Как только миграции появились, инструмент
 * ОБЯЗАН подключиться к базе: молчаливый успех без подключения запрещён.
 */
const MIGRATIONS = 'packages/db/migrations';

const migrations = existsSync(MIGRATIONS) ? globSync(`${MIGRATIONS}/*.sql`) : [];
if (migrations.length === 0) {
  console.log('check:urls — миграций нет, проверяемых столбцов нет, нарушений: 0');
  process.exit(0);
}

const client = await connect();
try {
  // Охват — ВСЕ текстовые и jsonb-столбцы прикладных схем. Перечень
  // разрешённых задаёт исключения, поэтому новый столбец покрывается сам.
  const { rows: columns } = await client.query<ColumnRef>(`
    SELECT table_schema AS schema, table_name AS table, column_name AS column
    FROM information_schema.columns c
    WHERE c.data_type IN ('character varying', 'text', 'character', 'json', 'jsonb')
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema', 'topology', 'tiger', 'tiger_data')
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = c.table_schema AND t.table_name = c.table_name
          AND t.table_type = 'BASE TABLE'
      )
    ORDER BY 1, 2, 3
  `);

  const scanned = planColumnScan(columns, URL_ALLOWLIST);
  const rows: { column: ColumnRef; value: string }[] = [];

  for (const column of scanned) {
    const { rows: found } = await client.query<{ value: string }>(
      `SELECT "${column.column}"::text AS value
       FROM "${column.schema}"."${column.table}"
       WHERE "${column.column}"::text ~* '^https?://'
       LIMIT 5`,
    );
    for (const row of found) rows.push({ column, value: row.value });
  }

  const violations = findUrlViolations(rows, URL_ALLOWLIST);
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${columnName(violation.column)} — сохранён абсолютный адрес «${violation.value}». ` +
          'Ссылки хранятся относительными путями, полный адрес собирается из BASE_URL (принцип П-5).',
      );
    }
    console.error(`\ncheck:urls — нарушений: ${violations.length}`);
    process.exit(1);
  }

  console.log(
    `check:urls — проверено столбцов: ${scanned.length} из ${columns.length}, ` +
      `в перечне исключений: ${columns.length - scanned.length}, нарушений: 0`,
  );
} finally {
  await client.end();
}
