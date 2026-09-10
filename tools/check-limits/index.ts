import { existsSync, readdirSync, readFileSync, globSync } from 'node:fs';
import { checkLimits, pendingLimits, type LimitEntry } from './core.ts';

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

/**
 * Сам реестр из просмотра исключён: иначе каждый предел «применялся» бы
 * в собственном объявлении. Проверки тоже исключены: предел, применённый
 * только в проверке, нигде не применяется.
 */
const sourceFiles = globSync(['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'tools/**/*.ts'], {
  exclude: (name) => name.includes('node_modules')
    || name.endsWith('limits.ts')
    || name.endsWith('.test.ts')
    || name.includes('/test/')
    || name.includes('check-limits'),
});
const sources = sourceFiles.map((file) => readFileSync(file, 'utf8'));

/**
 * Построенные модули выводятся из состава репозитория, а не из настройки:
 * иначе перечень стал бы флагом «проверять или нет», а таких флагов
 * контракт не допускает (docs/00-КОНТРАКТ.md § П-4).
 */
const builtModules: string[] = [];
if (existsSync('apps/api/src')) builtModules.push('api');
if (existsSync('apps/web/src')) builtModules.push('web');
if (existsSync('apps/worker/src')) builtModules.push('worker');
if (existsSync('apps/api/src/modules')) {
  for (const name of readdirSync('apps/api/src/modules')) builtModules.push(name);
}

const violations = checkLimits(registry, sources, builtModules);
if (violations.length > 0) {
  for (const v of violations) {
    console.error(`${v.key} — ${v.reason} (docs/03-АРХИТЕКТУРА.md § 6).`);
  }
  console.error(`\ncheck:limits — нарушений: ${violations.length}`);
  process.exit(1);
}

const pending = pendingLimits(registry, builtModules);
console.log(
  `check:limits — пределов в реестре: ${String(registry.length)}, `
  + `построенных модулей: ${builtModules.join(', ')}, `
  + `ждут своего модуля: ${String(pending.length)}, нарушений: 0`,
);
if (pending.length > 0) {
  console.log(`  ждут: ${pending.join(', ')}`);
}
