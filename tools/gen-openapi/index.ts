import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ENDPOINTS, API_BASE, FAILURE } from '@coes/contracts';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildOpenApi, serialize } from './core.ts';

/** pnpm gen:openapi — docs/09-API.md § 9, п. 2. */
const failure = zodToJsonSchema(FAILURE, { target: 'openApi3', $refStrategy: 'none' });
const document = buildOpenApi(ENDPOINTS, API_BASE, failure);
// Проверка check:generated запускает генератор в отдельный каталог и
// сравнивает вывод с закоммиченным файлом, поэтому корень вывода задаётся
// снаружи (docs/09-API.md § 9, п. 4).
const root = process.env['COES_GENERATED_OUT'] ?? '.';
const target = join(root, 'packages/contracts/openapi.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, serialize(document), 'utf8');
process.stdout.write(`gen:openapi — методов: ${String(ENDPOINTS.length)}\n`);
