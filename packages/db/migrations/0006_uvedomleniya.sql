-- 0006. Уведомления с подтверждением получения.
--
-- docs/04-ДАННЫЕ.md § 9.7, docs/03-АРХИТЕКТУРА.md § 5.7.
-- Подтверждение получения существует с этапа 0, хотя ни один сценарий
-- Выпуска 1 его не требует: возврат к оповещению личного состава по тревоге
-- не должен требовать переделки модели (01-ПРОДУКТ § 5).

CREATE SCHEMA notify;

-- Единственное значение. Электронной почты нет ни в каком виде: реализация
-- за выключенным флагом запрещена П-4, а проверить второе значение нечем —
-- почтового сервера не существует (Д-05).
CREATE TYPE notify.channel_enum AS ENUM ('in_app');

CREATE TABLE notify.notification (
  id                   uuid        PRIMARY KEY,
  kind                 text        NOT NULL,
  title                text        NOT NULL,
  body                 text,
  entity_schema        text,
  entity_table         text,
  entity_id            uuid,
  -- ОТНОСИТЕЛЬНЫЙ путь к объекту. Абсолютный адрес не хранится нигде:
  -- он собирается из BASE_URL в момент показа (принцип П-5).
  entity_path          text,
  requires_ack         boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by_person_id uuid REFERENCES org.person(id),

  CONSTRAINT ck_notification__entity_path_relative
    CHECK (entity_path IS NULL OR entity_path ~ '^/[^/]')
);

COMMENT ON CONSTRAINT ck_notification__entity_path_relative ON notify.notification IS
  'Путь обязан быть относительным и начинаться с одной косой черты. Сохранённый абсолютный адрес сделал бы переезд на домен Комитета невозможным без правки данных (П-5).';

CREATE INDEX ix_notification__created ON notify.notification (created_at DESC);

CREATE TABLE notify.delivery (
  id              uuid        PRIMARY KEY,
  notification_id uuid        NOT NULL REFERENCES notify.notification(id) ON DELETE CASCADE,
  person_id       uuid        NOT NULL REFERENCES org.person(id) ON DELETE RESTRICT,
  channel         notify.channel_enum NOT NULL DEFAULT 'in_app',
  delivered_at    timestamptz,
  read_at         timestamptz,
  failed_reason   text,

  CONSTRAINT ux_delivery__once UNIQUE (notification_id, person_id, channel)
);

CREATE INDEX ix_delivery__person_unread ON notify.delivery (person_id) WHERE read_at IS NULL;

CREATE TABLE notify.acknowledgement (
  id              uuid        PRIMARY KEY,
  delivery_id     uuid        NOT NULL UNIQUE REFERENCES notify.delivery(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  comment         text
);

COMMENT ON TABLE notify.acknowledgement IS
  'Подтверждение получения. Существует с этапа 0 ради возврата к оповещению личного состава по тревоге без переделки модели (docs/03-АРХИТЕКТУРА.md § 5.7).';

-- Подтверждать можно только доставленное уведомление, требующее подтверждения.
CREATE FUNCTION notify.check_ack() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  требуется boolean;
  доставлено timestamptz;
BEGIN
  SELECT n.requires_ack, d.delivered_at INTO требуется, доставлено
  FROM notify.delivery d JOIN notify.notification n ON n.id = d.notification_id
  WHERE d.id = NEW.delivery_id;

  IF NOT требуется THEN
    RAISE EXCEPTION 'Это уведомление не требует подтверждения получения.';
  END IF;
  IF доставлено IS NULL THEN
    RAISE EXCEPTION 'Нельзя подтвердить получение уведомления, которое не доставлено.';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER check_ack BEFORE INSERT ON notify.acknowledgement
  FOR EACH ROW EXECUTE FUNCTION notify.check_ack();

GRANT USAGE ON SCHEMA notify TO coes_app;
GRANT SELECT, INSERT, UPDATE ON notify.notification, notify.delivery, notify.acknowledgement TO coes_app;
GRANT USAGE ON SCHEMA notify TO coes_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA notify TO coes_backup;
