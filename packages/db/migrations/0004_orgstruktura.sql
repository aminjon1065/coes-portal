-- 0004. Организационная структура.
--
-- docs/04-ДАННЫЕ.md § 9.3, docs/05-ДОСТУП.md § 1, § 4, § 5.
-- Субъект прав — НАЗНАЧЕНИЕ, а не человек: один человек может занимать
-- несколько должностей, в том числе в разных подразделениях, и права у них
-- разные. Дерево подразделений — основание области видимости, поэтому его
-- путь поддерживается базой, а не программой.

CREATE EXTENSION IF NOT EXISTS ltree;

CREATE SCHEMA org;

CREATE TYPE org.unit_kind_enum AS ENUM ('central', 'region', 'district', 'other');

-- ─── Сотрудники ──────────────────────────────────────────────────────────

CREATE TABLE org.person (
  id                   uuid        PRIMARY KEY,
  last_name            text        NOT NULL COLLATE public.coll_tj,
  first_name           text        NOT NULL COLLATE public.coll_tj,
  middle_name          text        COLLATE public.coll_tj,
  birth_date           date,
  phone                text,
  -- Контактные сведения. Во входе, восстановлении доступа и уведомлениях
  -- не участвуют: почтового канала в системе нет (01-ПРОДУКТ § 5).
  email                text,
  photo_blob_id        uuid,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid,
  version              integer     NOT NULL DEFAULT 1,

  full_name_norm text GENERATED ALWAYS AS (
    public.tj_norm(last_name || ' ' || first_name || ' ' || coalesce(middle_name, ''))
  ) STORED
);

COMMENT ON COLUMN org.person.photo_blob_id IS
  'Ссылка на двоичный объект. Внешний ключ добавится вместе со схемой store.';

CREATE INDEX ix_person__full_name_norm ON org.person USING gin (full_name_norm public.gin_trgm_ops);
CREATE INDEX ix_person__last_name ON org.person (last_name, first_name);

-- ─── Подразделения ───────────────────────────────────────────────────────

