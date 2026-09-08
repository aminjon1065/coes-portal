import { existsSync, readFileSync, globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkComposeText, type DeployProblem } from './core.ts';

/** Файлы сборки сред (docs/03-АРХИТЕКТУРА.md § 2). */
const COMPOSE_FILES = [
  'deploy/compose/compose.prod.yml',
  'deploy/compose/compose.test.yml',
  'deploy/local/compose.local.yml',
];
const CADDY_TEMPLATE = 'deploy/caddy/Caddyfile.tmpl';

const problems: DeployProblem[] = [];

for (const file of COMPOSE_FILES) {
  if (!existsSync(file)) continue;
  problems.push(...checkComposeText(file, readFileSync(file, 'utf8')));
}

if (existsSync(CADDY_TEMPLATE)) {
  const text = readFileSync(CADDY_TEMPLATE, 'utf8');
  if (!text.includes('{{')) {
    problems.push({
      file: CADDY_TEMPLATE,
      message: 'нет ни одной подстановки: имя узла обязано браться из BASE_URL (§ 5.14)',
    });
  }
}

const scripts = existsSync('deploy') ? globSync('deploy/**/*.sh') : [];
for (const script of scripts) {
  try {
    execFileSync('bash', ['-n', script], { stdio: 'pipe' });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : String(error);
    problems.push({ file: script, message: `ошибка синтаксиса: ${stderr.trim()}` });
  }
}

const checked = COMPOSE_FILES.filter((f) => existsSync(f)).length + scripts.length;

if (problems.length > 0) {
  for (const p of problems) console.error(`${p.file} — ${p.message}`);
  console.error(`\ncheck:deploy — нарушений: ${problems.length}`);
  process.exit(1);
}

console.log(`check:deploy — проверено файлов: ${checked}, нарушений: 0`);
