import { z } from 'zod';
import { errorResponse, accepted } from './obshchee.ts';
import { loginRequest, sessionResponse, passwordRequest, contextRequest } from './auth.ts';
import { settingsResponse, settingsUpdateRequest, systemStatusResponse } from './sys.ts';
import {
  orgUnit, orgUnitCreateRequest, orgUnitListResponse,
  position, positionCreateRequest, person, personCreateRequest,
  assignment, assignmentCreateRequest, delegation, delegationCreateRequest, roleGrantRequest,
} from './org.ts';
import {
  account, accountCreateRequest, accountBlockRequest, accountBlockResponse,
  auditListResponse, auditVerifyResponse,
} from './iam-schema.ts';
import {
  catalog, catalogListResponse, catalogItemListResponse, catalogItemFilter,
} from './ref.ts';
import { commonFilter } from './obshchee.ts';

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

/**
 * Методы описаны объектом, а имя метода — это ключ. Ручная нумерация
 * привела бы к тому, что перестановка записи молча меняет имена.
 */
const DESCRIBED = {
  login: {
    name: 'login', method: 'POST', path: '/auth/login',
    summary: 'Вход по имени пользователя и паролю',
    request: loginRequest, response: sessionResponse, permission: 'anonymous',
  },
  logout: {
    name: 'logout', method: 'POST', path: '/auth/logout',
    summary: 'Выход, закрытие текущей сессии',
    response: accepted, permission: null,
  },
  getSession: {
    name: 'getSession', method: 'GET', path: '/auth/session',
    summary: 'Текущая сессия: человек, назначение, разрешения, область видимости, замещения',
    response: sessionResponse, permission: null,
  },
  changePassword: {
    name: 'changePassword', method: 'POST', path: '/auth/password',
    summary: 'Смена собственного пароля',
    request: passwordRequest, response: accepted, permission: null,
  },
  switchContext: {
    name: 'switchContext', method: 'POST', path: '/auth/context',
    summary: 'Переключение активного назначения',
    request: contextRequest, response: sessionResponse, permission: null,
  },

  getOrgUnits: {
    name: 'getOrgUnits', method: 'GET', path: '/org-units',
    summary: 'Реестр подразделений в области видимости',
    // Отдельного разрешения нет: § 4.3 относит наименования подразделений
    // и должностей к видимому всем независимо от области. В матрице § 3.1
    // разрешения org.unit.read нет ни у одной роли — запись В-24.
    query: commonFilter, response: orgUnitListResponse, permission: null,
  },
  createOrgUnit: {
    name: 'createOrgUnit', method: 'POST', path: '/org-units',
    summary: 'Создание подразделения',
    request: orgUnitCreateRequest, response: orgUnit, permission: 'org.unit.manage',
  },
  getOrgUnit: {
    name: 'getOrgUnit', method: 'GET', path: '/org-units/{id}',
    summary: 'Карточка подразделения',
    response: orgUnit, permission: null,
  },
  createPosition: {
    name: 'createPosition', method: 'POST', path: '/positions',
    summary: 'Создание должности',
    request: positionCreateRequest, response: position, permission: 'org.position.manage',
  },
  createPerson: {
    name: 'createPerson', method: 'POST', path: '/persons',
    summary: 'Создание карточки сотрудника',
    request: personCreateRequest, response: person, permission: 'org.person.manage',
  },
  createAssignment: {
    name: 'createAssignment', method: 'POST', path: '/assignments',
    summary: 'Назначение на должность приказом',
    request: assignmentCreateRequest, response: assignment, permission: 'org.assignment.manage',
  },
  createDelegation: {
    name: 'createDelegation', method: 'POST', path: '/delegations',
    summary: 'Оформление замещения приказом',
    request: delegationCreateRequest, response: delegation, permission: 'org.delegation.create',
  },
  grantAssignmentRole: {
    name: 'grantAssignmentRole', method: 'POST', path: '/assignments/{id}/roles',
    summary: 'Выдача роли назначению',
    request: roleGrantRequest, response: accepted, permission: 'access.grant.manage',
  },

  createAccount: {
    name: 'createAccount', method: 'POST', path: '/accounts',
    summary: 'Создание учётной записи с одноразовым паролем',
    request: accountCreateRequest, response: account, permission: 'iam.account.create',
  },
  blockAccount: {
    name: 'blockAccount', method: 'POST', path: '/accounts/{id}/block',
    summary: 'Блокировка учётной записи и закрытие всех её сессий',
    request: accountBlockRequest, response: accountBlockResponse, permission: 'iam.account.block',
  },
  unblockAccount: {
    name: 'unblockAccount', method: 'POST', path: '/accounts/{id}/unblock',
    summary: 'Снятие блокировки учётной записи',
    response: accepted, permission: 'iam.account.block',
  },

  getAuditEvents: {
    name: 'getAuditEvents', method: 'GET', path: '/audit/events',
    summary: 'Журнал действий',
    query: commonFilter, response: auditListResponse, permission: 'audit.event.read_all',
  },
  verifyAudit: {
    name: 'verifyAudit', method: 'POST', path: '/audit/verify',
    summary: 'Проверка целостности цепочки журнала',
    response: auditVerifyResponse, permission: 'audit.event.verify',
  },

  getCatalogs: {
    name: 'getCatalogs', method: 'GET', path: '/catalogs',
    summary: 'Перечень справочников с числом элементов и числом временных',
    // Отдельного разрешения нет: docs/05-ДОСТУП.md § 2 относит
    // ref.catalog.read к тому, что «есть у всех и в ролях не перечисляется».
    query: catalogItemFilter, response: catalogListResponse, permission: null,
  },
  getCatalog: {
    name: 'getCatalog', method: 'GET', path: '/catalogs/{code}',
    summary: 'Справочник по коду',
    response: catalog, permission: null,
  },
  getCatalogItems: {
    name: 'getCatalogItems', method: 'GET', path: '/catalogs/{code}/items',
    summary: 'Элементы справочника',
    query: catalogItemFilter, response: catalogItemListResponse, permission: null,
  },

  getSettings: {
    name: 'getSettings', method: 'GET', path: '/settings',
    summary: 'Настройки и пределы',
    response: settingsResponse, permission: 'sys.setting.read',
  },
  putSettings: {
    name: 'putSettings', method: 'PUT', path: '/settings',
    summary: 'Изменение настроек',
    request: settingsUpdateRequest, response: settingsResponse, permission: 'sys.setting.manage',
  },
  getSystemStatus: {
    name: 'getSystemStatus', method: 'GET', path: '/system/status',
    summary: 'Состояние сервера: версия, база, диск, миграции',
    response: systemStatusResponse, permission: 'sys.status.read',
  },
} as const satisfies Readonly<Record<string, Endpoint>>;

/**
 * Методы по имени. Тип каждой схемы здесь точный, а не «какая-нибудь схема»:
 * сгенерированный клиент берёт схемы отсюда и обязан знать их устройство,
 * иначе теряется весь смысл единственного описания (принцип П-2).
 */
export const REGISTRY = DESCRIBED;

export const ENDPOINTS: readonly Endpoint[] = Object.values(DESCRIBED);

/** Основание пути (§ 1). Абсолютных адресов здесь нет и быть не может (П-5). */
export const API_BASE = '/api/v1';

/** Схема отказа одна для всех методов (§ 2). */
export const FAILURE = errorResponse;
