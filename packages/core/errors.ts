/**
 * Отказы прикладной логики (docs/03-АРХИТЕКТУРА.md § 5.3, adr/26).
 *
 * Модули не возвращают признак ошибки значением: они бросают `AppError`.
 * Единственное место преобразования в ответ HTTP — общий обработчик,
 * зарегистрированный при сборке приложения. Ловить `AppError` ради
 * формирования ответа запрещено.
 *
 * `message` — готовый русский текст для пользователя: он говорит, что
 * случилось и что делать (docs/06-ДИЗАЙН-СИСТЕМА.md § 9, п. 4).
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'LIMIT_REACHED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** Соответствие кодов состояниям HTTP — таблица § 5.3. */
export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  LIMIT_REACHED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export type ErrorDetails = Readonly<Record<string, unknown>>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  /** Состояние HTTP, соответствующее коду. */
  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Приводит любое исключение к отказу с кодом. Всё, что не `AppError`,
 * становится `INTERNAL`: пользователю показывается только `requestId`,
 * подробности уходят в журнал вывода (§ 5.3, п. 4).
 */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return new AppError(
    'INTERNAL',
    'Внутренняя ошибка. Сообщите администратору номер запроса.',
    {},
    value,
  );
}

export const validationFailed = (
  message: string,
  fields: readonly { readonly path: string; readonly message: string }[] = [],
): AppError => new AppError('VALIDATION_FAILED', message, { fields });

export const unauthenticated = (): AppError =>
  new AppError('UNAUTHENTICATED', 'Сессия истекла. Войдите заново.');

/**
 * Отказ по области видимости: объект существует, но не показан.
 * Пустого результата вместо отказа не бывает (docs/05-ДОСТУП.md § 7, adr/11).
 */
export const accessDeniedByScope = (): AppError =>
  new AppError(
    'ACCESS_DENIED',
    'Этот объект существует, но не входит в вашу область видимости. ' +
      'Если доступ необходим для работы, обратитесь к администратору региона.',
  );

/** Отказ по разрешению: объект виден, действие недоступно. */
export const accessDeniedByPermission = (action: string, position: string, permission: string): AppError =>
  new AppError(
    'ACCESS_DENIED',
    `Действие «${action}» недоступно для должности «${position}».`,
    { permission },
  );

export const notFound = (): AppError =>
  new AppError('NOT_FOUND', 'Объект не найден. Возможно, он удалён или ссылка неверна.');

export const conflict = (message: string, reason: string): AppError =>
  new AppError('CONFLICT', message, { reason });

export const preconditionFailed = (currentVersion: number): AppError =>
  new AppError(
    'PRECONDITION_FAILED',
    'Запись изменена другим пользователем. Обновите страницу, чтобы увидеть изменения.',
    { currentVersion },
  );

export const limitReached = (limit: string, message: string, current: number, max: number): AppError =>
  new AppError('LIMIT_REACHED', message, { limit, current, max });

export const rateLimited = (minutes: number): AppError =>
  new AppError(
    'RATE_LIMITED',
    `Слишком много попыток входа. Повторите через ${minutes} мин. или обратитесь к администратору.`,
  );
