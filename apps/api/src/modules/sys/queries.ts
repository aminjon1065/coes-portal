import type { Client } from 'pg';

/** Обращения к базе модуля sys. Наружу через public.ts не выходят (§ 3). */

export interface SettingRow {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string | null;
}

export async function selectSettings(db: Client): Promise<readonly SettingRow[]> {
  const { rows } = await db.query<{ key: string; value: string; updated_at: Date | null }>(
    'SELECT key, value, updated_at FROM sys.setting ORDER BY key',
  );
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at === null ? null : row.updated_at.toISOString(),
  }));
}

export async function selectKnownKeys(db: Client): Promise<readonly string[]> {
  const { rows } = await db.query<{ key: string }>('SELECT key FROM sys.setting');
  return rows.map((row) => row.key);
}

/**
 * Запись значения. Для предела строки может ещё не быть: § 5.11 говорит,
 * что значение по умолчанию живёт в реестре, а строка в настройках
 * появляется тогда, когда его переопределяют.
 */
export async function upsertSetting(db: Client, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO sys.setting (key, value, is_editable)
     VALUES ($1, $2, true)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`,
    [key, value],
  );
}

export async function selectLastMigration(db: Client): Promise<string | null> {
  const { rows } = await db.query<{ name: string }>(
    'SELECT name FROM sys.migration ORDER BY version DESC LIMIT 1',
  );
  return rows[0]?.name ?? null;
}
