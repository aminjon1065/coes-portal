import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareGenerated } from './core.ts';
import { GENERATED } from './manifest.ts';

/**
 * Пустой перечень — успех (docs/03-АРХИТЕКТУРА.md § 10): генераторов ещё нет,
 * сравнивать нечего. Как только запись появится, шаг начнёт запускать
 * генератор и сравнивать вывод с закоммиченным файлом.
 */
if (GENERATED.length === 0) {
  console.log('check:generated — генерируемых артефактов не объявлено, расхождений: 0');
  process.exit(0);
}

const workDir = mkdtempSync(join(tmpdir(), 'coes-generated-'));
try {
  const entries = GENERATED.map((artifact) => {
    execFileSync('sh', ['-c', artifact.command], { stdio: 'inherit', env: { ...process.env, COES_GENERATED_OUT: workDir } });
    return {
      artifact,
      committed: existsSync(artifact.path) ? readFileSync(artifact.path, 'utf8') : null,
      produced: readFileSync(join(workDir, artifact.path), 'utf8'),
    };
  });

  const mismatches = compareGenerated(entries);
  if (mismatches.length > 0) {
    for (const m of mismatches) {
      console.error(`${m.path} — ${m.reason}. Выполните генерацию и закоммитьте результат (П-2).`);
    }
    console.error(`\ncheck:generated — расхождений: ${mismatches.length}`);
    process.exit(1);
  }
  console.log(`check:generated — артефактов: ${GENERATED.length}, расхождений: 0`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
