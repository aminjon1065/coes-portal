-- Начальные подразделения и position_seed (docs/04-ДАННЫЕ.md § 5.5).
--
-- Придуманы, как и справочники (Д-06, Д-10). Районные отделы внутри
-- областных управлений НЕ создаются: их перечень нам неизвестен, а
-- придуманный перечень районов хуже пустого — его заведёт администратор
-- при внедрении.
--
-- Идемпотентно: повторное применение ничего не дублирует.

BEGIN;

-- Коды используются в шаблонах регистрационных номеров: {ПОДР} (§ 3.2).
-- Центральный аппарат регионом верхнего уровня НЕ является: регионов пять
-- (Д-06), и центральный аппарат в их число не входит. Таблица § 5.5 помечает
-- его «да»; решение Держателя контракта от 2026-09-09 — «CA не регион»,
-- запись В-14.
INSERT INTO org.org_unit (id, code, name, short_name, parent_id, path, kind, is_region_root)
VALUES (gen_random_uuid(), 'CA', 'Центральный аппарат Комитета', 'Центральный аппарат',
        NULL, 'placeholder'::ltree, 'central', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO org.org_unit (id, code, name, short_name, parent_id, path, kind, is_region_root)
SELECT gen_random_uuid(), unit.code, unit.name, unit.short_name, ca.id, 'placeholder'::ltree, 'region', true
FROM (VALUES
  ('DUS', 'Управление по городу Душанбе', 'Душанбе'),
  ('SUG', 'Управление по Согдийской области', 'Согдийская область'),
  ('KHA', 'Управление по Хатлонской области', 'Хатлонская область'),
  ('GBA', 'Управление по Горно-Бадахшанской автономной области', 'ГБАО'),
  ('RRP', 'Управление по районам республиканского подчинения', 'РРП')
) AS unit(code, name, short_name)
CROSS JOIN (SELECT id FROM org.org_unit WHERE code = 'CA') ca
ON CONFLICT (code) DO NOTHING;

-- Должности. В центральном аппарате — все; в областных управлениях те же,
-- кроме первых трёх (§ 5.5).
CREATE TEMP TABLE position_seed (
  ordinal integer, name text, kind_code text, only_central boolean
) ON COMMIT DROP;

INSERT INTO position_seed VALUES
  (10, 'Председатель Комитета',            'DLK-01', true),
  (20, 'Первый заместитель председателя',  'DLK-02', true),
  (30, 'Заместитель председателя',         'DLK-02', true),
  (40, 'Начальник управления',             'DLK-03', false),
  (50, 'Начальник отдела',                 'DLK-03', false),
  (60, 'Главный специалист',               'DLK-04', false),
  (70, 'Ведущий специалист',               'DLK-05', false),
  (80, 'Специалист',                       'DLK-06', false),
  (90, 'Оперативный дежурный',             'DLK-07', false),
  (100, 'Инспектор',                       'DLK-08', false);

INSERT INTO org.position (id, org_unit_id, name, kind_item_id, is_head)
SELECT gen_random_uuid(), u.id, д.name, i.id,
       coalesce((i.attributes->>'isHead')::boolean, false)
FROM position_seed д
JOIN ref.catalog c ON c.code = 'POSITION_KIND'
JOIN ref.catalog_item i ON i.catalog_id = c.id AND i.code = д.kind_code
JOIN org.org_unit u ON (u.code = 'CA' OR NOT д.only_central)
WHERE NOT EXISTS (
  SELECT 1 FROM org.position p WHERE p.org_unit_id = u.id AND p.name = д.name
);

COMMIT;
