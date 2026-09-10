import type { Client } from 'pg';

/** Обращения к базе модуля iam. */

export interface AccountRow {
  readonly id: string;
  readonly personId: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly mustChangePassword: boolean;
  readonly isBlocked: boolean;
  readonly blockedReason: string | null;
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
  readonly version: number;
}

interface RawAccount {
  id: string; person_id: string; login: string; password_hash: string;
  must_change_password: boolean; is_blocked: boolean; blocked_reason: string | null;
  failed_attempts: number; locked_until: Date | null; version: number;
}

function toAccount(row: RawAccount): AccountRow {
  return {
    id: row.id, personId: row.person_id, login: row.login, passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password, isBlocked: row.is_blocked,
    blockedReason: row.blocked_reason, failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until === null ? null : row.locked_until.toISOString(),
    version: row.version,
  };
}

const ACCOUNT_COLUMNS = `
  id::text AS id, person_id::text AS person_id, login, password_hash,
  must_change_password, is_blocked, blocked_reason, failed_attempts, locked_until, version
`;

export async function selectAccountByLogin(db: Client, login: string): Promise<AccountRow | undefined> {
  const { rows } = await db.query<RawAccount>(
    `SELECT ${ACCOUNT_COLUMNS} FROM iam.account WHERE login = $1`,
    [login],
  );
  const row = rows[0];
  return row === undefined ? undefined : toAccount(row);
}

export async function selectAccountById(db: Client, id: string): Promise<AccountRow | undefined> {
  const { rows } = await db.query<RawAccount>(`SELECT ${ACCOUNT_COLUMNS} FROM iam.account WHERE id = $1`, [id]);
  const row = rows[0];
  return row === undefined ? undefined : toAccount(row);
}

export async function insertAccount(
  db: Client,
  account: {
    readonly id: string; readonly personId: string; readonly login: string;
    readonly passwordHash: string; readonly createdBy: string | null;
  },
): Promise<AccountRow> {
  const { rows } = await db.query<RawAccount>(
    `INSERT INTO iam.account (id, person_id, login, password_hash, created_by_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${ACCOUNT_COLUMNS}`,
    [account.id, account.personId, account.login, account.passwordHash, account.createdBy],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('Учётная запись не создана.');
  return toAccount(row);
}

export async function updatePassword(
  db: Client,
  accountId: string,
  passwordHash: string,
): Promise<void> {
  await db.query(
    `UPDATE iam.account
        SET password_hash = $2, must_change_password = false, failed_attempts = 0,
            locked_until = NULL, updated_at = now(), version = version + 1
      WHERE id = $1`,
    [accountId, passwordHash],
  );
}

export async function noteFailedAttempt(db: Client, accountId: string, lockMinutes: number): Promise<number> {
  const { rows } = await db.query<{ failed_attempts: number }>(
    `UPDATE iam.account
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= $2
                                THEN now() + make_interval(mins => $3)
                                ELSE locked_until END
      WHERE id = $1
      RETURNING failed_attempts`,
    [accountId, Number.MAX_SAFE_INTEGER, lockMinutes],
  );
  return rows[0]?.failed_attempts ?? 0;
}

export async function noteSuccessfulLogin(db: Client, accountId: string): Promise<void> {
  await db.query(
    `UPDATE iam.account
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
      WHERE id = $1`,
    [accountId],
  );
}

export async function setBlocked(
  db: Client,
  accountId: string,
  blocked: boolean,
  reason: string | null,
): Promise<void> {
  await db.query(
    `UPDATE iam.account
        SET is_blocked = $2, blocked_reason = $3, updated_at = now(), version = version + 1
      WHERE id = $1`,
    [accountId, blocked, reason],
  );
}

export interface SessionRow {
  readonly id: string;
  readonly accountId: string;
  readonly activeAssignmentId: string;
  readonly expiresAt: string;
  readonly closedAt: string | null;
  readonly closeReason: string | null;
}

interface RawSession {
  id: string; account_id: string; active_assignment_id: string;
  expires_at: Date; closed_at: Date | null; close_reason: string | null;
}

function toSession(row: RawSession): SessionRow {
  return {
    id: row.id, accountId: row.account_id, activeAssignmentId: row.active_assignment_id,
    expiresAt: row.expires_at.toISOString(),
    closedAt: row.closed_at === null ? null : row.closed_at.toISOString(),
    closeReason: row.close_reason,
  };
}

const SESSION_COLUMNS = `
  id::text AS id, account_id::text AS account_id,
  active_assignment_id::text AS active_assignment_id, expires_at, closed_at, close_reason
`;

export async function insertSession(
  db: Client,
  session: {
    readonly id: string; readonly accountId: string; readonly activeAssignmentId: string;
    readonly maxHours: number; readonly ip: string | null; readonly userAgent: string | null;
  },
): Promise<SessionRow> {
  const { rows } = await db.query<RawSession>(
    `INSERT INTO iam.session (id, account_id, active_assignment_id, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5::inet, $6)
     RETURNING ${SESSION_COLUMNS}`,
    [session.id, session.accountId, session.activeAssignmentId, session.maxHours, session.ip, session.userAgent],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('Сессия не создана.');
  return toSession(row);
}

/**
 * Действующая сессия: не закрыта, не истекла по предельному сроку и не
 * истекла по бездействию (docs/05-ДОСТУП.md § 10.3).
 */
export async function selectLiveSession(
  db: Client,
  id: string,
  idleMinutes: number,
): Promise<SessionRow | undefined> {
  const { rows } = await db.query<RawSession>(
    `SELECT ${SESSION_COLUMNS}
       FROM iam.session
      WHERE id = $1
        AND closed_at IS NULL
        AND expires_at > now()
        AND last_seen_at > now() - make_interval(mins => $2)`,
    [id, idleMinutes],
  );
  const row = rows[0];
  return row === undefined ? undefined : toSession(row);
}

export async function touchSession(db: Client, id: string): Promise<void> {
  await db.query('UPDATE iam.session SET last_seen_at = now() WHERE id = $1', [id]);
}

export async function setActiveAssignment(db: Client, id: string, assignmentId: string): Promise<void> {
  await db.query('UPDATE iam.session SET active_assignment_id = $2 WHERE id = $1', [id, assignmentId]);
}

export async function closeSession(db: Client, id: string, reason: string): Promise<void> {
  await db.query(
    'UPDATE iam.session SET closed_at = now(), close_reason = $2 WHERE id = $1 AND closed_at IS NULL',
    [id, reason],
  );
}

export async function closeAllSessions(db: Client, accountId: string, reason: string): Promise<number> {
  const { rowCount } = await db.query(
    'UPDATE iam.session SET closed_at = now(), close_reason = $2 WHERE account_id = $1 AND closed_at IS NULL',
    [accountId, reason],
  );
  return rowCount ?? 0;
}

/** Открытые сессии учётной записи, старейшая первой: предел § 10.3. */
export async function selectOpenSessions(db: Client, accountId: string): Promise<readonly SessionRow[]> {
  const { rows } = await db.query<RawSession>(
    `SELECT ${SESSION_COLUMNS}
       FROM iam.session
      WHERE account_id = $1 AND closed_at IS NULL AND expires_at > now()
      ORDER BY created_at`,
    [accountId],
  );
  return rows.map(toSession);
}
