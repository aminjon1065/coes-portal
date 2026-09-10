import type { FastifyInstance } from 'fastify';
import type { Client } from 'pg';
import { listSettings, saveSettings, systemStatus, SYS_PERMISSIONS } from './public.ts';
import { settingsUpdateRequest } from './schema.ts';
import { endpointByName, routePath, parseRequest } from '@coes/contracts';

/**
 * Регистрация методов модуля sys. Пути и требуемые разрешения берутся из
 * перечня packages/contracts: путь, не описанный там, здесь не появится
 * (docs/09-API.md § 10, п. 8).
 */
export interface SysDeps {
  readonly db: Client;
  readonly dataPath: string;
}

export function registerSysRoutes(app: FastifyInstance, deps: SysDeps): void {
  const settingsRead = endpointByName('getSettings');
  const settingsWrite = endpointByName('putSettings');
  const status = endpointByName('getSystemStatus');

  app.get(routePath(settingsRead), async () => ({ items: await listSettings(deps.db) }));

  app.put(routePath(settingsWrite), async (request) => {
    const body = parseRequest(settingsUpdateRequest, request.body);
    return { items: await saveSettings(deps.db, body.items) };
  });

  app.get(routePath(status), async () => systemStatus(deps.db, deps.dataPath));

  // Требуемые разрешения объявлены в перечне и здесь только сверяются:
  // расхождение кода разрешения между описанием и модулем — дефект.
  const declared = [settingsRead.permission, settingsWrite.permission, status.permission];
  const expected: readonly (string | null)[] = [
    SYS_PERMISSIONS.settingRead, SYS_PERMISSIONS.settingManage, SYS_PERMISSIONS.statusRead,
  ];
  for (const [index, permission] of declared.entries()) {
    if (permission !== expected[index]) {
      throw new Error(
        `Разрешение метода в перечне (${String(permission)}) не совпадает с объявленным в модуле (${String(expected[index])}).`,
      );
    }
  }
}
