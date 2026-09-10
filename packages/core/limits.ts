import { pick, type ByProfile } from './profile.ts';

/**
 * Реестр пределов — docs/03-АРХИТЕКТУРА.md § 6, § 5.11.
 *
 * Числовая константа, ограничивающая работу пользователя, в коде запрещена:
 * у ограничения обязаны быть ключ, значение по умолчанию, точка применения
 * и текст отказа. Наборов значений два — локальный и продуктовый, — потому
 * что одно значение на обе среды означало бы, что локальная среда упадёт.
 *
 * Текст отказа не содержит зашитого числа: оно подставляется из
 * действующего значения. Иначе локальный отказ сообщал бы продуктовое
 * число. Подстановка — `refuse`, проверка отсутствия зашитых чисел —
 * `pnpm check:limits`.
 */

export interface LimitEntry {
  readonly key: string;
  readonly local: number | string;
  readonly server: number | string;
  /** Точка применения: модуль или приложение (§ 6). */
  readonly module: string;
  /**
   * Что должно быть построено, чтобы предел стало где применять. Предел
   * подписок на видео применяется в веб-приложении, но бессмыслен без
   * модуля совещаний.
   */
  readonly requires?: string;
  /** Текст отказа с местом подстановки {value}; {need} — требуемое. */
  readonly message: string;
}

export const LIMITS: readonly LimitEntry[] = [
  {
    key: 'LIMIT_MEETING_CONCURRENT', local: 2, server: 2, module: 'meet',
    message: 'Идут {value} совещания. Начать ещё одно нельзя. Дождитесь окончания одного из них.',
  },
  {
    key: 'LIMIT_MEETING_PARTICIPANTS', local: 6, server: 20, module: 'meet',
    message: 'В совещании уже {value} участников — это предел.',
  },
  {
    key: 'LIMIT_MEETING_VIDEO_SUBSCRIPTIONS', local: 3, server: 9, module: 'web', requires: 'meet',
    message: 'Показано видео {value} участников: говорящих и закреплённых. Остальные слышны, их видео не передаётся.',
  },
  {
    key: 'LIMIT_RECORDING_CONCURRENT', local: 1, server: 1, module: 'meet',
    message: 'Идёт запись другого совещания. Одновременно ведётся {value} запись.',
  },
  {
    key: 'LIMIT_CONVERSION_CONCURRENT', local: 1, server: 1, module: 'worker',
    message: 'Преобразование выполняется по {value} за раз. Ваша задача в очереди, позиция — {need}.',
  },
  {
    key: 'LIMIT_REPORT_ROWS', local: 50000, server: 200000, module: 'analytics',
    message: 'Отчёт содержит более {value} строк. Сузьте период или добавьте условие отбора.',
  },
  {
    key: 'LIMIT_EXPORT_PDF_PAGES', local: 500, server: 500, module: 'template',
    message: 'Документ длиннее {value} страниц. Выгрузите в Excel.',
  },
  {
    key: 'LIMIT_UPLOAD_SIZE_MB', local: 128, server: 512, module: 'store',
    message: 'Файл больше {value} МБ.',
  },
  {
    key: 'LIMIT_CHAT_ATTACH_MB', local: 32, server: 100, module: 'chat',
    message: 'Файл в переписке — не больше {value} МБ.',
  },
  {
    key: 'LIMIT_DISK_FREE_GB', local: 20, server: 200, module: 'store',
    message: 'На диске осталось {need} ГБ из необходимых {value}. Загрузка файлов и запись совещаний остановлены. Обратитесь к администратору.',
  },
  {
    key: 'LIMIT_MAP_FEATURES', local: 5000, server: 5000, module: 'geo',
    message: 'Показаны первые {value} объектов. Уточните условия отбора.',
  },
  {
    key: 'LIMIT_IMPORT_ROWS', local: 200000, server: 200000, module: 'worker',
    message: 'В файле {need} строк, предел — {value}. Разделите файл на части.',
  },
  {
    key: 'LIMIT_SESSION_PER_ACCOUNT', local: 5, server: 5, module: 'iam',
    message: 'Открыто {value} сессий — это предел. Самая старая сессия закрыта.',
  },
  {
    key: 'LIMIT_LOGIN_ATTEMPTS', local: 10, server: 10, module: 'iam',
    message: 'Слишком много попыток входа: допускается {value} за пятнадцать минут. Повторите через {need} минут или обратитесь к администратору.',
  },
  {
    key: 'LIMIT_LIST_PAGE_SIZE', local: 200, server: 200, module: 'api',
    message: 'За один раз выдаётся не более {value} записей. Запросите меньше.',
  },
  {
    key: 'LIMIT_ATTACHMENTS_PER_CARD', local: 50, server: 50, module: 'incident',
    message: 'К карточке нельзя приложить больше {value} файлов.',
  },
  {
    key: 'LIMIT_LAYER_FEATURES', local: 100000, server: 100000, module: 'geo',
    message: 'В слое {need} объектов, предел — {value}. Разделите слой.',
  },
  {
    key: 'LIMIT_JOB_RUNTIME_MIN', local: 30, server: 30, module: 'worker',
    message: 'Задание выполнялось дольше {value} минут и прервано. Сузьте условия и запросите заново.',
  },
];

const BY_KEY: ReadonlyMap<string, LimitEntry> = new Map(LIMITS.map((entry) => [entry.key, entry]));

export function limitEntry(key: string): LimitEntry {
  const entry = BY_KEY.get(key);
  if (entry === undefined) {
    throw new Error(`Предел «${key}» не объявлен в реестре packages/core/limits.ts (§ 6).`);
  }
  return entry;
}

/**
 * Действующее значение предела. Порядок § 5.11: переменная окружения →
 * строка в sys.setting → значение по умолчанию профиля. Строки настроек
 * передаются вызывающим: пакет core не обращается к базе.
 */
export function limitValue(
  key: string,
  fromSettings: Readonly<Record<string, string>> = {},
  env: NodeJS.ProcessEnv = process.env,
): number | string {
  const entry = limitEntry(key);
  const fromEnv = env[key];
  if (fromEnv !== undefined && fromEnv !== '') return numberOrText(fromEnv);
  const stored = fromSettings[key];
  if (stored !== undefined && stored !== '') return numberOrText(stored);
  const byProfile: ByProfile<number | string> = { local: entry.local, server: entry.server };
  return pick(byProfile, env);
}

function numberOrText(raw: string): number | string {
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && raw.trim() !== '' ? asNumber : raw;
}

/**
 * Текст отказа с подставленными числами. Зашитых чисел в текстах нет:
 * иначе локальный отказ сообщал бы продуктовое число (§ 6).
 */
export function refuse(
  key: string,
  extra: { readonly need?: number | string } = {},
  fromSettings: Readonly<Record<string, string>> = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = limitValue(key, fromSettings, env);
  return limitEntry(key).message
    .replaceAll('{value}', String(value))
    .replaceAll('{need}', String(extra.need ?? ''));
}
