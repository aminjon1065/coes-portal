import { describe, it, expect } from 'vitest';
import { REGISTRY, ENDPOINTS, API_BASE } from './registry.ts';
import { PERMISSION_CODES } from './permissions.ts';

/** Перечень методов — docs/09-API.md § 1, § 10. */
describe('перечень методов', () => {
  // Иначе перестановка записи молча переименовала бы метод клиента.
  it('имя метода совпадает с ключом описания', () => {
    for (const [key, endpoint] of Object.entries(REGISTRY)) {
      expect(endpoint.name, key).toBe(key);
    }
  });

  it('пути не повторяются в пределах одного способа обращения', () => {
    const seen = new Set<string>();
    for (const endpoint of ENDPOINTS) {
      const signature = `${endpoint.method} ${endpoint.path}`;
      expect(seen.has(signature), signature).toBe(false);
      seen.add(signature);
    }
  });

  // § 1: существительное во множественном числе, kebab-case.
  it('пути начинаются с косой черты и не содержат основания', () => {
    for (const endpoint of ENDPOINTS) {
      expect(endpoint.path.startsWith('/'), endpoint.name).toBe(true);
      expect(endpoint.path.includes(API_BASE), endpoint.name).toBe(false);
      expect(endpoint.path, endpoint.name).toBe(endpoint.path.toLowerCase().replace(/\{ID\}/gu, '{id}'));
    }
  });

  /**
   * Метод без явного указания прав — дефект: третьего состояния между
   * «доступен вошедшему» и «вход не требуется» нет (§ 10, п. 2).
   */
  it('у каждого метода объявлено требуемое разрешение из перечня § 2.3', () => {
    for (const endpoint of ENDPOINTS) {
      if (endpoint.permission === null || endpoint.permission === 'anonymous') continue;
      expect(PERMISSION_CODES, `${endpoint.name}: ${endpoint.permission}`)
        .toContain(endpoint.permission);
    }
  });

  it('вход — единственный метод без проверки подлинности', () => {
    const anonymous = ENDPOINTS.filter((endpoint) => endpoint.permission === 'anonymous');
    expect(anonymous.map((endpoint) => endpoint.name)).toEqual(['login']);
  });

  it('изменяющий метод имеет схему тела, кроме действий без параметров', () => {
    const withoutBody = ENDPOINTS
      .filter((endpoint) => endpoint.method !== 'GET' && endpoint.request === undefined)
      .map((endpoint) => endpoint.name);
    expect(withoutBody).toEqual(['logout', 'unblockAccount', 'verifyAudit']);
  });
});
