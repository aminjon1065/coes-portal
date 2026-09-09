-- 0005. Учётные записи, роли, разрешения, область видимости.
--
-- docs/04-ДАННЫЕ.md § 9.4, § 9.5; docs/05-ДОСТУП.md § 1, § 2, § 4, § 5, § 8.8.
-- Субъект прав — назначение, а не человек. Область видимости вычисляется
-- функцией базы: от неё зависит, что человек видит, и повторять эту формулу
-- в каждом запросе значило бы однажды её забыть.

CREATE SCHEMA iam;
CREATE SCHEMA access;

-- ─── Учётные записи и сессии (§ 9.4) ─────────────────────────────────────

CREATE TABLE iam.account (
  id                   uuid        PRIMARY KEY,
  -- Один человек — одна учётная запись. Общих и обезличенных («дежурный»,
  -- «канцелярия») не бывает: они разрушают прослеживаемость (§ 10.1).
  person_id            uuid        NOT NULL UNIQUE REFERENCES org.person(id) ON DELETE RESTRICT,
  login                text        NOT NULL UNIQUE,
  password_hash        text        NOT NULL,
  password_algo        text        NOT NULL DEFAULT 'argon2id',
  must_change_password boolean     NOT NULL DEFAULT true,
  is_blocked           boolean     NOT NULL DEFAULT false,
  blocked_reason       text,
  last_login_at        timestamptz,
  failed_attempts      integer     NOT NULL DEFAULT 0,
  locked_until         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid REFERENCES org.person(id),
  version              integer     NOT NULL DEFAULT 1,

  CONSTRAINT ck_account__login_shape CHECK (login ~ '^[a-z][a-z0-9._-]{2,63}$'),
  CONSTRAINT ck_account__blocked_reason CHECK ((NOT is_blocked) OR blocked_reason IS NOT NULL),
  CONSTRAINT ck_account__failed CHECK (failed_attempts >= 0)
);

