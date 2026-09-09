-- Начальные роли и состав разрешений (docs/05-ДОСТУП.md § 3, § 3.1).
--
-- Роли — ДАННЫЕ: администратор создаёт свои и меняет состав. Перечень
-- разрешений при этом — код, и новых из интерфейса не появится (§ 2.1).
-- Несистемные роли помечены как придуманные (Д-10).
--
-- Идемпотентно.

BEGIN;

INSERT INTO access.role (id, code, name, is_system, is_provisional) VALUES
  (gen_random_uuid(), 'SYS_ADMIN',        'Администратор системы',              true,  false),
  (gen_random_uuid(), 'REGION_ADMIN',     'Администратор региона',              true,  false),
  (gen_random_uuid(), 'SECURITY_AUDITOR', 'Ответственный за журнал действий',   true,  false),
  (gen_random_uuid(), 'DUTY_OFFICER',     'Оперативный дежурный',               false, true),
  (gen_random_uuid(), 'SPECIALIST',       'Специалист',                         false, true),
  (gen_random_uuid(), 'ANALYST',          'Аналитик',                           false, true),
  (gen_random_uuid(), 'HEAD_UNIT',        'Руководитель подразделения',         false, true),
  (gen_random_uuid(), 'HEAD_ORG',         'Руководство Комитета',               false, true),
  (gen_random_uuid(), 'CLERK',            'Делопроизводитель',                  false, true),
  (gen_random_uuid(), 'ARCHIVIST',        'Архивист',                           false, true),
  (gen_random_uuid(), 'PDN_OPERATOR',     'Оператор персональных данных',       false, true)
ON CONFLICT (code) DO NOTHING;

CREATE TEMP TABLE матрица (role_code text, permission_code text) ON COMMIT DROP;

-- Администраторы ведут учётные записи и структуру, но НЕ читают рабочее
-- содержимое: у них нет incident.card.read (§ 3.1, примечание).
INSERT INTO матрица
SELECT 'SYS_ADMIN', unnest(ARRAY[
  'iam.account.read','iam.account.create','iam.account.update','iam.account.block','iam.account.reset_password',
  'org.unit.manage','org.position.manage','org.person.read','org.person.manage','org.assignment.manage',
  'org.delegation.manage_any','access.role.read','access.role.manage','access.grant.manage','access.scope.manage',
  'ref.catalog.manage','sys.setting.read','sys.setting.manage','sys.status.read',
  'geo.layer.manage','geo.layer.import','template.template.manage','store.blob.upload'])
UNION ALL SELECT 'REGION_ADMIN', unnest(ARRAY[
  'iam.account.read','iam.account.create','iam.account.update','iam.account.block','iam.account.reset_password',
  'org.unit.manage','org.position.manage','org.person.read','org.person.manage','org.assignment.manage',
  'org.delegation.manage_any','store.blob.upload'])
UNION ALL SELECT 'SECURITY_AUDITOR', unnest(ARRAY[
  'org.person.read','audit.event.read_all','audit.event.verify','system.content.read_foreign'])
UNION ALL SELECT 'DUTY_OFFICER', unnest(ARRAY[
  'org.person.read','incident.card.read','incident.card.create','incident.card.update','incident.card.register',
  'incident.duty.manage','incident.summary.create','geo.layer.read','pdn.person.read_depersonalized',
  'analytics.dashboard.read','store.blob.upload'])
UNION ALL SELECT 'SPECIALIST', unnest(ARRAY[
  'org.person.read','incident.card.read','incident.card.create','incident.card.update',
  'geo.layer.read','geo.layer.manage','geo.layer.import','pdn.person.read_depersonalized',
  'analytics.dashboard.read','store.blob.upload'])
UNION ALL SELECT 'ANALYST', unnest(ARRAY[
  'org.person.read','incident.card.read','incident.card.export','geo.layer.read',
  'pdn.person.read_depersonalized','analytics.dashboard.read','analytics.crosstab.build',
  'analytics.report.create','store.blob.upload'])
UNION ALL SELECT 'HEAD_UNIT', unnest(ARRAY[
  'org.person.read','org.delegation.create','incident.card.read','incident.card.create','incident.card.update',
  'incident.card.register','incident.card.close','incident.card.export','incident.duty.manage',
  'incident.summary.create','incident.summary.approve','geo.layer.read','pdn.person.read_depersonalized',
  'analytics.dashboard.read','analytics.crosstab.build','analytics.report.create','store.blob.upload'])
UNION ALL SELECT 'HEAD_ORG', unnest(ARRAY[
  'org.person.read','org.delegation.create','incident.card.read','incident.card.create','incident.card.update',
  'incident.card.register','incident.card.close','incident.card.reopen','incident.card.cancel',
  'incident.card.export','incident.duty.manage','incident.summary.create','incident.summary.approve',
  'geo.layer.read','pdn.person.read_depersonalized','pdn.person.export_identity',
  'analytics.dashboard.read','analytics.crosstab.build','analytics.report.create','analytics.report.read_any',
  'store.blob.upload'])
UNION ALL SELECT 'CLERK', unnest(ARRAY[
  'org.person.read','incident.card.read','analytics.dashboard.read','template.template.manage','store.blob.upload'])
UNION ALL SELECT 'ARCHIVIST', unnest(ARRAY[
  'org.person.read','pdn.person.depersonalize','store.blob.upload'])
UNION ALL SELECT 'PDN_OPERATOR', unnest(ARRAY[
  'org.person.read','incident.card.read','pdn.person.read_depersonalized','pdn.person.read_identity',
  'pdn.person.manage','store.blob.upload']);

INSERT INTO access.role_permission (role_id, permission_code)
SELECT r.id, m.permission_code
FROM матрица m
JOIN access.role r ON r.code = m.role_code
JOIN access.permission p ON p.code = m.permission_code
ON CONFLICT DO NOTHING;

COMMIT;
