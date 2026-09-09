-- 0002. Служебная схема и журнал действий.
--
-- docs/04-ДАННЫЕ.md § 9.6, § 9.7, § 13; docs/05-ДОСТУП.md § 9.3; adr/12.
-- Журнал обязан выдерживать не только сбой, но и попытку исправить историю,
-- поэтому цепочка хешей считается триггером базы, а не программой: так её
-- нельзя записать неправильно ни из приложения, ни вручную.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS sys;
CREATE SCHEMA audit;

-- ─── Служебные таблицы (§ 9.7) ───────────────────────────────────────────

CREATE TABLE sys.setting (
  key                  text        PRIMARY KEY,
  value                text        NOT NULL,
  is_editable          boolean     NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid
);
COMMENT ON TABLE sys.setting IS
  'Настройки системы. BASE_URL, EXTRA_HOSTNAMES и REDIRECT_TO_BASE хранятся ТОЛЬКО здесь и переменными окружения не переопределяются (docs/03-АРХИТЕКТУРА.md § 5.11).';

CREATE TABLE sys.number_sequence (
  scope_key  text   PRIMARY KEY,
  next_value bigint NOT NULL DEFAULT 1
);
COMMENT ON TABLE sys.number_sequence IS
  'Выдача регистрационных номеров (§ 3.3). Повторное использование номера запрещено.';

CREATE TABLE sys.idempotency (
  key           uuid        PRIMARY KEY,
  request_hash  text        NOT NULL,
  response_body jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE sys.idempotency IS
  'Повтор запроса с тем же ключом возвращает прежний ответ (§ 5.4). Хранится 24 часа.';

-- ─── Журнал действий (§ 9.6) ─────────────────────────────────────────────

CREATE TABLE audit.event (
  id            bigserial   PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  person_id     uuid,
  assignment_id uuid,
  delegation_id uuid,
  session_id    uuid,
  ip            inet,
  request_id    text,
  action        text        NOT NULL,
  entity_schema text        NOT NULL,
  entity_table  text        NOT NULL,
  entity_id     uuid,
  entity_label  text,
  before_data   jsonb,
  after_data    jsonb,
  extra         jsonb,
  prev_hash     bytea,
  hash          bytea       NOT NULL
);

COMMENT ON COLUMN audit.event.entity_label IS
  'Наименование объекта НА МОМЕНТ действия: объект переименуют, а журнал обязан читаться спустя годы.';
COMMENT ON COLUMN audit.event.prev_hash IS
  'Хеш предыдущей записи. Изъятие или подмена записи обнаруживается pnpm audit:verify.';

CREATE INDEX ix_audit_event__occurred_at ON audit.event (occurred_at DESC);
CREATE INDEX ix_audit_event__entity ON audit.event (entity_schema, entity_table, entity_id);
CREATE INDEX ix_audit_event__person ON audit.event (person_id, occurred_at DESC);

-- Ключ блокировки: произвольное постоянное число, общее для всех вставок
-- в журнал. Сериализация нужна, чтобы две записи не получили один prev_hash.
CREATE FUNCTION audit.chain_lock_key() RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$ SELECT 776_144_001::bigint $fn$;

-- Каноническое представление строки для хеширования: jsonb упорядочивает
-- ключи детерминированно, поэтому один и тот же набор полей всегда даёт
-- один и тот же текст.
CREATE FUNCTION audit.canonical(event audit.event) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$fn$ SELECT ((to_jsonb(event) - 'hash') - 'prev_hash')::text $fn$;

CREATE FUNCTION audit.link_event() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  previous bytea;
BEGIN
  -- Сериализация вставок: без неё две записи в разных транзакциях получили бы
  -- один и тот же prev_hash, и цепочка распалась бы (§ 5.6).
  PERFORM pg_advisory_xact_lock(audit.chain_lock_key());

  SELECT e.hash INTO previous FROM audit.event e ORDER BY e.id DESC LIMIT 1;

  NEW.prev_hash := previous;
  NEW.hash := digest(coalesce(previous, ''::bytea) || audit.canonical(NEW)::bytea, 'sha256');
  RETURN NEW;
END
$fn$;

CREATE TRIGGER link_event BEFORE INSERT ON audit.event
  FOR EACH ROW EXECUTE FUNCTION audit.link_event();

-- Журнал только на добавление. Запрет держится в двух местах: правами роли
-- приложения (§ 13) и этим триггером — он закрывает и владельца схемы,
-- чтобы изменение записи требовало осознанного отключения триггера.
CREATE FUNCTION audit.forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'Журнал действий только на добавление: изменение и удаление записей запрещены (docs/05-ДОСТУП.md § 9.3).';
END
$fn$;

CREATE TRIGGER forbid_change BEFORE UPDATE OR DELETE ON audit.event
  FOR EACH ROW EXECUTE FUNCTION audit.forbid_change();

-- ─── Роли базы данных (§ 13) ─────────────────────────────────────────────
-- Роли живут в кластере, а не в базе, поэтому создание идемпотентно:
-- миграция применяется к каждой базе, в том числе к временным базам проверок.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coes_app')    THEN CREATE ROLE coes_app    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coes_pdn')    THEN CREATE ROLE coes_pdn    NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coes_backup') THEN CREATE ROLE coes_backup NOLOGIN; END IF;
END
$do$;

GRANT USAGE ON SCHEMA sys, audit TO coes_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sys.setting, sys.number_sequence, sys.idempotency TO coes_app;

-- Ключевое ограничение § 13: роль приложения может добавлять записи журнала
-- и читать их, но НЕ может изменять и удалять. Это право в базе, а не
-- проверка в программе.
GRANT SELECT, INSERT ON audit.event TO coes_app;
GRANT USAGE ON SEQUENCE audit.event_id_seq TO coes_app;

GRANT USAGE ON SCHEMA sys, audit TO coes_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA sys, audit TO coes_backup;
