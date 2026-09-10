import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPosition, createAssignment } from '../src/modules/org/public.ts';
import { grantRole } from '../src/modules/access/public.ts';
import { listEvents } from '../src/modules/audit/public.ts';
import { prepare, makePerson, signIn, asUser, today, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-02. Две должности и переключение контекста — docs/10-ЭТАПЫ.md § 2.
 * Переключение меняет права и область видимости, поэтому проверяется
 * именно смена набора доступных подразделений, а не только надпись.
 */
describe('ПС-0-02. Две должности и переключение контекста', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps002'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  it('после переключения видно другое подразделение и другой набор разделов', async () => {
    const officer = await makePerson(env, {
      lastName: 'Раҳимов', orgUnitCode: 'SUG', positionName: 'Оперативный дежурный',
      roleCode: 'DUTY_OFFICER', login: 'rahimov',
    });

    // 1) второе назначение в другом подразделении
    const second = await createPosition(env.db.client, env.admin, {
      orgUnitId: String(env.units['KHA']), name: 'Специалист', isHead: false,
    });
    const secondAssignment = await createAssignment(env.db.client, env.admin, {
      personId: officer.personId, positionId: second.id,
      startedOn: today(-1), orderNumber: '6', isPrimary: false,
    });
    // Права принадлежат назначению, а не человеку (§ 1): второму
    // назначению выдана другая роль, и набор разрешений будет другим.
    await grantRole(env.db.client, env.admin, {
      assignmentId: secondAssignment.id, roleCode: 'SPECIALIST',
    });

    // 2) вход
    const session = await signIn(env, officer);
    const before = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, session),
    });
    const first = before.json<{
      activeAssignment: { orgUnitId: string; orgUnitName: string };
      assignments: { id: string }[];
      permissions: string[];
      visibleOrgUnitIds: string[];
    }>();
    expect(first.assignments.length, 'переключатель показывается при двух назначениях').toBe(2);
    expect(first.activeAssignment.orgUnitId).toBe(env.units['SUG']);
    expect(first.visibleOrgUnitIds).toContain(env.units['SUG']);
    expect(first.visibleOrgUnitIds).not.toContain(env.units['KHA']);

    // 3) переключение должности в шапке
    const switched = await env.app.inject({
      method: 'POST', url: '/api/v1/auth/context',
      headers: { 'x-csrf-token': env.csrf }, cookies: asUser(env, session),
      payload: { assignmentId: secondAssignment.id },
    });
    expect(switched.statusCode, switched.body).toBe(200);
    const after = switched.json<{
      activeAssignment: { orgUnitId: string };
      permissions: string[];
      visibleOrgUnitIds: string[];
    }>();
    expect(after.activeAssignment.orgUnitId).toBe(env.units['KHA']);
    expect(after.visibleOrgUnitIds).toContain(env.units['KHA']);
    expect(after.visibleOrgUnitIds, 'область видимости другая, а не расширенная')
      .not.toContain(env.units['SUG']);
    expect(new Set(after.permissions), 'набор разрешений другой: права у назначения, не у человека')
      .not.toEqual(new Set(first.permissions));

    // 4) реестр подразделений показывает другое подразделение
    const registry = await env.app.inject({
      method: 'GET', url: '/api/v1/org-units', cookies: asUser(env, session),
    });
    expect(registry.statusCode, registry.body).toBe(200);
    const codes = registry.json<{ items: { code: string }[] }>().items.map((item) => item.code);
    expect(codes).toContain('KHA');
    expect(codes).not.toContain('SUG');

    // В журнале есть запись о переключении с указанием обоих назначений.
    const events = await listEvents(env.db.client, { limit: 100 });
    const record = events.find((event) => event.action === 'session.switch_context');
    expect(record, 'переключение контекста журналируется (§ 9.1)').toBeDefined();
    const { rows } = await env.db.client.query<{ before_data: unknown; after_data: unknown }>(
      "SELECT before_data, after_data FROM audit.event WHERE action = 'session.switch_context' LIMIT 1",
    );
    expect(rows[0]?.before_data).toEqual({ assignmentId: officer.assignmentId });
    expect(rows[0]?.after_data).toEqual({ assignmentId: secondAssignment.id });
  }, 120_000);
});
