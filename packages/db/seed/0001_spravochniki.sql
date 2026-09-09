-- Начальное наполнение справочников (docs/04-ДАННЫЕ.md § 5.3).
--
-- ВСЁ здесь помечено is_provisional = true: это наши предположения, а не
-- нормативные значения (Д-01). Нормативного классификатора ЧС и форм
-- донесений у нас нет, и они почти наверняка окажутся другими.
--
-- Наполнение идемпотентно: повторное применение ничего не дублирует.

BEGIN;

INSERT INTO ref.catalog (id, code, name, is_hierarchical, is_system, attribute_schema) VALUES
  (gen_random_uuid(), 'INCIDENT_KIND',   'Виды событий',                  true,  true,
   '["isEmergency","requiresCasualties","requiresArea","requiresDamage"]'),
  (gen_random_uuid(), 'INCIDENT_SCALE',  'Масштаб события',               false, true,
   '["severityLevel","colorToken"]'),
  (gen_random_uuid(), 'INCIDENT_CAUSE',  'Причины возникновения',         true,  true,  '[]'),
  (gen_random_uuid(), 'INCIDENT_SOURCE', 'Источник сообщения',            false, true,  '[]'),
  (gen_random_uuid(), 'DAMAGE_TYPE',     'Виды ущерба',                   false, true,  '["unit"]'),
  (gen_random_uuid(), 'AGENCY',          'Ведомства и привлечённые силы', false, true,  '[]'),
  (gen_random_uuid(), 'SETTLEMENT_TYPE', 'Типы населённых пунктов',       false, true,  '[]'),
  (gen_random_uuid(), 'POSITION_KIND',   'Виды должностей',               false, true,  '["isHead"]'),
  (gen_random_uuid(), 'AFFECTED_STATUS', 'Состояние пострадавшего',       false, true,
   '["isDead","isInjured","isMissing","isEvacuated","isRescued"]'),
  (gen_random_uuid(), 'HEALTH_CATEGORY', 'Степень тяжести состояния',     false, true,  '["isSensitive"]'),
  (gen_random_uuid(), 'DOC_KIND',        'Виды документов',               true,  true,
   '["requiresApproval","isIncoming","isOutgoing"]'),
  (gen_random_uuid(), 'CASE_FILE',       'Номенклатура дел',              true,  true,  '["retentionRule"]'),
  (gen_random_uuid(), 'RETENTION_ACTION','Действия по истечении срока',   false, true,
   '["isDestroy","isPermanent","isTransfer"]'),
  (gen_random_uuid(), 'TASK_PRIORITY',   'Приоритеты задач',              false, true,
   '["severityLevel","colorToken"]'),
  (gen_random_uuid(), 'MEETING_KIND',    'Виды совещаний',                false, true,  '[]')
ON CONFLICT (code) DO NOTHING;

CREATE TEMP TABLE наполнение (
  catalog_code text, code text, name text, parent_code text,
  sort_order integer, attributes jsonb, color_token text
) ON COMMIT DROP;

