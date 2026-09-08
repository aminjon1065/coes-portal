import { describe, it, expect } from 'vitest';
import { findUrlViolations, planColumnScan, columnName } from './core.ts';

const описание = { schema: 'incident', table: 'incident', column: 'description' };
const настройка = { schema: 'sys', table: 'setting', column: 'value' };
const allowlist = ['sys.setting.value'];

/** Барьер П-5: абсолютный адрес системы не хранится в данных. */
describe('check:urls', () => {
  it('ловит сохранённый абсолютный адрес', () => {
    expect(
      findUrlViolations([{ column: описание, value: 'https://cmc.techdev.tj/incidents/1' }], allowlist),
    ).toEqual([{ column: описание, value: 'https://cmc.techdev.tj/incidents/1' }]);
  });

  it('пропускает относительный путь: так и полагается хранить ссылки', () => {
    expect(findUrlViolations([{ column: описание, value: '/incidents/1' }], allowlist)).toEqual([]);
  });

  it('пропускает столбец из перечня исключений', () => {
    expect(
      findUrlViolations([{ column: настройка, value: 'https://cmc.techdev.tj' }], allowlist),
    ).toEqual([]);
  });

  it('перечень задаёт исключения, а не охват: новый столбец проверяется сам', () => {
    const новый = { schema: 'task', table: 'task', column: 'description' };
    expect(planColumnScan([описание, настройка, новый], allowlist).map(columnName)).toEqual([
      'incident.incident.description',
      'task.task.description',
    ]);
  });

  it('пустой набор столбцов нарушений не даёт', () => {
    expect(findUrlViolations([], allowlist)).toEqual([]);
  });
});
