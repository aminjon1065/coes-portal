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
 */
export async function seed(url?: string): Promise<string[]> {
  const client = url === undefined ? await connect() : await connect(url);
  try {
    const files = readdirSync(SEED_DIR).filter((f) => f.endsWith('.sql')).sort();
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
