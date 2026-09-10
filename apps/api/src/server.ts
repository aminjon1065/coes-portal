import { connect } from '@coes/db/connect.ts';
import { buildApp } from './bootstrap.ts';

/**
 * Запуск сервера. Порт и путь данных приходят окружением; умолчания — для
 * локальной среды (docs/12-ЭКСПЛУАТАЦИЯ.md § 0.3).
 */
const PORT = Number(process.env['API_PORT'] ?? 8081);
const DATA_PATH = process.env['COES_DATA_PATH'] ?? '.';

const db = await connect();
const app = buildApp({ db, dataPath: DATA_PATH });

try {
  await app.listen({ host: '127.0.0.1', port: PORT });
} catch (error) {
  app.log.error({ err: error }, 'сервер не поднялся');
  await db.end();
  process.exit(1);
}
