import { Client } from 'pg';

/**
 * Адрес базы локальной среды (docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3).
 * На сервере значение приходит переменной окружения; здесь — умолчание,
 * чтобы разработка не требовала настройки перед первым запуском.
 */
export const LOCAL_DATABASE_URL = 'postgresql://coes_owner:coes_local@127.0.0.1:5432/coes';

export function databaseUrl(): string {
  return process.env['DATABASE_URL'] ?? LOCAL_DATABASE_URL;
}

/**
 * Подключение с внятным отказом. Молчаливое продолжение работы без базы
 * запрещено: проверка, не дошедшая до базы, ничего не проверила.
 */
export async function connect(url: string = databaseUrl()): Promise<Client> {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Не удалось подключиться к базе (${url.replace(/:[^:@]*@/, ':***@')}): ${reason}\n` +
        'Поднимите локальную среду: ./deploy/local/up.sh',
    );
  }
  return client;
}
