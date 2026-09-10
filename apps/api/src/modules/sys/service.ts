import { statfsSync } from 'node:fs';
import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { now } from '@coes/core/clock.ts';
import { currentProfile } from '@coes/core/profile.ts';
import { LIMITS } from '@coes/core/limits.ts';
import { selectSettings, selectKnownKeys, upsertSetting, selectLastMigration } from './queries.ts';

/** Прикладная логика модуля sys — настройки и состояние сервера. */

export interface Setting {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string | null;
}

export async function listSettings(db: Client): Promise<readonly Setting[]> {
  return selectSettings(db);
}

/**
 * Настройка, которой нет ни в таблице настроек, ни в реестре пределов, не
 * создаётся молча: неизвестный ключ — это опечатка, а принятая опечатка
 * означает, что настройка не действует и никто об этом не знает
 * (docs/09-API.md § 3.2).
 *
 * Ключи реестра пределов допустимы даже без строки в таблице: § 5.11
 * задаёт порядок «окружение → строка настройки → умолчание реестра», и
 * строка появляется именно в тот момент, когда предел переопределяют.
 */
export async function saveSettings(
  db: Client,
  items: readonly { readonly key: string; readonly value: string }[],
): Promise<readonly Setting[]> {
  const known = new Set([
    ...(await selectKnownKeys(db)),
    ...LIMITS.map((limit) => limit.key),
  ]);
  const unknown = items.filter((item) => !known.has(item.key)).map((item) => item.key);
  if (unknown.length > 0) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Неизвестная настройка: ${unknown.join(', ')}. Настройки создаются миграцией, а пределы объявляются в реестре.`,
      { fields: unknown.map((key) => ({ path: key, message: 'Настройки с таким ключом нет' })) },
    );
  }
  for (const item of items) await upsertSetting(db, item.key, item.value);
  return selectSettings(db);
}

export interface SystemStatus {
  readonly version: string;
  readonly deployProfile: 'local' | 'server';
  readonly databaseOk: boolean;
  readonly diskFreeBytes: number;
  readonly diskTotalBytes: number;
  readonly lastMigration: string | null;
  readonly startedAt: string;
}

/** Момент старта. Считается один раз: он не меняется по ходу работы. */
const STARTED_AT = now().toISOString();

export async function systemStatus(db: Client, dataPath: string): Promise<SystemStatus> {
  const stat = statfsSync(dataPath);
  let databaseOk = true;
  let lastMigration: string | null = null;
  try {
    lastMigration = await selectLastMigration(db);
  } catch {
    // Неудавшийся запрос не скрывается: он и есть ответ на вопрос
    // о состоянии базы (docs/06 § 13 п. 24).
    databaseOk = false;
  }
  return {
    version: process.env['COES_VERSION'] ?? 'dev',
    deployProfile: currentProfile(),
    databaseOk,
    diskFreeBytes: Number(stat.bsize) * Number(stat.bavail),
    diskTotalBytes: Number(stat.bsize) * Number(stat.blocks),
    lastMigration,
    startedAt: STARTED_AT,
  };
}
