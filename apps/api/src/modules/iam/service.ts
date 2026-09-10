import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { Client } from 'pg';
import { AppError } from '@coes/core/errors.ts';
import { newId } from '@coes/core/id.ts';
import { nowMs } from '@coes/core/clock.ts';
import { limitValue, refuse } from '@coes/core/limits.ts';
import { record, type Actor } from '../audit/public.ts';
import {
  selectAccountByLogin, selectAccountById, insertAccount, updatePassword,
  noteFailedAttempt, noteSuccessfulLogin, setBlocked,
  insertSession, selectLiveSession, touchSession, setActiveAssignment,
  closeSession, closeAllSessions, selectOpenSessions,
} from './queries.ts';
import type { AccountRow, SessionRow } from './queries.ts';

/**
 * Учётные записи, пароли, сессии — docs/05-ДОСТУП.md § 10.
 *
 * Хеширование Argon2id; хранение открытых паролей и обратимого шифрования
 * запрещено. Двухфакторной проверки нет: СМС и звонки исключены условием
 * задачи, аппаратных ключей у сотрудников нет (§ 10.2).
 */

/** Минимальная длина пароля по умолчанию (§ 10.2, настройка PASSWORD_MIN_LENGTH). */
const PASSWORD_MIN_LENGTH_DEFAULT = 12;

/** Предельный срок сессии по умолчанию (§ 10.3, настройка SESSION_MAX_HOURS). */
const SESSION_MAX_HOURS_DEFAULT = 12;

/**
 * Настройка из sys.setting с умолчанием. Пределы § 6 живут в реестре
 * packages/core/limits.ts, а эти величины — настройки, и в реестре их нет.
 */
function settingNumber(
  settings: Readonly<Record<string, string>>,
  key: string,
  fallback: number,
): number {
  const raw = settings[key];
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Argon2id — алгоритм задан § 10.2. Числовое значение вместо перечисления
 * библиотеки: перечисление объявлено ambient const enum, а такие
 * недоступны при verbatimModuleSyntax.
 */
const ARGON2ID = 2;

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, { algorithm: ARGON2ID });
}

/**
 * Проверка пароля. Отказ один и тот же и для неизвестного имени, и для
 * неверного пароля: различающиеся ответы сообщали бы, какое имя
 * существует (docs/05-ДОСТУП.md § 7).
 */
const WRONG_CREDENTIALS = 'Имя пользователя или пароль неверны.';

export interface Credentials {
  readonly login: string;
  readonly password: string;
}

export interface VerifiedAccount {
  readonly accountId: string;
  readonly personId: string;
  readonly mustChangePassword: boolean;
}

export async function verifyCredentials(
  db: Client,
  input: Credentials,
  settings: Readonly<Record<string, string>>,
): Promise<VerifiedAccount> {
  const account = await selectAccountByLogin(db, input.login);
  if (account === undefined) {
    throw new AppError('UNAUTHENTICATED', WRONG_CREDENTIALS);
  }
  if (account.isBlocked) {
    throw new AppError(
      'ACCESS_DENIED',
      `Учётная запись заблокирована${account.blockedReason === null ? '' : `: ${account.blockedReason}`}. Обратитесь к администратору.`,
    );
  }
  const moment = nowMs();
  if (account.lockedUntil !== null && new Date(account.lockedUntil).getTime() > moment) {
    const left = Math.max(1, Math.ceil((new Date(account.lockedUntil).getTime() - moment) / 60_000));
    throw new AppError('RATE_LIMITED', refuse('LIMIT_LOGIN_ATTEMPTS', { need: left }, settings), {
      limit: 'LIMIT_LOGIN_ATTEMPTS',
      current: account.failedAttempts,
      max: Number(limitValue('LIMIT_LOGIN_ATTEMPTS', settings)),
    });
  }

  const matched = await argonVerify(account.passwordHash, input.password);
  if (!matched) {
    const attempts = await noteFailedAttempt(
      db, account.id, Number(limitValue('LIMIT_LOGIN_ATTEMPTS', settings)),
    );
    // Неудачная попытка входа журналируется наравне с изменениями (§ 9.1).
    await record(db, null, 'account.login_failed', {
      schema: 'iam', table: 'account', id: account.id, label: account.login,
    }, { extra: { attempts } });
    throw new AppError('UNAUTHENTICATED', WRONG_CREDENTIALS);
  }

  await noteSuccessfulLogin(db, account.id);
  return {
    accountId: account.id,
    personId: account.personId,
    mustChangePassword: account.mustChangePassword,
  };
}

export interface OpenedSession {
  readonly session: SessionRow;
  /** Закрытая по пределу сессия: пользователь обязан узнать причину (§ 10.3). */
  readonly evicted: string | null;
}

/**
 * Открытие сессии. При превышении предела одновременных сессий закрывается
 * самая старая — это не отказ, но и не молчание: закрытому сообщается
 * причина (docs/03-АРХИТЕКТУРА.md § 6).
 */
