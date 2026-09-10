import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { endpointByName, routePath, parseRequest, parsePageParams } from '@coes/contracts';
import {
  orgUnitCreateRequest, positionCreateRequest, personCreateRequest,
  assignmentCreateRequest, delegationCreateRequest, roleGrantRequest,
} from '@coes/contracts';
import { accountCreateRequest, accountBlockRequest } from '@coes/contracts';
import { loginRequest, passwordRequest, contextRequest } from '@coes/contracts';
import {
  verifyCredentials, openSession, endSession, switchSessionAssignment, changeOwnPassword,
  liveSession, accountByPerson,
} from '../iam/public.ts';
import { record } from '../audit/public.ts';
import type { Actor } from '../audit/public.ts';
import {
  createOrgUnit, listOrgUnits, createPosition, createPerson, createAssignment,
  createDelegation,
} from '../org/public.ts';
import { createAccount, blockAccount, unblockAccount } from '../iam/public.ts';
import { listEvents } from '../audit/public.ts';
import { workContext, assignmentForLogin, requirePermission, requireInScope, grantRole } from './public.ts';
import type { WorkContext } from './public.ts';

/**
 * Вход и сессия — docs/09-API.md § 8, docs/05-ДОСТУП.md § 10.
 *
 * Маршруты живут в модуле access, а не в iam: вход сводит учётную запись
 * (iam, 4), назначение (org, 5) и права (access, 6), а модуль вправе знать
 * только о младших. Свести их может лишь старший из трёх (§ 3).
 */

export const SESSION_COOKIE = 'coes_session';
export const CSRF_COOKIE = 'X-CSRF-Token';

export interface AuthDeps {
  readonly db: Client;
  /** Настройки из sys.setting: срок сессии, бездействие, длина пароля. */
  readonly settings: () => Promise<Readonly<Record<string, string>>>;
  /**
   * Защищённая cookie ставится всегда, кроме localhost: это единственное
   * исключение, и оно существует ради локальной среды (§ 10.3).
   */
  readonly secureCookie: boolean;
  readonly newCsrfToken: () => string;
}

function sessionView(context: WorkContext, mustChangePassword: boolean, expiresAt: string): unknown {
  return {
    personId: context.personId,
    fullName: context.fullName,
    mustChangePassword,
    activeAssignment: {
      id: context.assignment.id,
      positionTitle: context.assignment.positionName,
      orgUnitId: context.assignment.orgUnitId,
      orgUnitName: context.assignment.orgUnitName,
    },
    assignments: context.assignments.map((item) => ({
      id: item.id,
      positionTitle: item.positionName,
      orgUnitId: item.orgUnitId,
      orgUnitName: item.orgUnitName,
    })),
    permissions: [...context.permissions],
    visibleOrgUnitIds: [...context.visibleOrgUnitIds],
    delegations: context.delegations.map((item) => ({
      id: item.id,
      positionTitle: item.delegatorPositionName,
      orderNumber: item.orderNumber,
      validFrom: item.startedOn,
      validTo: item.endedOn,
    })),
    expiresAt,
  };
}

