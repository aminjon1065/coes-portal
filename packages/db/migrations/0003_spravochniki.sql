-- 0003. Справочники — механизм, обслуживающий принцип П-1.
--
-- docs/04-ДАННЫЕ.md § 5, docs/00-КОНТРАКТ.md § П-1, adr/05.
-- Виды событий, масштабы, причины, дела, сроки и прочее — строки в этих
-- двух таблицах, а не перечисления в коде: всё это почти наверняка окажется
-- неверным (Д-01), и заменять его должен администратор, а не программист.

CREATE SCHEMA ref;

CREATE TABLE ref.catalog (
  id                   uuid        PRIMARY KEY,
  -- Код справочника — ЧАСТЬ ПРОГРАММЫ: программа знает, какие справочники
  -- существуют. Отсюда форма без дефиса (§ 5.1).
  code                 text        NOT NULL UNIQUE,
  name                 text        NOT NULL COLLATE public.coll_tj,
  description          text,
  is_hierarchical      boolean     NOT NULL DEFAULT false,
  is_system            boolean     NOT NULL DEFAULT false,
  attribute_schema     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid,
  version              integer     NOT NULL DEFAULT 1,

  CONSTRAINT ck_catalog__code_shape CHECK (code ~ '^[A-Z][A-Z_]{1,40}$')
);

COMMENT ON CONSTRAINT ck_catalog__code_shape ON ref.catalog IS
  'Код справочника пишется заглавными латинскими с подчёркиванием и БЕЗ дефиса. По форме кода проверка pnpm check:literals отличает допустимый литерал от нарушения П-1.';

CREATE TABLE ref.catalog_item (
  id                   uuid        PRIMARY KEY,
  catalog_id           uuid        NOT NULL REFERENCES ref.catalog(id) ON DELETE RESTRICT,
  parent_id            uuid        REFERENCES ref.catalog_item(id) ON DELETE RESTRICT,
  -- Код элемента — ДАННЫЕ: программа его никогда не сравнивает.
  -- Дефис обязателен (§ 5.1).
  code                 text        NOT NULL,
  name                 text        NOT NULL COLLATE public.coll_tj,
  short_name           text COLLATE public.coll_tj,
  sort_order           integer     NOT NULL DEFAULT 0,
  is_active            boolean     NOT NULL DEFAULT true,
  -- «Значение придумано нами, нормативного подтверждения нет» (Д-01).
  -- Видно на экране справочников: при внедрении сразу понятно, что заменять.
  is_provisional       boolean     NOT NULL DEFAULT false,
  valid_from           date,
  valid_to             date,
  attributes           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  color_token          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by_person_id uuid,
  version              integer     NOT NULL DEFAULT 1,

  name_norm            text        GENERATED ALWAYS AS (public.tj_norm(name)) STORED,

  CONSTRAINT ux_catalog_item__code UNIQUE (catalog_id, code),
  -- Пара для составного внешнего ключа: родитель обязан принадлежать
  -- тому же справочнику. Ограничением, а не триггером.
  CONSTRAINT ux_catalog_item__id_catalog UNIQUE (id, catalog_id),
  CONSTRAINT fk_catalog_item__parent_same_catalog
    FOREIGN KEY (parent_id, catalog_id) REFERENCES ref.catalog_item(id, catalog_id) ON DELETE RESTRICT,

  CONSTRAINT ck_catalog_item__code_shape CHECK (code ~ '^[A-ZА-Я]{2,5}(-[0-9A-Z]{1,4})+$'),
  CONSTRAINT ck_catalog_item__not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT ck_catalog_item__validity CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  -- Администратор выбирает уровень важности из палитры дизайн-системы,
  -- а не задаёт произвольный цвет: иначе он разрушит палитру (§ 5.3).
  CONSTRAINT ck_catalog_item__color_token
    CHECK (color_token IS NULL OR color_token IN ('sev-1', 'sev-2', 'sev-3', 'sev-4', 'sev-5'))
);

COMMENT ON CONSTRAINT ck_catalog_item__code_shape ON ref.catalog_item IS
  'Код элемента обязан содержать дефис. Различие формы кодов — основание автоматической проверки правила замещаемости (П-1).';

CREATE INDEX ix_catalog_item__catalog ON ref.catalog_item (catalog_id, sort_order, name);
CREATE INDEX ix_catalog_item__parent ON ref.catalog_item (parent_id);
CREATE INDEX ix_catalog_item__name_norm ON ref.catalog_item USING gin (name_norm public.gin_trgm_ops);

-- Иерархия допустима только там, где справочник объявлен иерархическим.
CREATE FUNCTION ref.check_hierarchy() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  hierarchical boolean;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.is_hierarchical INTO hierarchical FROM ref.catalog c WHERE c.id = NEW.catalog_id;
  IF NOT hierarchical THEN
    RAISE EXCEPTION 'Справочник не является иерархическим: вложенные элементы в нём недопустимы (docs/04-ДАННЫЕ.md § 5).';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER check_hierarchy BEFORE INSERT OR UPDATE OF parent_id, catalog_id ON ref.catalog_item
  FOR EACH ROW EXECUTE FUNCTION ref.check_hierarchy();

GRANT USAGE ON SCHEMA ref TO coes_app;
GRANT SELECT, INSERT, UPDATE ON ref.catalog, ref.catalog_item TO coes_app;
GRANT USAGE ON SCHEMA ref TO coes_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA ref TO coes_backup;
