import type { FastifyInstance } from 'fastify';
import { nowMs } from '@coes/core/clock.ts';
import { createTempDatabase, type TempDatabase } from '../../../packages/db/test/vremennaya-baza.ts';
import { buildApp, CSRF_COOKIE } from '../src/bootstrap.ts';
import { createPosition, createPerson, createAssignment } from '../src/modules/org/public.ts';
import { createAccount } from '../src/modules/iam/public.ts';
import { grantRole } from '../src/modules/access/public.ts';
import type { Actor } from '../src/modules/audit/public.ts';

/**
 * Общее предусловие приёмочных сценариев: развёрнутая система с
 * администратором (ПС-0-09). Собрано здесь, чтобы каждый сценарий проверял
 * своё, а не повторял разворачивание.
 */

export interface Environment {
  readonly db: TempDatabase;
  readonly app: FastifyInstance;
  readonly admin: Actor;
  readonly csrf: string;
  readonly adminSession: string;
  readonly units: Readonly<Record<string, string>>;
}

export function today(offsetDays = 0): string {
  return new Date(nowMs() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export interface PreparedPerson {
  readonly personId: string;
  readonly assignmentId: string;
  readonly login: string;
  readonly password: string;
}

export async function prepare(label: string): Promise<Environment> {
  process.env['DEPLOY_PROFILE'] = 'local';
  process.env['LOG_LEVEL'] = 'silent';
  const db = await createTempDatabase(label, { withSeed: true });
  const app = buildApp({ db: db.client, dataPath: '.' });
  await app.ready();

  const { rows } = await db.client.query<{ code: string; id: string }>(
    'SELECT code, id::text AS id FROM org.org_unit',
  );
  const units = Object.fromEntries(rows.map((row) => [row.code, row.id]));

  const person = await db.client.query<{ id: string }>(
    `INSERT INTO org.person (id, last_name, first_name)
     VALUES (gen_random_uuid(), 'Администратор', 'Системы') RETURNING id::text AS id`,
  );
  const seed: Actor = {
    personId: String(person.rows[0]?.id),
    assignmentId: '00000000-0000-0000-0000-000000000000',
    delegationId: null, sessionId: null, ip: null, requestId: null,
  };
  const position = await createPosition(db.client, seed, {
    orgUnitId: String(units['CA']), name: 'Администратор системы', isHead: false,
  });
  const assignment = await createAssignment(db.client, seed, {
    personId: seed.personId, positionId: position.id,
    startedOn: today(-30), orderNumber: '1', isPrimary: true,
  });
  const admin: Actor = { ...seed, assignmentId: assignment.id };
  await grantRole(db.client, admin, { assignmentId: assignment.id, roleCode: 'SYS_ADMIN' });
  await createAccount(db.client, admin, {
    personId: seed.personId, login: 'sysadmin', oneTimePassword: 'admin-parol-12345',
  });
  await db.client.query("UPDATE iam.account SET must_change_password = false WHERE login = 'sysadmin'");

  const first = await app.inject({ method: 'GET', url: '/api/v1/auth/session' });
  const csrf = String(first.cookies.find((cookie) => cookie.name === CSRF_COOKIE)?.value);
  const login = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'x-csrf-token': csrf }, cookies: { [CSRF_COOKIE]: csrf },
    payload: { login: 'sysadmin', password: 'admin-parol-12345' },
  });
  const adminSession = String(login.cookies.find((cookie) => cookie.name === 'coes_session')?.value);

  return { db, app, admin, csrf, adminSession, units };
}

/** Сотрудник с назначением, ролью и учётной записью. */
export async function makePerson(
  env: Environment,
  input: {
    readonly lastName: string; readonly orgUnitCode: string; readonly positionName: string;
    readonly roleCode: string; readonly login: string;
  },
): Promise<PreparedPerson> {
  const position = await createPosition(env.db.client, env.admin, {
    orgUnitId: String(env.units[input.orgUnitCode]), name: input.positionName, isHead: false,
  });
  const person = await createPerson(env.db.client, env.admin, {
    lastName: input.lastName, firstName: 'Имя', middleName: null,
  });
  const assignment = await createAssignment(env.db.client, env.admin, {
    personId: person.id, positionId: position.id,
    startedOn: today(-10), orderNumber: '5', isPrimary: true,
  });
  await grantRole(env.db.client, env.admin, { assignmentId: assignment.id, roleCode: input.roleCode });
  const password = `parol-${input.login}-123`;
  await createAccount(env.db.client, env.admin, {
    personId: person.id, login: input.login, oneTimePassword: password,
  });
  await env.db.client.query('UPDATE iam.account SET must_change_password = false WHERE login = $1', [input.login]);
  return { personId: person.id, assignmentId: assignment.id, login: input.login, password };
}

export async function signIn(env: Environment, who: PreparedPerson): Promise<string> {
  const answer = await env.app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'x-csrf-token': env.csrf }, cookies: { [CSRF_COOKIE]: env.csrf },
    payload: { login: who.login, password: who.password },
  });
  if (answer.statusCode !== 200) throw new Error(`Вход не удался: ${answer.body}`);
  return String(answer.cookies.find((cookie) => cookie.name === 'coes_session')?.value);
}

export function asUser(env: Environment, session: string): Readonly<Record<string, string>> {
  return { [CSRF_COOKIE]: env.csrf, coes_session: session };
}
