import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Endpoint } from '@coes/contracts';

/**
 * Построение OpenAPI из единственного описания методов — docs/09-API.md § 9.
 * Функция чистая: она ничего не читает и не пишет, поэтому проверяема.
 */

interface OpenApiDocument {
  readonly openapi: string;
  readonly info: { readonly title: string; readonly version: string };
  readonly paths: Record<string, Record<string, unknown>>;
  readonly components: { readonly schemas: Record<string, unknown> };
}

const PATH_PARAM = /\{([a-zA-Z]+)\}/gu;

function schemaOf(value: unknown): unknown {
  return zodToJsonSchema(value as never, { target: 'openApi3', $refStrategy: 'none' });
}

export function buildOpenApi(
  endpoints: readonly Endpoint[],
  base: string,
  failure: unknown,
): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of endpoints) {
    const full = base + endpoint.path;
    const parameters: unknown[] = [];
    for (const match of endpoint.path.matchAll(PATH_PARAM)) {
      parameters.push({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      });
    }
    if (endpoint.query !== undefined) {
      parameters.push({ name: 'query', in: 'query', required: false, schema: schemaOf(endpoint.query) });
    }

    const operation: Record<string, unknown> = {
      operationId: endpoint.name,
      summary: endpoint.summary,
      // Требуемое разрешение — часть описания метода, а не примечание:
      // по нему видно, что метод без прав не бывает (§ 10, п. 2).
      'x-permission': endpoint.permission,
      responses: {
        200: {
          description: 'Успех',
          content: { 'application/json': { schema: schemaOf(endpoint.response) } },
        },
        default: {
          description: 'Отказ',
          content: { 'application/json': { schema: failure } },
        },
      },
    };
    if (parameters.length > 0) operation['parameters'] = parameters;
    if (endpoint.request !== undefined) {
      operation['requestBody'] = {
        required: true,
        content: { 'application/json': { schema: schemaOf(endpoint.request) } },
      };
    }

    paths[full] = { ...paths[full], [endpoint.method.toLowerCase()]: operation };
  }

  return {
    openapi: '3.1.0',
    info: { title: 'Платформа КЧС', version: 'v1' },
    paths,
    components: { schemas: {} },
  };
}

/** Побайтовое сравнение требует устойчивого вывода: ключи и отступ заданы. */
export function serialize(document: OpenApiDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
