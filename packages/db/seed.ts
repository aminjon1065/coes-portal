import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { connect } from './connect.ts';

export const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), 'seed');

/**
 * Начальное наполнение (docs/04-ДАННЫЕ.md § 12). Применяется отдельной
 * командой, а не миграцией: это данные, которые администратор потом заменит,
 * а не схема. Все элементы помечаются is_provisional — «придумано нами».
 *
 * Идемпотентно: повторное применение ничего не дублирует.
 *
 * Порядок применения задаётся НОМЕРОМ в имени файла, а не алфавитом:
 * оргструктура ссылается на справочник должностей, и при алфавитном порядке
 * она применялась бы раньше него — молча, без единой ошибки, просто ничего
 * бы не создалось.
 */
export async function seed(url?: string): Promise<string[]> {
  const client = url === undefined ? await connect() : await connect(url);
  try {
    const files = readdirSync(SEED_DIR)
      .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
      .sort();
    if (files.length === 0) {
      throw new Error(`В ${SEED_DIR} нет файлов наполнения вида NNNN_имя.sql.`);
    }
    for (const file of files) {
      await client.query(readFileSync(join(SEED_DIR, file), 'utf8'));
    }
    return files;
  } finally {
    await client.end();
  }
}

// Запуск как команда: pnpm run db:seed
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await seed();
  console.log(`Начальное наполнение применено: ${files.join(', ')}.`);
}
