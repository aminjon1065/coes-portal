import { existsSync, readFileSync, globSync } from 'node:fs';
import { checkLimits, type LimitEntry } from './core.ts';

const REGISTRY = 'packages/core/limits.ts';

/**
 * Пустой набор входов — успех (docs/03-АРХИТЕКТУРА.md § 10): пока реестр
 * пределов не объявлен, проверять нечего, и это не ошибка инструмента.
 */
let registry: readonly LimitEntry[] = [];
if (existsSync(REGISTRY)) {
  const module: unknown = await import(`../../${REGISTRY}`);
  const exported = (module as { LIMITS?: unknown }).LIMITS;
  if (!Array.isArray(exported)) {
    console.error(`${REGISTRY}: ожидался экспорт LIMITS — массив записей реестра пределов.`);
    process.exit(1);
  }
  registry = exported as readonly LimitEntry[];
}

const sourceFiles = globSync(['apps/**/src/**/*.{ts,tsx}', 'packages/**/src/**/*.{ts,tsx}'], {
  exclude: (name) => name.includes('node_modules'),
});
const sources = sourceFiles.map((file) => readFileSync(file, 'utf8'));

const violations = checkLimits(registry, sources);
if (violations.length > 0) {
  for (const v of violations) {
    console.error(`${v.key} — ${v.reason} (docs/03-АРХИТЕКТУРА.md § 6).`);
  }
  console.error(`\ncheck:limits — нарушений: ${violations.length}`);
  process.exit(1);
}

console.log(`check:limits — пределов в реестре: ${registry.length}, нарушений: 0`);
