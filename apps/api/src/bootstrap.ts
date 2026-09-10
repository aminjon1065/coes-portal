import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import type { Client } from 'pg';
import { AppError, isAppError } from '@coes/core/errors.ts';
import { newId } from '@coes/core/id.ts';
import { registerSysRoutes } from './modules/sys/routes.ts';
import { registerAuthRoutes } from './modules/access/routes.ts';
import { listSettings } from './modules/sys/public.ts';

/**
 * Сборка приложения — docs/03-АРХИТЕКТУРА.md § 2, docs/09-API.md § 2, § 4.4.
 *
 * Единственное место превращения отказа в ответ HTTP — обработчик ниже.
 * Ловить AppError ради формирования ответа в модулях запрещено (adr/26).
 */

export const CSRF_COOKIE = 'X-CSRF-Token';
export const CSRF_HEADER = 'x-csrf-token';

/** Запросы, изменяющие данные. Только они требуют защиты § 4.4. */
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface AppDeps {
  readonly db: Client;
  /** Путь, по которому считается свободное место (§ 9.11 компонентов). */
  readonly dataPath: string;
  /**
   * Ставить ли cookie признак Secure. Всегда, кроме случая, когда узел из
   * BASE_URL — localhost: это единственное исключение, и оно существует
   * ради локальной среды исполнителя (docs/05-ДОСТУП.md § 10.3).
   */
  readonly secureCookie?: boolean;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
    // Номер запроса виден пользователю в состоянии ошибки (§ 9.4 компонентов)
    // и в журнале: по нему обращение сводится с записью.
    genReqId: () => newId(),
  });

  void app.register(cookie);

  /**
   * Защита от подделки межсайтовых запросов (§ 4.4). Проверка стоит до
   * обработчиков: заголовок, не совпавший с cookie, дальше не проходит.
   *
   * Признак выдаётся на любом чтении, включая ответ «войдите заново»:
   * иначе первый вход был бы невозможен — заголовку неоткуда было бы
   * взяться, ведь до входа cookie ещё нет.
   */
  app.addHook('onRequest', async (request, reply) => {
    if (!MUTATING.has(request.method)) {
      if (request.cookies[CSRF_COOKIE] === undefined) {
        void reply.setCookie(CSRF_COOKIE, newId(), {
          httpOnly: false, sameSite: 'strict', path: '/', secure: deps.secureCookie ?? false,
        });
      }
      return;
    }
    const fromHeader = request.headers[CSRF_HEADER];
    const fromCookie = request.cookies[CSRF_COOKIE];
    if (typeof fromHeader !== 'string' || fromHeader === '' || fromHeader !== fromCookie) {
      throw new AppError('UNAUTHENTICATED', 'Запрос отклонён: не совпал признак защиты от подделки. Обновите страницу и повторите.');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const failure = isAppError(error)
      ? error
      : new AppError('INTERNAL', 'Внутренняя ошибка. Обратитесь к системному администратору, назвав номер запроса.');
    if (!isAppError(error)) request.log.error({ err: error }, 'необработанный отказ');
    // Ответ об ошибке не содержит стека, имён таблиц и текстов SQL (§ 10, п. 5).
    void reply.status(failure.status).send({
      error: {
        code: failure.code,
        message: failure.message,
        details: failure.details,
        requestId: String(request.id),
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Метод не найден.',
        details: {},
        requestId: String(request.id),
      },
    });
  });

  registerSysRoutes(app, deps);
  registerAuthRoutes(app, {
    db: deps.db,
    // Настройки читаются из базы: § 5.11 задаёт порядок «окружение →
    // sys.setting → умолчание реестра», и подмена этого порядка кешем
    // означала бы, что правка настройки не действует до перезапуска.
    settings: async () => Object.fromEntries(
      (await listSettings(deps.db)).map((item) => [item.key, item.value]),
    ),
    secureCookie: deps.secureCookie ?? false,
    newCsrfToken: () => newId(),
  });
  return app;
}
