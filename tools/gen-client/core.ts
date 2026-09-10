import type { Endpoint } from '@coes/contracts';

/**
 * Построение клиента из единственного описания методов — docs/09-API.md § 9.
 *
 * Клиент выводит адрес из текущей страницы и никогда не хранит полный:
 * иначе переезд на другой домен потребовал бы пересборки (принцип П-5).
 */

const PATH_PARAM = /\{([a-zA-Z]+)\}/gu;

function paramsOf(path: string): readonly string[] {
  return [...path.matchAll(PATH_PARAM)].map((match) => String(match[1]));
}

function signature(endpoint: Endpoint): string {
  const parts = paramsOf(endpoint.path).map((name) => `${name}: string`);
  if (endpoint.query !== undefined) parts.push('query?: Record<string, string | number | boolean>');
  if (endpoint.request !== undefined) parts.push(`body: In<typeof schemas.${endpoint.name}Request>`);
  return parts.join(', ');
}

function pathExpression(path: string): string {
  const replaced = path.replace(PATH_PARAM, (_all, name: string) => `\${encodeURIComponent(${name})}`);
  return `\`${replaced}\``;
}

export function buildClient(endpoints: readonly Endpoint[], base: string): string {
  const imports: string[] = [];
  const methods: string[] = [];

  for (const endpoint of endpoints) {
    if (endpoint.request !== undefined) {
      imports.push(`${endpoint.name}Request`);
    }
    imports.push(`${endpoint.name}Response`);
    const args = signature(endpoint);
    const bodyArg = endpoint.request === undefined ? 'undefined' : 'body';
    const queryArg = endpoint.query === undefined ? 'undefined' : 'query';
    methods.push(
      `  /** ${endpoint.summary} */\n`
      + `  ${endpoint.name}: (${args}): Promise<Out<typeof schemas.${endpoint.name}Response>> =>\n`
      + `    request(schemas.${endpoint.name}Response, '${endpoint.method}', ${pathExpression(endpoint.path)}, ${bodyArg}, ${queryArg}),`,
    );
  }

  return `/*
 * СГЕНЕРИРОВАНО. Правки здесь пропадут: источник — packages/contracts,
 * порождающая команда — pnpm gen:client (docs/09-API.md § 9).
 *
 * Обращение к серверу мимо этого клиента запрещено правилом линтера
 * coes/no-raw-http-client.
 */
import type { z } from 'zod';
import * as schemas from './schemas.ts';

type In<T extends z.ZodTypeAny> = z.input<T>;
type Out<T extends z.ZodTypeAny> = z.output<T>;

/** Основание пути. Полный адрес собирается из адреса страницы (П-5). */
export const API_BASE = '${base}';

export interface ApiFailure {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly requestId: string;
}

export class ApiError extends Error {
  readonly failure: ApiFailure;
  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiError';
    this.failure = failure;
  }
}

function csrfToken(): string {
  const found = document.cookie.split('; ').find((part) => part.startsWith('X-CSRF-Token='));
  return found === undefined ? '' : decodeURIComponent(found.slice('X-CSRF-Token='.length));
}

async function request<T extends z.ZodTypeAny>(
  schema: T,
  method: string,
  path: string,
  body: unknown,
  query: Record<string, string | number | boolean> | undefined,
): Promise<Out<T>> {
  const url = new URL(API_BASE + path, window.location.origin);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    // Идемпотентность создающих запросов — заголовок формирует клиент (§ 4.1).
    if (method === 'POST') headers['Idempotency-Key'] = crypto.randomUUID();
  }
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken();

  const answer = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload: unknown = await answer.json();
  if (!answer.ok) {
    const failure = (payload as { error?: ApiFailure }).error;
    throw new ApiError(failure ?? {
      code: 'INTERNAL',
      message: 'Не удалось связаться с сервером. Проверьте подключение к сети и повторите.',
      details: {},
      requestId: '',
    });
  }
  return schema.parse(payload) as Out<T>;
}

export const api = {
${methods.join('\n')}
};

export type { ${[...new Set(imports)].join(', ')} } from './schemas.ts';
`;
}

/** Схемы клиента — те же самые, без переписывания (принцип П-2). */
export function buildSchemas(endpoints: readonly Endpoint[]): string {
  const lines: string[] = [];
  for (const endpoint of endpoints) {
    if (endpoint.request !== undefined) {
      lines.push(`export const ${endpoint.name}Request = registry.${endpoint.name}.request;`);
      lines.push(`export type ${endpoint.name}Request = z.input<typeof registry.${endpoint.name}.request>;`);
    }
    lines.push(`export const ${endpoint.name}Response = registry.${endpoint.name}.response;`);
    lines.push(`export type ${endpoint.name}Response = z.output<typeof registry.${endpoint.name}.response>;`);
  }
  return `/*
 * СГЕНЕРИРОВАНО. Источник — packages/contracts, команда — pnpm gen:client.
 */
import type { z } from 'zod';
import { REGISTRY as registry } from '@coes/contracts/registry.ts';

${lines.join('\n')}
`;
}