export async function openSession(
  db: Client,
  input: {
    readonly accountId: string; readonly assignmentId: string;
    readonly ip: string | null; readonly userAgent: string | null;
  },
  settings: Readonly<Record<string, string>>,
): Promise<OpenedSession> {
  const maxSessions = Number(limitValue('LIMIT_SESSION_PER_ACCOUNT', settings));
  const open = await selectOpenSessions(db, input.accountId);
  let evicted: string | null = null;
  if (open.length >= maxSessions) {
    const oldest = open[0];
    if (oldest !== undefined) {
      await closeSession(db, oldest.id, refuse('LIMIT_SESSION_PER_ACCOUNT', {}, settings));
      evicted = oldest.id;
    }
  }

  const session = await insertSession(db, {
    id: newId(),
    accountId: input.accountId,
    activeAssignmentId: input.assignmentId,
    maxHours: settingNumber(settings, 'SESSION_MAX_HOURS', SESSION_MAX_HOURS_DEFAULT),
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { session, evicted };
}

export async function liveSession(
  db: Client,
  sessionId: string,
  settings: Readonly<Record<string, string>>,
): Promise<SessionRow | undefined> {
  const session = await selectLiveSession(db, sessionId, settingNumber(settings, 'SESSION_IDLE_MIN', 60));
  if (session === undefined) return undefined;
  const account = await selectAccountById(db, session.accountId);
  // Блокировка учётной записи немедленно прекращает работу (§ 10.3).
  if (account === undefined || account.isBlocked) {
    await closeSession(db, session.id, 'Учётная запись заблокирована');
    return undefined;
  }
  await touchSession(db, session.id);
  return session;
}

export async function switchSessionAssignment(
  db: Client,
  sessionId: string,
  assignmentId: string,
): Promise<void> {
  await setActiveAssignment(db, sessionId, assignmentId);
}

export async function endSession(db: Client, actor: Actor, sessionId: string): Promise<void> {
  await closeSession(db, sessionId, 'Выход пользователя');
  // Выход журналируется наравне со входом (§ 9.1).
  await record(db, actor, 'session.logout', {
    schema: 'iam', table: 'session', id: sessionId, label: null,
  });
}

export interface CreateAccount {
  readonly personId: string;
  readonly login: string;
  /** Одноразовый пароль. Первый вход требует его смены (§ 10.2). */
  readonly oneTimePassword: string;
}

export async function createAccount(
  db: Client,
  actor: Actor,
  input: CreateAccount,
  settings: Readonly<Record<string, string>> = {},
): Promise<AccountRow> {
  const minLength = settingNumber(settings, 'PASSWORD_MIN_LENGTH', PASSWORD_MIN_LENGTH_DEFAULT);
  if (input.oneTimePassword.length < minLength) {
    throw new AppError('VALIDATION_FAILED', `Пароль короче ${String(minLength)} символов.`, {
      fields: [{ path: 'oneTimePassword', message: `Не менее ${String(minLength)} символов` }],
    });
  }
  const created = await insertAccount(db, {
    id: newId(),
    personId: input.personId,
    login: input.login,
    passwordHash: await hashPassword(input.oneTimePassword),
    createdBy: actor.personId,
  });
  await record(db, actor, 'account.create', {
    schema: 'iam', table: 'account', id: created.id, label: created.login,
  }, { after: { login: created.login, personId: created.personId } });
  // Выдача одноразового кода — отдельное действие журнала (§ 9.1).
  await record(db, actor, 'account.one_time_password', {
    schema: 'iam', table: 'account', id: created.id, label: created.login,
  });
  return created;
}

export async function changeOwnPassword(
  db: Client,
  actor: Actor,
  accountId: string,
  input: { readonly currentPassword: string; readonly newPassword: string },
  settings: Readonly<Record<string, string>> = {},
): Promise<void> {
  const account = await selectAccountById(db, accountId);
  if (account === undefined) throw new AppError('NOT_FOUND', 'Учётная запись не найдена.');
  if (!(await argonVerify(account.passwordHash, input.currentPassword))) {
    throw new AppError('UNAUTHENTICATED', 'Текущий пароль неверен.');
  }
  const minLength = settingNumber(settings, 'PASSWORD_MIN_LENGTH', PASSWORD_MIN_LENGTH_DEFAULT);
  if (input.newPassword.length < minLength) {
    throw new AppError('VALIDATION_FAILED', `Пароль короче ${String(minLength)} символов.`, {
      fields: [{ path: 'newPassword', message: `Не менее ${String(minLength)} символов` }],
    });
  }
  if (input.newPassword === input.currentPassword) {
    throw new AppError('VALIDATION_FAILED', 'Новый пароль совпадает с текущим.', {
      fields: [{ path: 'newPassword', message: 'Придумайте другой пароль' }],
    });
  }
  await updatePassword(db, accountId, await hashPassword(input.newPassword));
  await record(db, actor, 'account.password_change', {
    schema: 'iam', table: 'account', id: accountId, label: account.login,
  });
}

/** Блокировка немедленно закрывает все сессии учётной записи (§ 10.3). */
export async function blockAccount(
  db: Client,
  actor: Actor,
  accountId: string,
  reason: string,
): Promise<{ readonly closedSessions: number }> {
  const account = await selectAccountById(db, accountId);
  if (account === undefined) throw new AppError('NOT_FOUND', 'Учётная запись не найдена.');
  await setBlocked(db, accountId, true, reason);
  const closedSessions = await closeAllSessions(db, accountId, 'Учётная запись заблокирована');
  await record(db, actor, 'account.block', {
    schema: 'iam', table: 'account', id: accountId, label: account.login,
  }, { extra: { reason, closedSessions } });
  return { closedSessions };
}

export async function unblockAccount(db: Client, actor: Actor, accountId: string): Promise<void> {
  const account = await selectAccountById(db, accountId);
  if (account === undefined) throw new AppError('NOT_FOUND', 'Учётная запись не найдена.');
  await setBlocked(db, accountId, false, null);
  await record(db, actor, 'account.unblock', {
    schema: 'iam', table: 'account', id: accountId, label: account.login,
  });
}

export async function accountByPerson(db: Client, accountId: string): Promise<AccountRow | undefined> {
  return selectAccountById(db, accountId);
}

export type { AccountRow, SessionRow } from './queries.ts';