INSERT INTO наполнение VALUES
-- ─── INCIDENT_KIND. isEmergency — значение по умолчанию для поля «Относится к ЧС» ───
('INCIDENT_KIND','PRI-00','Природные',NULL,100,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','PRI-01','Землетрясение','PRI-00',101,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-02','Сель','PRI-00',102,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-03','Оползень','PRI-00',103,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-04','Обвал, камнепад','PRI-00',104,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-05','Снежная лавина','PRI-00',105,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-06','Паводок, наводнение','PRI-00',106,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-07','Подтопление','PRI-00',107,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-08','Сильный ветер, ураган','PRI-00',108,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-09','Град','PRI-00',109,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-10','Заморозки','PRI-00',110,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-11','Засуха','PRI-00',111,'{"isEmergency":true,"requiresCasualties":false,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-12','Сильный снегопад, метель','PRI-00',112,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','PRI-13','Прорыв высокогорного озера','PRI-00',113,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-00','Техногенные',NULL,200,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','TEH-01','Пожар','TEH-00',201,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-02','Взрыв','TEH-00',202,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-03','Обрушение здания или сооружения','TEH-00',203,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-04','Дорожно-транспортное происшествие','TEH-00',204,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','TEH-05','Авария на трубопроводе','TEH-00',205,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-06','Авария на энергосети','TEH-00',206,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-07','Авария на водопроводных сетях','TEH-00',207,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-08','Выброс химически опасных веществ','TEH-00',208,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-09','Радиационная авария','TEH-00',209,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-10','Авария на гидротехническом сооружении','TEH-00',210,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','TEH-11','Обнаружение взрывоопасного предмета','TEH-00',211,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','TEH-12','Авария на воздушном или железнодорожном транспорте','TEH-00',212,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":false,"requiresDamage":true}',NULL),
('INCIDENT_KIND','BIO-00','Биолого-социальные',NULL,300,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','BIO-01','Эпидемия','BIO-00',301,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":true,"requiresDamage":false}',NULL),
('INCIDENT_KIND','BIO-02','Эпизоотия','BIO-00',302,'{"isEmergency":true,"requiresCasualties":false,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','BIO-03','Эпифитотия','BIO-00',303,'{"isEmergency":true,"requiresCasualties":false,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','BIO-04','Массовое отравление','BIO-00',304,'{"isEmergency":true,"requiresCasualties":true,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','BIO-05','Нашествие вредителей','BIO-00',305,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":true,"requiresDamage":true}',NULL),
('INCIDENT_KIND','INY-00','Иные происшествия',NULL,400,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','INY-01','Поисково-спасательная операция в горах','INY-00',401,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','INY-02','Происшествие на воде','INY-00',402,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','INY-03','Учение, тренировка','INY-00',403,'{"isEmergency":false,"requiresCasualties":false,"requiresArea":false,"requiresDamage":false}',NULL),
('INCIDENT_KIND','INY-04','Иное происшествие','INY-00',404,'{"isEmergency":false,"requiresCasualties":true,"requiresArea":false,"requiresDamage":false}',NULL),
-- ─── INCIDENT_SCALE ───
('INCIDENT_SCALE','MSH-01','Локальный, в пределах объекта',NULL,10,'{"severityLevel":1,"colorToken":"sev-1"}','sev-1'),
('INCIDENT_SCALE','MSH-02','Местный, в пределах джамоата',NULL,20,'{"severityLevel":2,"colorToken":"sev-2"}','sev-2'),
('INCIDENT_SCALE','MSH-03','Районный',NULL,30,'{"severityLevel":3,"colorToken":"sev-3"}','sev-3'),
('INCIDENT_SCALE','MSH-04','Областной',NULL,40,'{"severityLevel":4,"colorToken":"sev-4"}','sev-4'),
('INCIDENT_SCALE','MSH-05','Республиканский',NULL,50,'{"severityLevel":5,"colorToken":"sev-5"}','sev-5'),
-- ─── INCIDENT_CAUSE ───
('INCIDENT_CAUSE','PRC-00','Природные факторы',NULL,100,'{}',NULL),
('INCIDENT_CAUSE','PRC-01','Сейсмическая активность','PRC-00',101,'{}',NULL),
('INCIDENT_CAUSE','PRC-02','Обильные осадки','PRC-00',102,'{}',NULL),
('INCIDENT_CAUSE','PRC-03','Таяние снега и ледников','PRC-00',103,'{}',NULL),
('INCIDENT_CAUSE','PRC-04','Ветровая нагрузка','PRC-00',104,'{}',NULL),
('INCIDENT_CAUSE','PRC-05','Иной природный фактор','PRC-00',105,'{}',NULL),
('INCIDENT_CAUSE','HUM-00','Человеческий фактор',NULL,200,'{}',NULL),
('INCIDENT_CAUSE','HUM-01','Нарушение правил безопасности','HUM-00',201,'{}',NULL),
('INCIDENT_CAUSE','HUM-02','Неосторожное обращение с огнём','HUM-00',202,'{}',NULL),
('INCIDENT_CAUSE','HUM-03','Нарушение правил дорожного движения','HUM-00',203,'{}',NULL),
('INCIDENT_CAUSE','HUM-04','Умышленные действия','HUM-00',204,'{}',NULL),
('INCIDENT_CAUSE','HUM-05','Иной человеческий фактор','HUM-00',205,'{}',NULL),
('INCIDENT_CAUSE','TCH-00','Технические причины',NULL,300,'{}',NULL),
('INCIDENT_CAUSE','TCH-01','Износ оборудования и конструкций','TCH-00',301,'{}',NULL),
('INCIDENT_CAUSE','TCH-02','Нарушение технологии работ','TCH-00',302,'{}',NULL),
('INCIDENT_CAUSE','TCH-03','Отказ оборудования','TCH-00',303,'{}',NULL),
('INCIDENT_CAUSE','UNK-01','Причина не установлена',NULL,400,'{}',NULL),
-- ─── INCIDENT_SOURCE ───
('INCIDENT_SOURCE','IST-01','Сообщение гражданина по телефону',NULL,10,'{}',NULL),
('INCIDENT_SOURCE','IST-02','Сообщение подразделения Комитета',NULL,20,'{}',NULL),
('INCIDENT_SOURCE','IST-03','Сообщение органа местной власти',NULL,30,'{}',NULL),
('INCIDENT_SOURCE','IST-04','Сообщение иного ведомства',NULL,40,'{}',NULL),
('INCIDENT_SOURCE','IST-05','Сообщение средства массовой информации',NULL,50,'{}',NULL),
('INCIDENT_SOURCE','IST-06','Выявлено при выезде',NULL,60,'{}',NULL),
('INCIDENT_SOURCE','IST-07','Иной источник',NULL,70,'{}',NULL),
-- ─── DAMAGE_TYPE ───
('DAMAGE_TYPE','USH-01','Жилые дома',NULL,10,'{"unit":"ед."}',NULL),
('DAMAGE_TYPE','USH-02','Объекты образования',NULL,20,'{"unit":"ед."}',NULL),
('DAMAGE_TYPE','USH-03','Объекты здравоохранения',NULL,30,'{"unit":"ед."}',NULL),
('DAMAGE_TYPE','USH-04','Автомобильные дороги',NULL,40,'{"unit":"км"}',NULL),
('DAMAGE_TYPE','USH-05','Мосты',NULL,50,'{"unit":"ед."}',NULL),
('DAMAGE_TYPE','USH-06','Линии электропередачи',NULL,60,'{"unit":"км"}',NULL),
('DAMAGE_TYPE','USH-07','Водопроводные сети',NULL,70,'{"unit":"км"}',NULL),
('DAMAGE_TYPE','USH-08','Ирригационные сооружения',NULL,80,'{"unit":"ед."}',NULL),
('DAMAGE_TYPE','USH-09','Сельскохозяйственные угодья',NULL,90,'{"unit":"га"}',NULL),
('DAMAGE_TYPE','USH-10','Скот',NULL,100,'{"unit":"гол."}',NULL),
('DAMAGE_TYPE','USH-11','Иное имущество',NULL,110,'{"unit":"ед."}',NULL),
-- ─── AGENCY ───
('AGENCY','VED-01','Комитет по чрезвычайным ситуациям и гражданской обороне',NULL,10,'{}',NULL),
('AGENCY','VED-02','Министерство внутренних дел',NULL,20,'{}',NULL),
('AGENCY','VED-03','Министерство здравоохранения и социальной защиты населения',NULL,30,'{}',NULL),
('AGENCY','VED-04','Министерство обороны',NULL,40,'{}',NULL),
('AGENCY','VED-05','Министерство энергетики и водных ресурсов',NULL,50,'{}',NULL),
('AGENCY','VED-06','Министерство транспорта',NULL,60,'{}',NULL),
('AGENCY','VED-07','Комитет по охране окружающей среды',NULL,70,'{}',NULL),
('AGENCY','VED-08','Агентство по гидрометеорологии',NULL,80,'{}',NULL),
('AGENCY','VED-09','Местный исполнительный орган государственной власти',NULL,90,'{}',NULL),
('AGENCY','VED-10','Иное ведомство',NULL,100,'{}',NULL),
-- ─── SETTLEMENT_TYPE ───
('SETTLEMENT_TYPE','NPT-01','Город',NULL,10,'{}',NULL),
('SETTLEMENT_TYPE','NPT-02','Посёлок городского типа',NULL,20,'{}',NULL),
('SETTLEMENT_TYPE','NPT-03','Село',NULL,30,'{}',NULL),
('SETTLEMENT_TYPE','NPT-04','Центр джамоата',NULL,40,'{}',NULL),
('SETTLEMENT_TYPE','NPT-05','Вне населённого пункта',NULL,50,'{}',NULL),
-- ─── POSITION_KIND ───
('POSITION_KIND','DLK-01','Руководитель',NULL,10,'{"isHead":true}',NULL),
('POSITION_KIND','DLK-02','Заместитель руководителя',NULL,20,'{"isHead":true}',NULL),
('POSITION_KIND','DLK-03','Начальник структурного подразделения',NULL,30,'{"isHead":true}',NULL),
('POSITION_KIND','DLK-04','Главный специалист',NULL,40,'{"isHead":false}',NULL),
('POSITION_KIND','DLK-05','Ведущий специалист',NULL,50,'{"isHead":false}',NULL),
('POSITION_KIND','DLK-06','Специалист',NULL,60,'{"isHead":false}',NULL),
('POSITION_KIND','DLK-07','Оперативный дежурный',NULL,70,'{"isHead":false}',NULL),
('POSITION_KIND','DLK-08','Инспектор',NULL,80,'{"isHead":false}',NULL),
('POSITION_KIND','DLK-09','Иная должность',NULL,90,'{"isHead":false}',NULL),
-- ─── AFFECTED_STATUS ───
('AFFECTED_STATUS','SOS-01','Погиб',NULL,10,'{"isDead":true,"isInjured":false,"isMissing":false,"isEvacuated":false,"isRescued":false}',NULL),
('AFFECTED_STATUS','SOS-02','Травмирован',NULL,20,'{"isDead":false,"isInjured":true,"isMissing":false,"isEvacuated":false,"isRescued":false}',NULL),
('AFFECTED_STATUS','SOS-03','Пропал без вести',NULL,30,'{"isDead":false,"isInjured":false,"isMissing":true,"isEvacuated":false,"isRescued":false}',NULL),
('AFFECTED_STATUS','SOS-04','Эвакуирован',NULL,40,'{"isDead":false,"isInjured":false,"isMissing":false,"isEvacuated":true,"isRescued":false}',NULL),
('AFFECTED_STATUS','SOS-05','Спасён',NULL,50,'{"isDead":false,"isInjured":false,"isMissing":false,"isEvacuated":false,"isRescued":true}',NULL),
('AFFECTED_STATUS','SOS-06','Пострадал без травм',NULL,60,'{"isDead":false,"isInjured":false,"isMissing":false,"isEvacuated":false,"isRescued":false}',NULL),
('AFFECTED_STATUS','SOS-07','Состояние уточняется',NULL,70,'{"isDead":false,"isInjured":false,"isMissing":false,"isEvacuated":false,"isRescued":false}',NULL),
-- ─── HEALTH_CATEGORY ───
('HEALTH_CATEGORY','SZD-01','Медицинская помощь не требуется',NULL,10,'{"isSensitive":false}',NULL),
('HEALTH_CATEGORY','SZD-02','Лёгкая степень',NULL,20,'{"isSensitive":true}',NULL),
('HEALTH_CATEGORY','SZD-03','Средняя степень',NULL,30,'{"isSensitive":true}',NULL),
('HEALTH_CATEGORY','SZD-04','Тяжёлая степень',NULL,40,'{"isSensitive":true}',NULL),
('HEALTH_CATEGORY','SZD-05','Крайне тяжёлая степень',NULL,50,'{"isSensitive":true}',NULL),
('HEALTH_CATEGORY','SZD-06','Не установлена',NULL,60,'{"isSensitive":false}',NULL),
-- ─── DOC_KIND ───
('DOC_KIND','DOC-00','Внутренние документы',NULL,100,'{"requiresApproval":false,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-01','Приказ','DOC-00',101,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-02','Распоряжение','DOC-00',102,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-03','Служебная записка','DOC-00',103,'{"requiresApproval":false,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-04','Докладная записка','DOC-00',104,'{"requiresApproval":false,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-05','Акт','DOC-00',105,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-06','План','DOC-00',106,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-07','Отчёт','DOC-00',107,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-08','Протокол','DOC-00',108,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','DOC-09','Оперативное донесение','DOC-00',109,'{"requiresApproval":false,"isIncoming":false,"isOutgoing":false}',NULL),
('DOC_KIND','VHD-01','Входящее письмо',NULL,200,'{"requiresApproval":false,"isIncoming":true,"isOutgoing":false}',NULL),
('DOC_KIND','ISH-01','Исходящее письмо',NULL,300,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":true}',NULL),
('DOC_KIND','ISH-02','Ответ на обращение',NULL,310,'{"requiresApproval":true,"isIncoming":false,"isOutgoing":true}',NULL),
-- ─── CASE_FILE ───
('CASE_FILE','DEL-01','Приказы по основной деятельности',NULL,10,'{"retentionRule":"SRK-POST"}',NULL),
('CASE_FILE','DEL-02','Приказы по личному составу',NULL,20,'{"retentionRule":"SRK-75"}',NULL),
('CASE_FILE','DEL-03','Оперативные донесения о чрезвычайных ситуациях',NULL,30,'{"retentionRule":"SRK-05"}',NULL),
('CASE_FILE','DEL-04','Суточные сводки',NULL,40,'{"retentionRule":"SRK-03"}',NULL),
('CASE_FILE','DEL-05','Материалы по чрезвычайным ситуациям',NULL,50,'{"retentionRule":"SRK-10"}',NULL),
('CASE_FILE','DEL-06','Переписка с ведомствами',NULL,60,'{"retentionRule":"SRK-05"}',NULL),
('CASE_FILE','DEL-07','Планы и отчёты',NULL,70,'{"retentionRule":"SRK-POST"}',NULL),
('CASE_FILE','DEL-08','Акты об уничтожении документов',NULL,80,'{"retentionRule":"SRK-POST"}',NULL),
('CASE_FILE','DEL-09','Документы по личному составу',NULL,90,'{"retentionRule":"SRK-75"}',NULL),
-- ─── RETENTION_ACTION ───
('RETENTION_ACTION','HRN-01','Уничтожить по акту',NULL,10,'{"isDestroy":true,"isPermanent":false,"isTransfer":false}',NULL),
('RETENTION_ACTION','HRN-02','Хранить постоянно',NULL,20,'{"isDestroy":false,"isPermanent":true,"isTransfer":false}',NULL),
('RETENTION_ACTION','HRN-03','Передать в архив',NULL,30,'{"isDestroy":false,"isPermanent":false,"isTransfer":true}',NULL),
-- ─── TASK_PRIORITY ───
('TASK_PRIORITY','PRT-01','Низкий',NULL,10,'{"severityLevel":1,"colorToken":"sev-1"}','sev-1'),
('TASK_PRIORITY','PRT-02','Обычный',NULL,20,'{"severityLevel":2,"colorToken":"sev-2"}','sev-2'),
('TASK_PRIORITY','PRT-03','Высокий',NULL,30,'{"severityLevel":4,"colorToken":"sev-4"}','sev-4'),
('TASK_PRIORITY','PRT-04','Срочный',NULL,40,'{"severityLevel":5,"colorToken":"sev-5"}','sev-5'),
-- ─── MEETING_KIND ───
('MEETING_KIND','SOV-01','Оперативное совещание',NULL,10,'{}',NULL),
('MEETING_KIND','SOV-02','Селекторное совещание',NULL,20,'{}',NULL),
('MEETING_KIND','SOV-03','Заседание комиссии',NULL,30,'{}',NULL),
('MEETING_KIND','SOV-04','Рабочая встреча',NULL,40,'{}',NULL),
('MEETING_KIND','SOV-05','Учебное занятие',NULL,50,'{}',NULL);

-- Первый проход: элементы без родителей.
INSERT INTO ref.catalog_item (id, catalog_id, code, name, sort_order, attributes, color_token, is_provisional)
SELECT gen_random_uuid(), c.id, н.code, н.name, н.sort_order, н.attributes, н.color_token, true
FROM наполнение н JOIN ref.catalog c ON c.code = н.catalog_code
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Второй проход: связи с родителями. Родитель уже существует, поэтому
-- составной внешний ключ «родитель того же справочника» выполняется.
UPDATE ref.catalog_item дочерний
SET parent_id = родитель.id
FROM наполнение н
JOIN ref.catalog c ON c.code = н.catalog_code
JOIN ref.catalog_item родитель ON родитель.catalog_id = c.id AND родитель.code = н.parent_code
WHERE дочерний.catalog_id = c.id AND дочерний.code = н.code
  AND н.parent_code IS NOT NULL AND дочерний.parent_id IS NULL;

COMMIT;
