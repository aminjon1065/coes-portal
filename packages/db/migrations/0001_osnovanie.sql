-- 0001. Основание: расширения, словарь таджикских букв, конфигурация поиска,
-- нормализация для поиска по подстроке, сопоставление для сортировки.
--
-- docs/04-ДАННЫЕ.md § 4. Всё содержимое этой миграции — предпосылка любой
-- таблицы с наименованиями: без сопоставления сортировка неверна, без словаря
-- поиск не находит написание с таджикскими буквами.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- § 4.1–4.2. Словарь замен лежит в tsearch_data базы; конфигурация поиска
-- применяет его перед русским стеммером, поэтому «Раҳимов» и «Рахимов»
-- дают одну и ту же лексему.
CREATE TEXT SEARCH DICTIONARY tajik_unaccent (TEMPLATE = unaccent, RULES = 'tajik');

CREATE TEXT SEARCH CONFIGURATION russian_tj (COPY = russian);

ALTER TEXT SEARCH CONFIGURATION russian_tj
  ALTER MAPPING FOR word, hword, hword_part WITH tajik_unaccent, russian_stem;

-- § 4.3. Функция объявлена неизменяемой, чтобы участвовать в вычисляемых
-- столбцах и индексах. Отсюда запрет: после появления данных файл
-- tajik.rules изменять нельзя.
CREATE FUNCTION public.tj_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$fn$ SELECT lower(public.unaccent('public.tajik_unaccent', t)) $fn$;

COMMENT ON FUNCTION public.tj_norm(text) IS
  'Нормализация для поиска по подстроке (docs/04-ДАННЫЕ.md § 4.3). Неизменяема: правила словаря после появления данных не меняются.';

-- § 4.4. Правила заданы явно и не зависят от наличия таджикских данных
-- в библиотеке ICU: одинаковый порядок на любой сборке.
CREATE COLLATION public.coll_tj (
  provider = icu,
  locale = 'ru-RU',
  rules = '&Г<ғ<<<Ғ &И<ӣ<<<Ӣ &К<қ<<<Қ &У<ӯ<<<Ӯ &Х<ҳ<<<Ҳ &Ч<ҷ<<<Ҷ',
  deterministic = true
);

COMMENT ON COLLATION public.coll_tj IS
  'Сортировка с таджикскими буквами (docs/04-ДАННЫЕ.md § 4.4). Ожидаемый порядок — § 4.5.';
