import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { endpointByName, routePath, parsePageParams } from '@coes/contracts';
import { listCatalogs, catalogByCode, listCatalogItems } from './public.ts';

/**
 * Методы справочников — docs/09-API.md § 8.
 *
 * Модуль ref (№ 7) старше access (№ 6) и потому не может обратиться к нему
 * за проверкой сессии и прав (§ 3). Охранник приходит извне: его собирает
 * сборка приложения и раздаёт модулям. Здесь объявлено только то, что
 * модулю от него нужно, — этого достаточно, чтобы зависимость шла в
 * дозволенную сторону.
 */
export interface Guard {
  <T>(
    name: string,
    handler: (request: FastifyRequest) => Promise<T>,
  ): (request: FastifyRequest) => Promise<T>;
}

export interface RefDeps {
  readonly db: Client;
  readonly guarded: Guard;
  readonly settings: () => Promise<Readonly<Record<string, string>>>;
}

/**
 * Признак из строки запроса. Строка «false» истиной не является: приняв её
 * за истину, список молча показал бы не то, о чём спросили (§ 3.2).
 */
function flagOf(raw: unknown, name: string): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  throw new AppError('VALIDATION_FAILED', `Условие «${name}» принимает только true или false.`, {
    fields: [{ path: name, message: 'Ожидается true или false' }],
  });
}

function textOf(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw !== '' ? raw : undefined;
}

interface ItemQueryString {
  readonly limit?: unknown;
  readonly cursor?: unknown;
  readonly q?: unknown;
  readonly sort?: unknown;
  readonly onlyActive?: unknown;
}

export function registerRefRoutes(app: FastifyInstance, deps: RefDeps): void {
  const catalogs = endpointByName('getCatalogs');
  const one = endpointByName('getCatalog');
  const items = endpointByName('getCatalogItems');

  // Справочники читает любой вошедший (docs/05-ДОСТУП.md § 2). Расхождение
  // между перечнем методов и этим модулем — дефект, а не мелочь.
  for (const endpoint of [catalogs, one, items]) {
    if (endpoint.permission !== null) {
      throw new Error(
        `Метод «${endpoint.name}» объявлен с разрешением ${String(endpoint.permission)}, ` +
        'а чтение справочников доступно всем вошедшим (docs/05-ДОСТУП.md § 2).',
      );
    }
  }

  app.get(routePath(catalogs), deps.guarded('getCatalogs', async (request) => {
    const query = request.query as ItemQueryString;
    const page = parsePageParams(query, await deps.settings());
    return listCatalogs(deps.db, { limit: page.limit, q: textOf(query.q) });
  }));

  app.get(routePath(one), deps.guarded('getCatalog', async (request) => {
    const { code } = request.params as { readonly code: string };
    return catalogByCode(deps.db, code);
  }));

  app.get(routePath(items), deps.guarded('getCatalogItems', async (request) => {
    const { code } = request.params as { readonly code: string };
    const query = request.query as ItemQueryString;
    const page = parsePageParams(query, await deps.settings());
    return listCatalogItems(deps.db, code, {
      limit: page.limit,
      cursor: page.cursor,
      q: textOf(query.q),
      onlyActive: flagOf(query.onlyActive, 'onlyActive'),
      sort: query.sort,
    });
  }));
}