CREATE TABLE iam.session (
  id                   uuid        PRIMARY KEY,
  account_id           uuid        NOT NULL REFERENCES iam.account(id) ON DELETE RESTRICT,
  -- Рабочий контекст: в какой должности человек работает сейчас (§ 1).
  active_assignment_id uuid        NOT NULL REFERENCES org.assignment(id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,
  ip                   inet,
  user_agent           text,
  closed_at            timestamptz,
  close_reason         text,

  CONSTRAINT ck_session__expires CHECK (expires_at > created_at)
);

CREATE INDEX ix_session__account ON iam.session (account_id, created_at DESC);
CREATE INDEX ix_session__open ON iam.session (account_id) WHERE closed_at IS NULL;

CREATE TABLE iam.password_reset (
  id                    uuid        PRIMARY KEY,
  account_id            uuid        NOT NULL REFERENCES iam.account(id) ON DELETE RESTRICT,
  issued_by_person_id   uuid        NOT NULL REFERENCES org.person(id),
  issued_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  used_at               timestamptz,
  one_time_secret_hash  text        NOT NULL
);

COMMENT ON TABLE iam.password_reset IS
  'Восстановление доступа только через администратора (Д-05). Ссылок по почте не существует: почтовый ящик не является доверенным каналом в закрытом контуре.';

-- ─── Разрешения и роли (§ 9.5) ───────────────────────────────────────────

-- Перечень разрешений — КОД. Таблица заполняется этой миграцией из перечня
-- packages/contracts/permissions.ts; расхождение ловит проверка в test:db.
-- В интерфейсе таблица доступна только для чтения.
CREATE TABLE access.permission (
  code        text PRIMARY KEY,
  module      text NOT NULL,
  name        text NOT NULL,
  CONSTRAINT ck_permission__code_shape CHECK (code ~ '^[a-z][a-z_]*\.[a-z][a-z_]*\.[a-z][a-z_]*$')
);

CREATE TABLE access.role (
  id                   uuid        PRIMARY KEY,
  code                 text        NOT NULL UNIQUE,
  name                 text        NOT NULL COLLATE public.coll_tj,
  description          text,
  is_system            boolean     NOT NULL DEFAULT false,
  -- «Придумано нами» — как и у элементов справочников (§ 5.5): должности и
  -- роли Комитета нам неизвестны (Д-10). Системные роли не помечаются.
  is_provisional       boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid REFERENCES org.person(id),
  version              integer     NOT NULL DEFAULT 1,

  CONSTRAINT ck_role__code_shape CHECK (code ~ '^[A-Z][A-Z_]{1,40}$')
);

CREATE TABLE access.role_permission (
  role_id         uuid NOT NULL REFERENCES access.role(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES access.permission(code) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE access.assignment_role (
  assignment_id       uuid        NOT NULL REFERENCES org.assignment(id) ON DELETE RESTRICT,
  role_id             uuid        NOT NULL REFERENCES access.role(id) ON DELETE RESTRICT,
  granted_by_person_id uuid       REFERENCES org.person(id),
  granted_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, role_id)
);

CREATE TYPE access.scope_kind_enum AS ENUM ('own_subtree', 'all_regions', 'extra_subtree');

CREATE TABLE access.scope_grant (
  id                   uuid        PRIMARY KEY,
  assignment_id        uuid        NOT NULL REFERENCES org.assignment(id) ON DELETE RESTRICT,
  kind                 access.scope_kind_enum NOT NULL,
  org_unit_id          uuid        REFERENCES org.org_unit(id) ON DELETE RESTRICT,
  granted_by_person_id uuid        REFERENCES org.person(id),
  granted_at           timestamptz NOT NULL DEFAULT now(),
  -- Право «все регионы» выдаётся ТОЧЕЧНО и на основании: из должности оно
  -- не следует и ролью не выдаётся (§ 4.4).
  reason               text        NOT NULL,

  CONSTRAINT ck_scope_grant__unit CHECK (
    (kind = 'extra_subtree' AND org_unit_id IS NOT NULL) OR
    (kind <> 'extra_subtree' AND org_unit_id IS NULL)
  ),
  CONSTRAINT ck_scope_grant__reason CHECK (btrim(reason) <> '')
);

CREATE INDEX ix_scope_grant__assignment ON access.scope_grant (assignment_id);

-- Обращение к чужому содержимому (§ 8.8).
CREATE TABLE access.foreign_access (
  id                     uuid        PRIMARY KEY,
  requester_person_id    uuid        NOT NULL REFERENCES org.person(id),
  requester_assignment_id uuid       NOT NULL REFERENCES org.assignment(id),
  target_schema          text        NOT NULL,
  target_table           text        NOT NULL,
  target_id              uuid,
  purpose                text        NOT NULL,
  basis                  text        NOT NULL,
  requested_at           timestamptz NOT NULL DEFAULT now(),
  approved_by_person_id  uuid        REFERENCES org.person(id),
  approved_at            timestamptz,
  valid_until            timestamptz,
  revoked_at             timestamptz,

  CONSTRAINT ck_foreign_access__purpose CHECK (btrim(purpose) <> '' AND btrim(basis) <> ''),
  -- Самоутверждение запрещено ограничением, а не порядком работы (§ 8.8).
  CONSTRAINT ck_foreign_access__not_self
    CHECK (approved_by_person_id IS NULL OR approved_by_person_id <> requester_person_id),
  CONSTRAINT ck_foreign_access__approved
    CHECK (approved_at IS NULL OR (approved_by_person_id IS NOT NULL AND valid_until IS NOT NULL))
);

-- ─── Область видимости (§ 4.1) ───────────────────────────────────────────

-- Пункты 1–2 формулы БЕЗ учёта замещений. Отдельная функция существует ради
-- запрета транзитивности (§ 5.2, п. 3): область замещаемого вычисляется
-- именно ею, поэтому замещение замещающего прав не передаёт.
CREATE FUNCTION access.visible_units_direct(assignment uuid)
RETURNS TABLE (org_unit_id uuid)
LANGUAGE sql STABLE AS
$fn$
  WITH grants AS (
    SELECT g.kind, g.org_unit_id FROM access.scope_grant g WHERE g.assignment_id = assignment
  ),
  own_unit AS (
    SELECT u.path FROM org.assignment a
    JOIN org.position p ON p.id = a.position_id
    JOIN org.org_unit u ON u.id = p.org_unit_id
    WHERE a.id = assignment
  ),
  roots AS (
    SELECT path FROM own_unit
    UNION ALL
    SELECT u.path FROM grants g JOIN org.org_unit u ON u.id = g.org_unit_id
    WHERE g.kind = 'extra_subtree'
  )
  SELECT u.id FROM org.org_unit u
  WHERE EXISTS (SELECT 1 FROM grants WHERE kind = 'all_regions')
     OR EXISTS (SELECT 1 FROM roots r WHERE u.path <@ r.path);
$fn$;

-- Полная формула: собственная область плюс области замещаемых назначений.
-- Замещение действует, только если обе стороны — действующие назначения
-- (§ 5.2, п. 5).
CREATE FUNCTION access.visible_units(assignment uuid)
RETURNS TABLE (org_unit_id uuid)
LANGUAGE sql STABLE AS
$fn$
  SELECT d.org_unit_id FROM access.visible_units_direct(assignment) d
  UNION
  SELECT v.org_unit_id
  FROM org.delegation dg
  JOIN org.assignment delegate ON delegate.id = dg.delegate_assignment_id
  JOIN org.assignment delegator ON delegator.id = dg.delegator_assignment_id
  CROSS JOIN LATERAL access.visible_units_direct(dg.delegator_assignment_id) v
  WHERE dg.delegate_assignment_id = assignment
    AND NOT dg.is_revoked
    AND current_date BETWEEN dg.started_on AND dg.ended_on
    AND (delegate.ended_on IS NULL OR delegate.ended_on >= current_date)
    AND (delegator.ended_on IS NULL OR delegator.ended_on >= current_date);
$fn$;

COMMENT ON FUNCTION access.visible_units(uuid) IS
  'Область видимости назначения (docs/05-ДОСТУП.md § 4.1). Вычисляется на каждый запрос, без кэширования: отзыв прав, окончание замещения и блокировка обязаны действовать немедленно (§ 4.5).';

GRANT USAGE ON SCHEMA iam, access TO coes_app;
GRANT SELECT, INSERT, UPDATE ON iam.account, iam.session, iam.password_reset TO coes_app;
GRANT SELECT ON access.permission TO coes_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON access.role, access.role_permission,
  access.assignment_role, access.scope_grant, access.foreign_access TO coes_app;
GRANT USAGE ON SCHEMA iam, access TO coes_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA iam, access TO coes_backup;

-- Перенос перечня разрешений из packages/contracts/permissions.ts (§ 9.5).
INSERT INTO access.permission (code, module, name) VALUES
  ('iam.account.read', 'iam', 'Видеть список учётных записей'),
  ('iam.account.create', 'iam', 'Создавать учётную запись'),
  ('iam.account.update', 'iam', 'Изменять учётную запись'),
  ('iam.account.block', 'iam', 'Блокировать и разблокировать'),
  ('iam.account.reset_password', 'iam', 'Выдавать одноразовый код смены пароля'),
  ('org.unit.read', 'org', 'Видеть оргструктуру'),
  ('org.unit.manage', 'org', 'Создавать и изменять подразделения'),
  ('org.position.manage', 'org', 'Создавать и изменять должности'),
  ('org.person.read', 'org', 'Видеть карточки сотрудников'),
  ('org.person.manage', 'org', 'Создавать и изменять карточки сотрудников'),
  ('org.assignment.manage', 'org', 'Назначать на должность и снимать'),
  ('org.delegation.create', 'org', 'Оформлять замещение своего назначения'),
  ('org.delegation.manage_any', 'org', 'Оформлять и отзывать любое замещение в своей области'),
  ('access.role.read', 'access', 'Видеть роли и их состав'),
  ('access.role.manage', 'access', 'Создавать роли и менять их состав'),
  ('access.grant.manage', 'access', 'Выдавать роли назначениям'),
  ('access.scope.manage', 'access', 'Выдавать право «все регионы» и дополнительные области'),
  ('ref.catalog.manage', 'ref', 'Изменять справочники'),
  ('sys.setting.read', 'sys', 'Видеть настройки'),
  ('sys.setting.manage', 'sys', 'Изменять настройки и пределы'),
  ('sys.status.read', 'sys', 'Видеть состояние сервера'),
  ('audit.event.read_all', 'audit', 'Открывать журнал действий целиком'),
  ('audit.event.verify', 'audit', 'Запускать проверку целостности журнала'),
  ('system.content.read_foreign', 'system', 'Обращаться к чужому содержимому по процедуре'),
  ('store.blob.upload', 'store', 'Загружать файлы'),
  ('incident.card.read', 'incident', 'Видеть события своей области'),
  ('incident.card.create', 'incident', 'Создавать событие'),
  ('incident.card.update', 'incident', 'Изменять событие'),
  ('incident.card.register', 'incident', 'Регистрировать событие с присвоением номера'),
  ('incident.card.close', 'incident', 'Закрывать событие'),
  ('incident.card.reopen', 'incident', 'Переоткрывать закрытое событие'),
  ('incident.card.cancel', 'incident', 'Аннулировать событие'),
  ('incident.card.export', 'incident', 'Выгружать реестр событий'),
  ('incident.duty.manage', 'incident', 'Открывать и закрывать дежурную смену'),
  ('incident.summary.create', 'incident', 'Формировать суточную сводку'),
  ('incident.summary.approve', 'incident', 'Утверждать суточную сводку'),
  ('geo.layer.read', 'geo', 'Видеть слои'),
  ('geo.layer.manage', 'geo', 'Создавать, изменять и удалять слои'),
  ('geo.layer.import', 'geo', 'Загружать слой из файла'),
  ('pdn.person.read_depersonalized', 'pdn', 'Видеть обезличенный список пострадавших'),
  ('pdn.person.read_identity', 'pdn', 'Видеть фамилии, даты рождения, адреса, сведения о здоровье'),
  ('pdn.person.manage', 'pdn', 'Вносить и изменять сведения о пострадавших'),
  ('pdn.person.export_identity', 'pdn', 'Выгружать сведения о пострадавших в открытом виде'),
  ('pdn.person.depersonalize', 'pdn', 'Утверждать акт обезличивания по истечении срока'),
  ('analytics.dashboard.read', 'analytics', 'Открывать панели показателей'),
  ('analytics.crosstab.build', 'analytics', 'Строить перекрёстные таблицы'),
  ('analytics.report.create', 'analytics', 'Формировать отчёт'),
  ('analytics.report.read_any', 'analytics', 'Видеть отчёты, сформированные другими'),
  ('template.template.read', 'template', 'Видеть шаблоны'),
  ('template.template.manage', 'template', 'Загружать и изменять шаблоны');
