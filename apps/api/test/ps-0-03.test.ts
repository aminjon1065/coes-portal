import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPosition, createPerson, createAssignment, createDelegation } from '../src/modules/org/public.ts';
import { grantRole } from '../src/modules/access/public.ts';
import { prepare, makePerson, signIn, asUser, today, type Environment } from './scenario-osnovanie.ts';

/**
 * ПС-0-03. Замещение по приказу — docs/10-ЭТАПЫ.md § 2, § 5 доступа.
 *
 * Замещение расширяет область видимости замещающего, но НЕ передаётся
 * дальше: замещение замещающего третьим лицом прав руководителя третьему
 * лицу не даёт. Нетранзитивность выражена постройкой access.visible_units,
 * а не проверкой в коде.
 */
describe('ПС-0-03. Замещение по приказу', () => {
  let env: Environment;
  beforeAll(async () => { env = await prepare('ps003'); }, 120_000);
  afterAll(async () => { await env.app.close(); await env.db.drop(); });

  it('замещающий получает область замещаемого, а третье лицо — нет', async () => {
    // Руководитель Согдийской области: его область — своё поддерево.
    const head = await makePerson(env, {
      lastName: 'Каримов', orgUnitCode: 'SUG', positionName: 'Начальник управления',
      roleCode: 'HEAD_UNIT', login: 'karimov',
    });
    // Специалист Хатлонской области: соседнее поддерево, а не вышестоящее.
    // Центральный аппарат для этой проверки не годится: он корень дерева,
    // и его поддерево включает все области — область замещаемого была бы
    // видна и без замещения.
    const specialist = await makePerson(env, {
      lastName: 'Ғафуров', orgUnitCode: 'KHA', positionName: 'Специалист управления',
      roleCode: 'SPECIALIST', login: 'gafurov',
    });

    const beforeSession = await signIn(env, specialist);
    const before = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, beforeSession),
    });
    const beforeUnits = before.json<{ visibleOrgUnitIds: string[] }>().visibleOrgUnitIds;

    // 1) руководитель оформляет замещение своего назначения на специалиста
    const delegation = await createDelegation(env.db.client, {
      personId: head.personId, assignmentId: head.assignmentId,
      delegationId: null, sessionId: null, ip: null, requestId: null,
    }, {
      delegatorAssignmentId: head.assignmentId,
      delegateAssignmentId: specialist.assignmentId,
      orderNumber: '12',
      startedOn: today(0),
      endedOn: today(14),
      reason: 'Отпуск',
    });
    expect(delegation.orderNumber).toBe('12');

    // 2) вход под специалистом
    const session = await signIn(env, specialist);
    const answer = await env.app.inject({
      method: 'GET', url: '/api/v1/auth/session', cookies: asUser(env, session),
    });
    expect(answer.statusCode, answer.body).toBe(200);
    const view = answer.json<{
      delegations: { positionTitle: string; orderNumber: string }[];
      visibleOrgUnitIds: string[];
    }>();

    // В шапке видна пометка «Замещает: <должность>, приказ № 12» (§ 5.3).
    expect(view.delegations.length).toBe(1);
    expect(view.delegations[0]?.positionTitle).toBe('Начальник управления');
    expect(view.delegations[0]?.orderNumber).toBe('12');

    // Область видимости расширилась областью замещаемого.
    expect(view.visibleOrgUnitIds).toContain(env.units['SUG']);
    expect(beforeUnits, 'до замещения чужая область была недоступна').not.toContain(env.units['SUG']);

    // 3–4) объект, созданный до начала замещения, открывается и изменяется
    const foreign = await env.app.inject({
      method: 'GET', url: `/api/v1/org-units/${String(env.units['SUG'])}`,
      cookies: asUser(env, session),
    });
    expect(foreign.statusCode, 'объект замещаемого открывается').toBe(200);

    // Дополнительно: замещение замещающего третьим лицом прав руководителя
    // третьему лицу не даёт.
    const thirdPosition = await createPosition(env.db.client, env.admin, {
      orgUnitId: String(env.units['DUS']), name: 'Оператор', isHead: false,
    });
    const thirdPerson = await createPerson(env.db.client, env.admin, {
      lastName: 'Ҷумъаев', firstName: 'Қосим', middleName: null,
    });
    const thirdAssignment = await createAssignment(env.db.client, env.admin, {
      personId: thirdPerson.id, positionId: thirdPosition.id,
      startedOn: today(-5), orderNumber: '9', isPrimary: true,
    });
    await grantRole(env.db.client, env.admin, {
      assignmentId: thirdAssignment.id, roleCode: 'SPECIALIST',
    });
    await createDelegation(env.db.client, {
      personId: specialist.personId, assignmentId: specialist.assignmentId,
      delegationId: null, sessionId: null, ip: null, requestId: null,
    }, {
      delegatorAssignmentId: specialist.assignmentId,
      delegateAssignmentId: thirdAssignment.id,
      orderNumber: '13',
      startedOn: today(0),
      endedOn: today(7),
      reason: 'Проверка нетранзитивности',
    });

    const { rows } = await env.db.client.query<{ org_unit_id: string }>(
      'SELECT org_unit_id::text AS org_unit_id FROM access.visible_units($1)',
      [thirdAssignment.id],
    );
    const thirdUnits = rows.map((row) => row.org_unit_id);
    expect(thirdUnits, 'третье лицо получает область замещающего').toContain(env.units['KHA']);
    expect(thirdUnits, 'но НЕ область руководителя: замещение не передаётся дальше')
      .not.toContain(env.units['SUG']);

    // Запись журнала о замещении сделана от имени руководителя.
    const { rows: journal } = await env.db.client.query<{ entity_label: string | null }>(
      "SELECT entity_label FROM audit.event WHERE action = 'delegation.create' ORDER BY id LIMIT 1",
    );
    expect(journal[0]?.entity_label).toContain('приказ №12');
  }, 120_000);
});
