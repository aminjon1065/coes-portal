import type { GeneratedArtifact } from './core.ts';

/**
 * Перечень генерируемых артефактов (docs/09-API.md § 9).
 * Расхождение сгенерированного с закоммиченным — ошибка сборки (П-2).
 */
export const GENERATED: readonly GeneratedArtifact[] = [
  { path: 'packages/contracts/openapi.json', command: 'pnpm run gen:openapi' },
  { path: 'apps/web/src/api/schemas.ts', command: 'pnpm run gen:client' },
  { path: 'apps/web/src/api/client.ts', command: 'pnpm run gen:client' },
];
