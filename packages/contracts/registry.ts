import { z } from 'zod';
import { errorResponse, accepted } from './obshchee.ts';
import { loginRequest, sessionResponse, passwordRequest, contextRequest } from './auth.ts';
import { settingsResponse, settingsUpdateRequest, systemStatusResponse } from './sys.ts';

/**
 * Единственное описание методов API — docs/09-API.md § 9.
 *
 * Этим перечнем проверяет запросы сервер, из него же порождаются
 * packages/contracts/openapi.json и клиент apps/web/src/api (принцип П-2).
 * Метод, не описанный в docs/09-API.md, здесь не появляется (§ 10, п. 8).
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface Endpoint {
  /** Имя метода в клиенте: camelCase, английский (13 § 3). */
  readonly name: string;
  readonly method: HttpMethod;
  /** Путь без основания /api/v1. Параметры пути — в фигурных скобках. */
  readonly path: string;
  readonly summary: string;
  readonly request?: z.ZodTypeAny;
  readonly query?: z.ZodTypeAny;
  readonly response: z.ZodTypeAny;
  /**
   * Требуемое разрешение. `null` означает, что метод доступен любому
   * вошедшему; `'anonymous'` — что вход не требуется. Третьего нет:
   * метод без явного указания прав — дефект.
   */
  readonly permission: string | null | 'anonymous';
}

const LIST = [
  {
    name: 'login',
    method: 'POST',
    path: '/auth/login',
    summary: 'Вход по имени пользователя и паролю',
    request: loginRequest,
    response: sessionResponse,
    permission: 'anonymous',
  },
  {
    name: 'logout',
    method: 'POST',
    path: '/auth/logout',
    summary: 'Выход, закрытие текущей сессии',
    response: accepted,
    permission: null,
  },
  {
    name: 'getSession',
    method: 'GET',
    path: '/auth/session',
    summary: 'Текущая сессия: человек, назначение, разрешения, область видимости, замещения',
    response: sessionResponse,
    permission: null,
  },
  {
    name: 'changePassword',
    method: 'POST',
    path: '/auth/password',
    summary: 'Смена собственного пароля',
    request: passwordRequest,
    response: accepted,
    permission: null,
  },
  {
    name: 'switchContext',
    method: 'POST',
    path: '/auth/context',
    summary: 'Переключение активного назначения',
    request: contextRequest,
    response: sessionResponse,
    permission: null,
  },
  {
    name: 'getSettings',
    method: 'GET',
    path: '/settings',
    summary: 'Настройки и пределы',
    response: settingsResponse,
    permission: 'sys.setting.read',
  },
  {
    name: 'putSettings',
    method: 'PUT',
    path: '/settings',
    summary: 'Изменение настроек',
    request: settingsUpdateRequest,
    response: settingsResponse,
    permission: 'sys.setting.manage',
  },
  {
    name: 'getSystemStatus',
    method: 'GET',
    path: '/system/status',
    summary: 'Состояние сервера: версия, база, диск, миграции',
    response: systemStatusResponse,
    permission: 'sys.status.read',
  },
] as const satisfies readonly Endpoint[];

/**
 * Методы по имени. Тип каждой схемы здесь точный, а не «какая-нибудь схема»:
 * сгенерированный клиент берёт схемы отсюда и обязан знать их устройство,
 * иначе теряется весь смысл единственного описания (принцип П-2).
 */
export const REGISTRY = {
  login: LIST[0], logout: LIST[1], getSession: LIST[2], changePassword: LIST[3],
  switchContext: LIST[4], getSettings: LIST[5], putSettings: LIST[6], getSystemStatus: LIST[7],
} as const;

export const ENDPOINTS: readonly Endpoint[] = LIST;

/** Основание пути (§ 1). Абсолютных адресов здесь нет и быть не может (П-5). */
export const API_BASE = '/api/v1';

/** Схема отказа одна для всех методов (§ 2). */
export const FAILURE = errorResponse;
