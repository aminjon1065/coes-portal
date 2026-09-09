/**
 * Профиль развёртывания (docs/03-АРХИТЕКТУРА.md § 6, § 7).
 *
 * Наборов значений по умолчанию два — локальный и продуктовый. Набор
 * выбирается переменной окружения `DEPLOY_PROFILE`, задаваемой файлом
 * сборки, а не пользователем (решение Держателя контракта от 2026-09-09,
 * запись В-9).
 *
 * Незаданный или неизвестный профиль — ОТКАЗ ПРИ ЗАПУСКЕ, а не молчаливый
 * выбор продуктового: одно значение на обе среды означало бы, что локальная
 * среда получит предел диска в 200 ГБ при 20 доступных и совещание на
 * двадцать участников вместо шести.
 */

export const PROFILES = ['local', 'server'] as const;
export type Profile = (typeof PROFILES)[number];

export const PROFILE_VARIABLE = 'DEPLOY_PROFILE';

export function isProfile(value: string | undefined): value is Profile {
  return value !== undefined && (PROFILES as readonly string[]).includes(value);
}

/**
 * Профиль из окружения. Бросает при незаданном или неизвестном значении:
 * догадываться, в какой среде мы работаем, недопустимо.
 */
export function currentProfile(env: NodeJS.ProcessEnv = process.env): Profile {
  const value = env[PROFILE_VARIABLE];
  if (!isProfile(value)) {
    throw new Error(
      `Переменная ${PROFILE_VARIABLE} должна быть одной из: ${PROFILES.join(', ')}. ` +
        `Получено: ${value === undefined ? 'не задана' : `«${value}»`}. ` +
        'Профиль задаётся файлом сборки: deploy/local/compose.local.yml — local, ' +
        'deploy/compose/compose.prod.yml — server.',
    );
  }
  return value;
}

/** Значение, зависящее от профиля. */
export interface ByProfile<T> {
  readonly local: T;
  readonly server: T;
}

/** Выбирает значение по текущему профилю. */
export function pick<T>(values: ByProfile<T>, env: NodeJS.ProcessEnv = process.env): T {
  return values[currentProfile(env)];
}
