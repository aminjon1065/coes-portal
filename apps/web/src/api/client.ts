/*
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
export const API_BASE = '/api/v1';

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
  /** Вход по имени пользователя и паролю */
  login: (body: In<typeof schemas.loginRequest>): Promise<Out<typeof schemas.loginResponse>> =>
    request(schemas.loginResponse, 'POST', `/auth/login`, body, undefined),
  /** Выход, закрытие текущей сессии */
  logout: (): Promise<Out<typeof schemas.logoutResponse>> =>
    request(schemas.logoutResponse, 'POST', `/auth/logout`, undefined, undefined),
  /** Текущая сессия: человек, назначение, разрешения, область видимости, замещения */
  getSession: (): Promise<Out<typeof schemas.getSessionResponse>> =>
    request(schemas.getSessionResponse, 'GET', `/auth/session`, undefined, undefined),
  /** Смена собственного пароля */
  changePassword: (body: In<typeof schemas.changePasswordRequest>): Promise<Out<typeof schemas.changePasswordResponse>> =>
    request(schemas.changePasswordResponse, 'POST', `/auth/password`, body, undefined),
  /** Переключение активного назначения */
  switchContext: (body: In<typeof schemas.switchContextRequest>): Promise<Out<typeof schemas.switchContextResponse>> =>
    request(schemas.switchContextResponse, 'POST', `/auth/context`, body, undefined),
  /** Настройки и пределы */
  getSettings: (): Promise<Out<typeof schemas.getSettingsResponse>> =>
    request(schemas.getSettingsResponse, 'GET', `/settings`, undefined, undefined),
  /** Изменение настроек */
  putSettings: (body: In<typeof schemas.putSettingsRequest>): Promise<Out<typeof schemas.putSettingsResponse>> =>
    request(schemas.putSettingsResponse, 'PUT', `/settings`, body, undefined),
  /** Состояние сервера: версия, база, диск, миграции */
  getSystemStatus: (): Promise<Out<typeof schemas.getSystemStatusResponse>> =>
    request(schemas.getSystemStatusResponse, 'GET', `/system/status`, undefined, undefined),
};

export type { loginRequest, loginResponse, logoutResponse, getSessionResponse, changePasswordRequest, changePasswordResponse, switchContextRequest, switchContextResponse, getSettingsResponse, putSettingsRequest, putSettingsResponse, getSystemStatusResponse } from './schemas.ts';
