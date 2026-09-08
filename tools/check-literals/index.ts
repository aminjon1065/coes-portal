import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { findCatalogCodeLiterals, type LiteralViolation } from './core.ts';

/**
 * Проверяемые каталоги заданы контрактом (docs/00-КОНТРАКТ.md § 2, П-1).
 * Начальное наполнение справочников (packages/db/seed) в них не входит:
 * там коды элементов и должны быть.
 */
const SCANNED = [
  'apps/api/src/**/*.{ts,tsx}',
  'apps/web/src/**/*.{ts,tsx}',
  'apps/worker/src/**/*.{ts,tsx}',
];

const files = SCANNED.flatMap((pattern) =>
  globSync(pattern, { exclude: (name) => name.includes('node_modules') }),
);

const violations: LiteralViolation[] = files.flatMap((file) =>
  findCatalogCodeLiterals(file, readFileSync(file, 'utf8')),
);

if (violations.length > 0) {
  for (const v of violations) {
    console.error(
      `${v.file}:${v.line}  код элемента справочника «${v.value}» в коде программы. ` +
        'Ветвление по коду запрещено принципом П-1: используйте признак элемента.',
    );
  }
  console.error(`\ncheck:literals — нарушений: ${violations.length}`);
  process.exit(1);
}

console.log(`check:literals — проверено файлов: ${files.length}, нарушений: 0`);