CREATE TABLE org.org_unit (
  id                   uuid        PRIMARY KEY,
  code                 text        NOT NULL UNIQUE,
  name                 text        NOT NULL COLLATE public.coll_tj,
  short_name           text        COLLATE public.coll_tj,
  parent_id            uuid        REFERENCES org.org_unit(id) ON DELETE RESTRICT,
  -- Путь в дереве. Глубина НЕ ограничена (Д-06): фактических уровней может
  -- оказаться больше трёх, и это не должно ничего ломать.
  path                 ltree       NOT NULL,
  kind                 org.unit_kind_enum NOT NULL DEFAULT 'other',
  is_region_root       boolean     NOT NULL DEFAULT false,
  is_active            boolean     NOT NULL DEFAULT true,
  address              text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid REFERENCES org.person(id),
  version              integer     NOT NULL DEFAULT 1,

  name_norm text GENERATED ALWAYS AS (public.tj_norm(name)) STORED,

  CONSTRAINT ck_org_unit__code_shape CHECK (code ~ '^[A-Z][A-Z0-9_]{0,15}$'),
  CONSTRAINT ck_org_unit__not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX ix_org_unit__path ON org.org_unit USING gist (path);
CREATE INDEX ix_org_unit__parent ON org.org_unit (parent_id);
CREATE INDEX ix_org_unit__name_norm ON org.org_unit USING gin (name_norm public.gin_trgm_ops);

-- Метка пути выводится из идентификатора, а не из кода: код администратор
-- вправе изменить, и тогда пришлось бы переписывать пути всего поддерева.
CREATE FUNCTION org.unit_label(id uuid) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$fn$ SELECT 'u' || replace(id::text, '-', '_') $fn$;

CREATE FUNCTION org.set_path() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  parent_path ltree;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := org.unit_label(NEW.id)::ltree;
  ELSE
    SELECT u.path INTO parent_path FROM org.org_unit u WHERE u.id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Вышестоящее подразделение не найдено.';
    END IF;
    -- Цикл в дереве сделал бы область видимости бессмысленной.
    IF parent_path ~ ('*.' || org.unit_label(NEW.id) || '.*')::lquery THEN
      RAISE EXCEPTION 'Подразделение не может быть подчинено самому себе или своему подчинённому.';
    END IF;
    NEW.path := parent_path || org.unit_label(NEW.id)::ltree;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER set_path BEFORE INSERT OR UPDATE OF parent_id ON org.org_unit
  FOR EACH ROW EXECUTE FUNCTION org.set_path();

-- При переносе подразделения пути всего поддерева переписываются: иначе
-- область видимости осталась бы от прежнего места.
CREATE FUNCTION org.move_subtree() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE org.org_unit u
  SET path = NEW.path || subpath(u.path, nlevel(OLD.path))
  WHERE u.path <@ OLD.path AND u.id <> NEW.id;
  RETURN NULL;
END
$fn$;

-- Без «OF path»: оператор меняет parent_id, а path правит BEFORE-триггер.
-- С «UPDATE OF path» триггер не срабатывал бы вовсе — PostgreSQL смотрит на
-- столбцы, ПЕРЕЧИСЛЕННЫЕ в SET, а не на изменившиеся.
CREATE TRIGGER move_subtree AFTER UPDATE ON org.org_unit
  FOR EACH ROW WHEN (OLD.path IS DISTINCT FROM NEW.path)
  EXECUTE FUNCTION org.move_subtree();

-- ─── Должности ───────────────────────────────────────────────────────────

CREATE TABLE org.position (
  id                   uuid        PRIMARY KEY,
  org_unit_id          uuid        NOT NULL REFERENCES org.org_unit(id) ON DELETE RESTRICT,
  name                 text        NOT NULL COLLATE public.coll_tj,
  -- Вид должности — элемент справочника POSITION_KIND. Внешний ключ на
  -- «ядро» разрешён из любого модуля (docs/03-АРХИТЕКТУРА.md § 3).
  kind_item_id         uuid        REFERENCES ref.catalog_item(id) ON DELETE RESTRICT,
  is_head              boolean     NOT NULL DEFAULT false,
  headcount            integer     NOT NULL DEFAULT 1,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid REFERENCES org.person(id),
  version              integer     NOT NULL DEFAULT 1,

  name_norm text GENERATED ALWAYS AS (public.tj_norm(name)) STORED,

  CONSTRAINT ck_position__headcount CHECK (headcount >= 1)
);

CREATE INDEX ix_position__org_unit ON org.position (org_unit_id, name);
CREATE INDEX ix_position__name_norm ON org.position USING gin (name_norm public.gin_trgm_ops);

-- ─── Назначения ──────────────────────────────────────────────────────────

CREATE TABLE org.assignment (
  id                   uuid        PRIMARY KEY,
  person_id            uuid        NOT NULL REFERENCES org.person(id) ON DELETE RESTRICT,
  position_id          uuid        NOT NULL REFERENCES org.position(id) ON DELETE RESTRICT,
  started_on           date        NOT NULL,
  ended_on             date,
  order_number         text,
  is_primary           boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid REFERENCES org.person(id),
  version              integer     NOT NULL DEFAULT 1,

  CONSTRAINT ck_assignment__dates CHECK (ended_on IS NULL OR ended_on >= started_on)
);

-- Один человек может занимать несколько должностей одновременно (§ 7.3
-- 05-ДОСТУП), но основное назначение среди действующих — одно.
CREATE UNIQUE INDEX ux_assignment__one_primary
  ON org.assignment (person_id) WHERE is_primary AND ended_on IS NULL;

CREATE INDEX ix_assignment__person ON org.assignment (person_id, started_on DESC);
CREATE INDEX ix_assignment__position ON org.assignment (position_id);

-- ─── Замещения ───────────────────────────────────────────────────────────

CREATE TABLE org.delegation (
  id                      uuid        PRIMARY KEY,
  delegator_assignment_id uuid        NOT NULL REFERENCES org.assignment(id) ON DELETE RESTRICT,
  delegate_assignment_id  uuid        NOT NULL REFERENCES org.assignment(id) ON DELETE RESTRICT,
  started_on              date        NOT NULL,
  ended_on                date        NOT NULL,
  -- Замещение оформляется ПРИКАЗОМ: без номера его не существует (§ 5.1).
  order_number            text        NOT NULL,
  reason                  text,
  is_revoked              boolean     NOT NULL DEFAULT false,
  revoked_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by_person_id    uuid REFERENCES org.person(id),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id    uuid REFERENCES org.person(id),
  version                 integer     NOT NULL DEFAULT 1,

  CONSTRAINT ck_delegation__dates CHECK (ended_on >= started_on),
  CONSTRAINT ck_delegation__not_self CHECK (delegator_assignment_id <> delegate_assignment_id),
  CONSTRAINT ck_delegation__order_number CHECK (btrim(order_number) <> ''),
  CONSTRAINT ck_delegation__revoked CHECK ((NOT is_revoked) OR revoked_at IS NOT NULL)
);

CREATE INDEX ix_delegation__delegate ON org.delegation (delegate_assignment_id, started_on, ended_on);
CREATE INDEX ix_delegation__delegator ON org.delegation (delegator_assignment_id);

COMMENT ON TABLE org.delegation IS
  'Временная передача полномочий приказом (docs/05-ДОСТУП.md § 5). Транзитивность запрещена, но это правило ВЫЧИСЛЕНИЯ прав, а не ограничение записи: оно живёт в области видимости (§ 4.1), а не здесь.';

-- ─── Права ───────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA org TO coes_app;
GRANT SELECT, INSERT, UPDATE ON org.person, org.org_unit, org.position, org.assignment, org.delegation TO coes_app;
GRANT USAGE ON SCHEMA org TO coes_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA org TO coes_backup;
