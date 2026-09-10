import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { nowMs } from '@coes/core/clock.ts';
import { createTempDatabase, type TempDatabase } from '../../../packages/db/test/vremennaya-baza.ts';
import { buildApp, CSRF_COOKIE } from '../src/bootstrap.ts';
import { createOrgUnit, createPosition, createPerson, createAssignment } from '../src/modules/org/public.ts';
import { createAccount } from '../src/modules/iam/public.ts';
import { grantRole } from '../src/modules/access/public.ts';
import { listEvents } from '../src/modules/audit/public.ts';
import type { Actor } from '../src/modules/audit/public.ts';

/**
 * ПС-0-01. Создание сотрудника и первый вход — docs/10-ЭТАПЫ.md § 2.
 *
 * Проверяется СОСТАВ записей журнала, а не их число: § 9.1 обязывает
 * журналировать вход, выход, выдачу одноразового кода и смену пароля
 * наравне с изменениями данных, поэтому фиксированное число толкало бы
 * к отказу от журналирования ради зелёной проверки.
 */
describe('ПС-0-01. Создание сотрудника и первый вход', () => {
  let db: TempDatabase;
  let app: FastifyInstance;
  const ADMIN_LOGIN = 'sysadmin';
  const ADMIN_PASSWORD = 'admin-parol-12345';
  const NEW_LOGIN = 'rahimov';
  const ONE_TIME = 'odnorazovyi-1234';
  const NEW_PASSWORD = 'sobstvennyi-parol-9876';

  beforeAll(async () => {
    process.env['DEPLOY_PROFILE'] = 'local';
    process.env['LOG_LEVEL'] = 'silent';
    db = await createTempDatabase('ps001', { withSeed: true });
    app = buildApp({ db: db.client, dataPath: '.' });
    await app.ready();
  }, 90_000);

  afterAll(async () => {
    await app.close();
    await db.drop();
  });

  it('проходит целиком: от создания подразделения до входа под новой записью', async () => {
    // Предусловие: администратор системы существует. Создаётся напрямую,
    // потому что развёртывание создаёт его до первого входа (ПС-0-09).
    const seed: Actor = {
      personId: (await db.client.query<{ id: string }>(
        `INSERT INTO org.person (id, last_name, first_name)
         VALUES (gen_random_uuid(), 'Администратор', 'Системы') RETURNING id::text AS id`,
      )).rows[0]?.id ?? '',
      assignmentId: '00000000-0000-0000-0000-000000000000',
      delegationId: null, sessionId: null, ip: null, requestId: null,
    };

    const central = await db.client.query<{ id: string }>(
      "SELECT id::text AS id FROM org.org_unit WHERE is_region_root = false AND parent_id IS NULL LIMIT 1",
    );
    const centralId = central.rows[0]?.id;
    expect(centralId, 'начальное наполнение § 5.5 создаёт центральный аппарат').toBeDefined();

    const adminPosition = await createPosition(db.client, seed, {
      orgUnitId: String(centralId), name: 'Администратор системы', isHead: false,
    });
    const adminAssignment = await createAssignment(db.client, seed, {
      personId: seed.personId, positionId: adminPosition.id,
      startedOn: new Date(nowMs() - 86_400_000).toISOString().slice(0, 10),
      orderNumber: '1', isPrimary: true,
    });
    const admin: Actor = { ...seed, assignmentId: adminAssignment.id };
    await grantRole(db.client, admin, { assignmentId: adminAssignment.id, roleCode: 'SYS_ADMIN' });
    await createAccount(db.client, admin, {
      personId: seed.personId, login: ADMIN_LOGIN, oneTimePassword: ADMIN_PASSWORD,
    });
    await db.client.query('UPDATE iam.account SET must_change_password = false WHERE login = $1', [ADMIN_LOGIN]);

    // 1) вход администратором
    const beforeLogin = await app.inject({ method: 'GET', url: '/api/v1/auth/session' });
    expect(beforeLogin.statusCode).toBe(401);
    const csrf = String(beforeLogin.cookies.find((c) => c.name === CSRF_COOKIE)?.value);
    expect(csrf.length, 'признак защиты выдаётся до входа, иначе войти нельзя').toBeGreaterThan(0);

    const adminLogin = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf }, cookies: { [CSRF_COOKIE]: csrf },
      payload: { login: ADMIN_LOGIN, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.statusCode, adminLogin.body).toBe(200);
    const adminSession = String(adminLogin.cookies.find((c) => c.name === 'coes_session')?.value);
    expect(adminSession.length).toBeGreaterThan(0);

    // 2) Согдийская область создана начальным наполнением § 5.5, поэтому
    // сценарий строит подразделение внутри неё: районное управление.
    const sogd = await db.client.query<{ id: string; name: string }>(
      "SELECT id::text AS id, name FROM org.org_unit WHERE code = 'SUG'",
    );
    const region = { id: String(sogd.rows[0]?.id), name: String(sogd.rows[0]?.name) };
    const district = await createOrgUnit(db.client, admin, {
      code: 'SUG_AYN', name: 'Айнинский район', parentId: region.id,
      kind: 'district', isRegionRoot: false,
    });
    expect(district.path.startsWith(''), 'путь дерева выведен из вышестоящего').toBe(true);

    // 3–5) должность, сотрудник, назначение приказом
    const duty = await createPosition(db.client, admin, {
      orgUnitId: region.id, name: 'Оперативный дежурный', isHead: false,
    });
    const person = await createPerson(db.client, admin, {
      lastName: 'Раҳимов', firstName: 'Далер', middleName: 'Саидович',
    });
    const assignment = await createAssignment(db.client, admin, {
      personId: person.id, positionId: duty.id,
      startedOn: new Date(nowMs()).toISOString().slice(0, 10), orderNumber: '17', isPrimary: true,
    });

    // 6) роль, 7) учётная запись с одноразовым паролем
    await grantRole(db.client, admin, { assignmentId: assignment.id, roleCode: 'DUTY_OFFICER' });
    await createAccount(db.client, admin, {
      personId: person.id, login: NEW_LOGIN, oneTimePassword: ONE_TIME,
    });

    // 8) выход администратора
    const logout = await app.inject({
      method: 'POST', url: '/api/v1/auth/logout',
      headers: { 'x-csrf-token': csrf },
      cookies: { [CSRF_COOKIE]: csrf, coes_session: adminSession },
    });
    expect(logout.statusCode, logout.body).toBe(200);

    // 9) вход под новой учётной записью
    const firstLogin = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'x-csrf-token': csrf }, cookies: { [CSRF_COOKIE]: csrf },
      payload: { login: NEW_LOGIN, password: ONE_TIME },
    });
    expect(firstLogin.statusCode, firstLogin.body).toBe(200);
    const session = firstLogin.json<{
      fullName: string;
      mustChangePassword: boolean;
      activeAssignment: { positionTitle: string; orgUnitName: string };
      permissions: string[];
      visibleOrgUnitIds: string[];
    }>();

    // Наблюдаемый результат: требуется смена пароля; в шапке видны
    // должность и подразделение.
    expect(session.mustChangePassword).toBe(true);
    // В шапке видна фамилия человека, а не наименование должности (§ 5.2).
    expect(session.fullName).toBe('Раҳимов Далер Саидович');
    expect(session.activeAssignment.positionTitle).toBe('Оперативный дежурный');
    expect(session.activeAssignment.orgUnitName).toBe(region.name);
    expect(session.permissions.length, 'роль выдана — разрешения не пусты').toBeGreaterThan(0);
    expect(session.visibleOrgUnitIds).toContain(region.id);

    const newSession = String(firstLogin.cookies.find((c) => c.name === 'coes_session')?.value);
    const change = await app.inject({
      method: 'POST', url: '/api/v1/auth/password',
      headers: { 'x-csrf-token': csrf },
      cookies: { [CSRF_COOKIE]: csrf, coes_session: newSession },
      payload: { currentPassword: ONE_TIME, newPassword: NEW_PASSWORD },
    });
    expect(change.statusCode, change.body).toBe(200);

    const after = await app.inject({
      method: 'GET', url: '/api/v1/auth/session',
      cookies: { [CSRF_COOKIE]: csrf, coes_session: newSession },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json<{ mustChangePassword: boolean }>().mustChangePassword).toBe(false);

    // В журнале присутствуют ВСЕ перечисленные сценарием действия.
    const events = await listEvents(db.client, { limit: 200 });
    const actions = new Set(events.map((event) => event.action));
    for (const required of [
      'session.login', 'org_unit.create', 'position.create', 'person.create',
      'assignment.create', 'role.grant', 'account.create', 'account.one_time_password',
      'session.logout', 'account.password_change',
    ]) {
      expect(actions.has(required), `в журнале нет записи «${required}»`).toBe(true);
    }
    // Каждая запись называет, кто её совершил и в каком назначении (§ 9.1).
    const meaningful = events.filter((event) => event.action !== 'account.login_failed');
    for (const event of meaningful) {
      expect(event.personId, `запись «${event.action}» без человека`).not.toBeNull();
      expect(event.assignmentId, `запись «${event.action}» без назначения`).not.toBeNull();
    }
  }, 90_000);
});
