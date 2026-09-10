import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENDPOINTS, API_BASE } from '@coes/contracts';
import { buildClient, buildSchemas } from './core.ts';

/** pnpm gen:client — docs/09-API.md § 9, п. 3. */
// Корень вывода задаётся снаружи: check:generated сравнивает вывод
// генератора с закоммиченным файлом (docs/09-API.md § 9, п. 4).
const root = process.env['COES_GENERATED_OUT'] ?? '.';
const dir = join(root, 'apps/web/src/api');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'schemas.ts'), buildSchemas(ENDPOINTS), 'utf8');
writeFileSync(join(dir, 'client.ts'), buildClient(ENDPOINTS, API_BASE), 'utf8');
process.stdout.write(`gen:client — методов: ${String(ENDPOINTS.length)}\n`);
