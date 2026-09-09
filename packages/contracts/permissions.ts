/**
 * Перечень разрешений — КОД (docs/05-ДОСТУП.md § 2.1, docs/00-КОНТРАКТ.md § П-1).
 *
 * Каждому разрешению соответствует ветвь программы и проверка. Создать новое
 * разрешение из экрана администрирования нельзя: ему не соответствовало бы
 * ничего. Роли и состав разрешений в роли — данные, и они редактируются.
 *
 * Состав — § 2.3, Выпуск 1 (этапы 0–2). Разрешения этапов 3–7 добавляются
 * вместе с модулями (§ 11).
 */

export interface Permission {
  readonly code: string;
  readonly module: string;
  readonly name: string;
}

const p = (code: string, name: string): Permission => ({
  code,
  module: String(code.split('.')[0]),
  name,
});

export const PERMISSIONS: readonly Permission[] = [
  p('iam.account.read', 'Видеть список учётных записей'),
  p('iam.account.create', 'Создавать учётную запись'),
  p('iam.account.update', 'Изменять учётную запись'),
  p('iam.account.block', 'Блокировать и разблокировать'),
  p('iam.account.reset_password', 'Выдавать одноразовый код смены пароля'),
  p('org.unit.read', 'Видеть оргструктуру'),
  p('org.unit.manage', 'Создавать и изменять подразделения'),
  p('org.position.manage', 'Создавать и изменять должности'),
  p('org.person.read', 'Видеть карточки сотрудников'),
  p('org.person.manage', 'Создавать и изменять карточки сотрудников'),
  p('org.assignment.manage', 'Назначать на должность и снимать'),
  p('org.delegation.create', 'Оформлять замещение своего назначения'),
  p('org.delegation.manage_any', 'Оформлять и отзывать любое замещение в своей области'),
  p('access.role.read', 'Видеть роли и их состав'),
  p('access.role.manage', 'Создавать роли и менять их состав'),
  p('access.grant.manage', 'Выдавать роли назначениям'),
  p('access.scope.manage', 'Выдавать право «все регионы» и дополнительные области'),
  p('ref.catalog.manage', 'Изменять справочники'),
  p('sys.setting.read', 'Видеть настройки'),
  p('sys.setting.manage', 'Изменять настройки и пределы'),
  p('sys.status.read', 'Видеть состояние сервера'),
  p('audit.event.read_all', 'Открывать журнал действий целиком'),
  p('audit.event.verify', 'Запускать проверку целостности журнала'),
  p('system.content.read_foreign', 'Обращаться к чужому содержимому по процедуре'),
  p('store.blob.upload', 'Загружать файлы'),
  p('incident.card.read', 'Видеть события своей области'),
  p('incident.card.create', 'Создавать событие'),
  p('incident.card.update', 'Изменять событие'),
  p('incident.card.register', 'Регистрировать событие с присвоением номера'),
  p('incident.card.close', 'Закрывать событие'),
  p('incident.card.reopen', 'Переоткрывать закрытое событие'),
  p('incident.card.cancel', 'Аннулировать событие'),
  p('incident.card.export', 'Выгружать реестр событий'),
  p('incident.duty.manage', 'Открывать и закрывать дежурную смену'),
  p('incident.summary.create', 'Формировать суточную сводку'),
  p('incident.summary.approve', 'Утверждать суточную сводку'),
  p('geo.layer.read', 'Видеть слои'),
  p('geo.layer.manage', 'Создавать, изменять и удалять слои'),
  p('geo.layer.import', 'Загружать слой из файла'),
  p('pdn.person.read_depersonalized', 'Видеть обезличенный список пострадавших'),
  p('pdn.person.read_identity', 'Видеть фамилии, даты рождения, адреса, сведения о здоровье'),
  p('pdn.person.manage', 'Вносить и изменять сведения о пострадавших'),
  p('pdn.person.export_identity', 'Выгружать сведения о пострадавших в открытом виде'),
  p('pdn.person.depersonalize', 'Утверждать акт обезличивания по истечении срока'),
  p('analytics.dashboard.read', 'Открывать панели показателей'),
  p('analytics.crosstab.build', 'Строить перекрёстные таблицы'),
  p('analytics.report.create', 'Формировать отчёт'),
  p('analytics.report.read_any', 'Видеть отчёты, сформированные другими'),
  p('template.template.read', 'Видеть шаблоны'),
  p('template.template.manage', 'Загружать и изменять шаблоны'),
];

/** Форма кода: только строчная латиница, точки и подчёркивание (§ 2.2). */
export const PERMISSION_CODE = /^[a-z][a-z_]*\.[a-z][a-z_]*\.[a-z][a-z_]*$/;

export const PERMISSION_CODES: readonly string[] = PERMISSIONS.map((item) => item.code);

export function isPermissionCode(value: string): boolean {
  return PERMISSION_CODES.includes(value);
}
