import { z } from 'zod';
import { isoDateTime } from './obshchee.ts';

/** Настройки и состояние сервера — docs/09-API.md § 8, модуль sys. */

/**
 * Настройка — данные, а не код: перечень ключей приходит из базы.
 * Значение хранится строкой, потому что реестр пределов и настроек един
 * для чисел, строк и признаков (docs/03-АРХИТЕКТУРА.md § 6).
 */
export const setting = z.object({
  key: z.string(),
  value: z.string(),
  updatedAt: isoDateTime.nullable(),
});

export const settingsResponse = z.object({
  items: z.array(setting),
});

export const settingsUpdateRequest = z.object({
  items: z.array(z.object({ key: z.string(), value: z.string() })).min(1),
});

export const systemStatusResponse = z.object({
  /** Версия сборки. Собирается при развёртывании, в коде не хранится. */
  version: z.string(),
  /** Профиль пределов: local или server (§ 6). */
  deployProfile: z.enum(['local', 'server']),
  databaseOk: z.boolean(),
  /** Свободное место под данными: указатель § 9.11 читает отсюда. */
  diskFreeBytes: z.number().int().nonnegative(),
  diskTotalBytes: z.number().int().nonnegative(),
  /** Последняя применённая миграция: расхождение видно сразу. */
  lastMigration: z.string().nullable(),
  startedAt: isoDateTime,
});
