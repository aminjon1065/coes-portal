import { describe, it, expect } from 'vitest';
import { findUrlViolations, planColumnScan, columnName } from './core.ts';

const description = { schema: 'incident', table: 'incident', column: 'description' };
const setting = { schema: 'sys', table: 'setting', column: 'value' };
const allowlist = ['sys.setting.value'];

/** Барьер П-5: абсолютный адрес системы не хранится в данных. */
describe('check:urls', () => {
  it('ловит сохранённый абсолютный адрес', () => {
    expect(
      findUrlViolations([{ column: description, value: 'https://cmc.techdev.tj/incidents/1' }], allowlist),
    ).toEqual([{ column: description, value: 'https://cmc.techdev.tj/incidents/1' }]);
  });

  it('пропускает относительный путь: так и полагается хранить ссылки', () => {
    expect(findUrlViolations([{ column: description, value: '/incidents/1' }], allowlist)).toEqual([]);
  });

  it('пропускает столбец из перечня исключений', () => {
    expect(
      findUrlViolations([{ column: setting, value: 'https://cmc.techdev.tj' }], allowlist),
    ).toEqual([]);
  });

  it('перечень задаёт исключения, а не охват: новый столбец проверяется сам', () => {
    const next = { schema: 'task', table: 'task', column: 'description' };
    expect(planColumnScan([description, setting, next], allowlist).map(columnName)).toEqual([
      'incident.incident.description',
      'task.task.description',
    ]);
  });

  it('пустой набор столбцов нарушений не даёт', () => {
    expect(findUrlViolations([], allowlist)).toEqual([]);
  });
});