/** Сессия из cookie. Её отсутствие — не ошибка сервера, а отказ входа. */
export function sessionIdOf(request: FastifyRequest): string | undefined {
  const raw = request.cookies[SESSION_COOKIE];
  return raw === undefined || raw === '' ? undefined : raw;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const login = endpointByName('login');
  const logout = endpointByName('logout');
  const session = endpointByName('getSession');
  const password = endpointByName('changePassword');
  const context = endpointByName('switchContext');

  const setCookies = (reply: FastifyReply, sessionId: string): string => {
    const csrf = deps.newCsrfToken();
    // Domain не задаётся: cookie следует за именем системы сама и не
    // переносится на соседние поддомены (§ 10.3).
    void reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true, sameSite: 'strict', path: '/', secure: deps.secureCookie,
    });
    void reply.setCookie(CSRF_COOKIE, csrf, {
      httpOnly: false, sameSite: 'strict', path: '/', secure: deps.secureCookie,
    });
    return csrf;
  };

  app.post(routePath(login), async (request, reply) => {
    const body = parseRequest(loginRequest, request.body);
    const settings = await deps.settings();
    const verified = await verifyCredentials(deps.db, body, settings);
    const assignment = await assignmentForLogin(deps.db, verified.personId);
    const opened = await openSession(deps.db, {
      accountId: verified.accountId,
      assignmentId: assignment.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    }, settings);

    const work = await workContext(deps.db, verified.personId, assignment.id);
    // Вход журналируется наравне с изменениями данных (§ 9.1).
    await record(deps.db, {
      personId: verified.personId,
      assignmentId: assignment.id,
      delegationId: null,
      sessionId: opened.session.id,
      ip: request.ip,
      requestId: String(request.id),
    }, 'session.login', {
      schema: 'iam', table: 'session', id: opened.session.id, label: null,
    }, { extra: opened.evicted === null ? undefined : { evictedSession: opened.evicted } });

    setCookies(reply, opened.session.id);
    return sessionView(work, verified.mustChangePassword, opened.session.expiresAt);
  });

  app.get(routePath(session), async (request) => {
    const current = await requireSession(request);
    return sessionView(current.context, current.mustChangePassword, current.expiresAt);
  });

  app.post(routePath(logout), async (request, reply) => {
    const current = await requireSession(request);
    await endSession(deps.db, {
      personId: current.context.personId,
      assignmentId: current.context.assignment.id,
      delegationId: null,
      sessionId: current.sessionId,
      ip: request.ip,
      requestId: String(request.id),
    }, current.sessionId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    void reply.clearCookie(CSRF_COOKIE, { path: '/' });
    return { ok: true as const };
  });

  app.post(routePath(password), async (request) => {
    const current = await requireSession(request);
    const body = parseRequest(passwordRequest, request.body);
    const settings = await deps.settings();
    await changeOwnPassword(deps.db, {
      personId: current.context.personId,
      assignmentId: current.context.assignment.id,
      delegationId: null,
      sessionId: current.sessionId,
      ip: request.ip,
      requestId: String(request.id),
    }, current.accountId, body, settings);
    return { ok: true as const };
  });

  app.post(routePath(context), async (request) => {
    const current = await requireSession(request);
    const body = parseRequest(contextRequest, request.body);
    const target = current.context.assignments.find((item) => item.id === body.assignmentId);
    if (target === undefined) {
      throw new AppError('NOT_FOUND', 'Такого действующего назначения у вас нет.');
    }
    await switchSessionAssignment(deps.db, current.sessionId, body.assignmentId);
    const work = await workContext(deps.db, current.context.personId, body.assignmentId);
    // Переключение рабочего контекста журналируется с обоими назначениями
    // (docs/05-ДОСТУП.md § 6, § 9.1).
    await record(deps.db, {
      personId: work.personId,
      assignmentId: body.assignmentId,
      delegationId: null,
      sessionId: current.sessionId,
      ip: request.ip,
      requestId: String(request.id),
    }, 'session.switch_context', {
      schema: 'iam', table: 'session', id: current.sessionId, label: null,
    }, { before: { assignmentId: current.context.assignment.id }, after: { assignmentId: body.assignmentId } });
    return sessionView(work, current.mustChangePassword, current.expiresAt);
  });

  const guarded = createGuarded(deps);

  const actorOf = (request: FastifyRequest, current: CurrentSession): Actor => ({
    personId: current.context.personId,
    assignmentId: current.context.assignment.id,
    // Замещение, в рамках которого действует замещающий: запись журнала
    // делается от его имени с указанием, кого он замещает (§ 5.3).
    delegationId: current.context.delegations[0]?.id ?? null,
    sessionId: current.sessionId,
    ip: request.ip,
    requestId: String(request.id),
  });

  app.get(routePath(endpointByName('getOrgUnits')), guarded('getOrgUnits', async (request, current) => {
    const query = request.query as { readonly limit?: unknown; readonly cursor?: unknown; readonly q?: unknown };
    const page = parsePageParams(query, await deps.settings());
    // Область видимости применяется всегда; параметра, отключающего её,
    // не существует (docs/09-API.md § 3.3).
    const items = await listOrgUnits(deps.db, current.context.visibleOrgUnitIds, {
      limit: page.limit,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
    return { items, nextCursor: null, total: items.length, totalIsExact: true };
  }));

  app.get(routePath(endpointByName('getOrgUnit')), guarded('getOrgUnit', async (request, current) => {
    const { id } = request.params as { readonly id: string };
    const found = await listOrgUnits(deps.db, current.context.visibleOrgUnitIds, { limit: 1_000 });
    const unit = found.find((item) => item.id === id);
    if (unit === undefined) {
      // Отказ, а не пустой экран: объект существует, но вне области
      // видимости — и об этом говорится прямо (adr/11, § 7).
      requireInScope(current.context, id);
      throw new AppError('NOT_FOUND', 'Подразделение не найдено.');
    }
    return unit;
  }));

  app.post(routePath(endpointByName('createOrgUnit')), guarded('createOrgUnit', async (request, current) => {
    const body = parseRequest(orgUnitCreateRequest, request.body);
    if (body.parentId !== null) requireInScope(current.context, body.parentId);
    return createOrgUnit(deps.db, actorOf(request, current), body);
  }));

  app.post(routePath(endpointByName('createPosition')), guarded('createPosition', async (request, current) => {
    const body = parseRequest(positionCreateRequest, request.body);
    requireInScope(current.context, body.orgUnitId);
    return createPosition(deps.db, actorOf(request, current), body);
  }));

  app.post(routePath(endpointByName('createPerson')), guarded('createPerson', async (request, current) =>
    createPerson(deps.db, actorOf(request, current), parseRequest(personCreateRequest, request.body))));

  app.post(routePath(endpointByName('createAssignment')), guarded('createAssignment', async (request, current) =>
    createAssignment(deps.db, actorOf(request, current), parseRequest(assignmentCreateRequest, request.body))));

  app.post(routePath(endpointByName('createDelegation')), guarded('createDelegation', async (request, current) =>
    createDelegation(deps.db, actorOf(request, current), parseRequest(delegationCreateRequest, request.body))));

  app.post(routePath(endpointByName('grantAssignmentRole')), guarded('grantAssignmentRole', async (request, current) => {
    const { id } = request.params as { readonly id: string };
    const body = parseRequest(roleGrantRequest, request.body);
    await grantRole(deps.db, actorOf(request, current), { assignmentId: id, roleCode: body.roleCode });
    return { ok: true as const };
  }));

  app.post(routePath(endpointByName('createAccount')), guarded('createAccount', async (request, current) =>
    createAccount(
      deps.db,
      actorOf(request, current),
      parseRequest(accountCreateRequest, request.body),
      await deps.settings(),
    )));

  app.post(routePath(endpointByName('blockAccount')), guarded('blockAccount', async (request, current) => {
    const { id } = request.params as { readonly id: string };
    const body = parseRequest(accountBlockRequest, request.body);
    return blockAccount(deps.db, actorOf(request, current), id, body.reason);
  }));

  app.post(routePath(endpointByName('unblockAccount')), guarded('unblockAccount', async (request, current) => {
    const { id } = request.params as { readonly id: string };
    await unblockAccount(deps.db, actorOf(request, current), id);
    return { ok: true as const };
  }));

  app.get(routePath(endpointByName('getAuditEvents')), guarded('getAuditEvents', async (request) => {
    const query = request.query as { readonly limit?: unknown; readonly cursor?: unknown };
    const page = parsePageParams(query, await deps.settings());
    const items = await listEvents(deps.db, { limit: page.limit });
    return { items, nextCursor: null, total: items.length, totalIsExact: true };
  }));

  const requireSession = async (request: FastifyRequest): Promise<CurrentSession> =>
    requireLiveSession(deps, request);
}

/**
 * Действующая сессия либо отказ. Отсутствие сессии — не ошибка сервера,
 * а предложение войти заново (docs/05-ДОСТУП.md § 10.3).
 */
export async function requireLiveSession(
  deps: AuthDeps,
  request: FastifyRequest,
): Promise<CurrentSession> {
  const found = await currentSession(deps, request);
  if (found === undefined) {
    throw new AppError('UNAUTHENTICATED', 'Сессия недействительна. Войдите заново.');
  }
  return found;
}

/**
 * Обработчик, требующий вошедшего пользователя и разрешения. Сервер
 * проверяет права независимо и всегда, даже если интерфейс кнопку не
 * показал (docs/09-API.md § 8).
 */
export interface Guarded {
  <T>(
    name: string,
    handler: (request: FastifyRequest, current: CurrentSession) => Promise<T>,
  ): (request: FastifyRequest) => Promise<T>;
}

/**
 * Охранник собирается здесь, а раздаётся модулям сборкой приложения
 * (bootstrap.ts, дерево docs/03-АРХИТЕКТУРА.md § 2: «регистрация модулей
 * и проверок доступа»). Модуль старше access — например ref (№ 7) — не
 * может импортировать access напрямую, и порядок § 3 удерживается тем,
 * что связку делает сборка, а не модуль.
 */
export function createGuarded(deps: AuthDeps): Guarded {
  return <T>(
    name: string,
    handler: (request: FastifyRequest, current: CurrentSession) => Promise<T>,
  ) => {
    const endpoint = endpointByName(name);
    return async (request: FastifyRequest): Promise<T> => {
      const current = await requireLiveSession(deps, request);
      if (endpoint.permission !== null && endpoint.permission !== 'anonymous') {
        requirePermission(current.context, endpoint.permission);
      }
      return handler(request, current);
    };
  };
}

/**
 * Текущая сессия по cookie. Недействительной она становится сама: по
 * предельному сроку, по бездействию, при блокировке учётной записи и при
 * прекращении активного назначения (docs/05-ДОСТУП.md § 10.3).
 */
export async function currentSession(
  deps: AuthDeps,
  request: FastifyRequest,
): Promise<CurrentSession | undefined> {
  const sessionId = sessionIdOf(request);
  if (sessionId === undefined) return undefined;
  const settings = await deps.settings();
  const session = await liveSession(deps.db, sessionId, settings);
  if (session === undefined) return undefined;
  const account = await accountByPerson(deps.db, session.accountId);
  if (account === undefined) return undefined;
  const context = await workContext(deps.db, account.personId, session.activeAssignmentId);
  return {
    sessionId: session.id,
    accountId: session.accountId,
    mustChangePassword: account.mustChangePassword,
    expiresAt: session.expiresAt,
    context,
  };
}

export interface CurrentSession {
  readonly sessionId: string;
  readonly accountId: string;
  readonly mustChangePassword: boolean;
  readonly expiresAt: string;
  readonly context: WorkContext;
}
