import { z } from 'zod';
import { uuid, isoDateTime } from './obshchee.ts';

/** Вход и сессия — docs/09-API.md § 8, docs/05-ДОСТУП.md § 10. */

/** Минимальная длина пароля — PASSWORD_MIN_LENGTH, § 10.2. */
export const PASSWORD_MIN_LENGTH = 12;

export const loginRequest = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Назначение — субъект прав (§ 1). Человек без действующего назначения
 * войти не может, поэтому активное назначение в сессии всегда есть.
 */
export const assignmentBrief = z.object({
  id: uuid,
  positionTitle: z.string(),
  orgUnitId: uuid,
  orgUnitName: z.string(),
});

/** Действующее замещение: от чьего имени работает замещающий (§ 5.3). */
export const delegationBrief = z.object({
  id: uuid,
  positionTitle: z.string(),
  orderNumber: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
});

export const sessionResponse = z.object({
  personId: uuid,
  fullName: z.string(),
  /** Первый вход после создания учётной записи требует смены пароля (§ 10.2). */
  mustChangePassword: z.boolean(),
  activeAssignment: assignmentBrief,
  /** Все действующие назначения: из них собирается переключатель (§ 6). */
  assignments: z.array(assignmentBrief),
  /** Полный перечень разрешений текущего назначения (§ 8 API). */
  permissions: z.array(z.string()),
  /**
   * Область видимости — перечень подразделений. Сервер применяет её сам и
   * всегда; перечень здесь нужен интерфейсу только для показа (§ 4.5).
   */
  visibleOrgUnitIds: z.array(uuid),
  delegations: z.array(delegationBrief),
  expiresAt: isoDateTime,
});

export const passwordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

export const contextRequest = z.object({
  assignmentId: uuid,
});
