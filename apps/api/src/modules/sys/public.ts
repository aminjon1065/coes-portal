/**
 * Единственный разрешённый вход в модуль sys извне (docs/03-АРХИТЕКТУРА.md § 3).
 * Наружу выходят функции прикладной логики, типы их результатов и коды
 * разрешений модуля. Запросы к базе и типы строк таблиц — не выходят.
 */
export { listSettings, saveSettings, systemStatus } from './service.ts';
export type { Setting, SystemStatus } from './service.ts';

export const SYS_PERMISSIONS = {
  settingRead: 'sys.setting.read',
  settingManage: 'sys.setting.manage',
  statusRead: 'sys.status.read',
} as const;
