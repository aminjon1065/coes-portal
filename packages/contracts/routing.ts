import { z } from 'zod';
import { AppError } from '@coes/core/errors.ts';
import { limitValue, refuse } from '@coes/core/limits.ts';
import { API_BASE, ENDPOINTS } from './registry.ts';
import type { Endpoint } from './registry.ts';

/**
 * Работа с перечнем методов — docs/09-API.md § 9, § 10.
 *
 * Живёт здесь, а не в сборке приложения: иначе модуль, регистрирующий свои
 * маршруты, ссылался бы на сборку, а сборка — на модуль. Такой цикл
 * запрещён без исключений (docs/03-АРХИТЕКТУРА.md § 3) и был найден
 * проверкой границ, а не рассуждением.
 */

/** Метода вне перечня не существует (§ 10, п. 8). */
export function endpointByName(name: string): Endpoint {
  const found = ENDPOINTS.find((endpoint) => endpoint.name === name);
  if (found === undefined) {
    throw new Error(`Метода «${name}» нет в перечне packages/contracts/registry.ts (docs/09-API.md § 10, п. 8).`);
  }
  return found;
}

/** Полный путь метода с параметрами в виде :имя. */
export function routePath(endpoint: Endpoint): string {
  return API_BASE + endpoint.path.replace(/\{([a-zA-Z]+)\}/gu, ':$1');
}

/**
 * Проверка тела запроса той же схемой, которой описан метод. Отказ несёт
 * перечень полей: пользователю нужно знать, какое поле неверно (§ 2).
 */
export function parseRequest<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError('VALIDATION_FAILED', 'Запрос не прошёл проверку. Исправьте отмеченные поля.', {
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

/** Умолчание размера страницы (docs/09-API.md § 3.1). */
export const DEFAULT_PAGE_SIZE = 50;

export interface PageRequest {
  readonly limit: number;
  readonly cursor: string | undefined;
}

/**
 * Разбор постраничных параметров с применением предела LIMIT_LIST_PAGE_SIZE
 * (docs/03-АРХИТЕКТУРА.md § 6). Значение больше предела — отказ с ключом
 * предела и числом из действующего значения, а не молчаливое урезание:
 * урезав молча, система выдала бы не то, о чём спросили.
 */
export function parsePageParams(
  raw: { readonly limit?: unknown; readonly cursor?: unknown },
  fromSettings: Readonly<Record<string, string>> = {},
): PageRequest {
  const max = Number(limitValue('LIMIT_LIST_PAGE_SIZE', fromSettings));
  const asked = raw.limit === undefined || raw.limit === '' ? DEFAULT_PAGE_SIZE : Number(raw.limit);
  if (!Number.isInteger(asked) || asked <= 0) {
    throw new AppError('VALIDATION_FAILED', 'Размер страницы должен быть целым положительным числом.', {
      fields: [{ path: 'limit', message: 'Ожидается целое положительное число' }],
    });
  }
  if (asked > max) {
    throw new AppError('LIMIT_REACHED', refuse('LIMIT_LIST_PAGE_SIZE', {}, fromSettings), {
      limit: 'LIMIT_LIST_PAGE_SIZE',
      current: asked,
      max,
    });
  }
  return { limit: asked, cursor: typeof raw.cursor === 'string' ? raw.cursor : undefined };
}
