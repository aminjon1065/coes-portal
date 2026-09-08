import { describe, it, expect } from 'vitest';
import { checkComposeText } from './core.ts';

/** Барьер § 11.2: файлы развёртывания собираются заранее и разбираются. */
describe('check:deploy', () => {
  it('пропускает корректный файл сборки', () => {
    const text = 'services:\n  db:\n    image: postgres:17\n';
    expect(checkComposeText('deploy/local/compose.local.yml', text)).toEqual([]);
  });

  it('ловит неразбираемый YAML', () => {
    const problems = checkComposeText('a.yml', 'services:\n  db:\n   image: [1,\n');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/не разбирается как YAML/);
  });

  it('ловит файл без раздела services', () => {
    expect(checkComposeText('a.yml', 'volumes:\n  data: {}\n')).toEqual([
      { file: 'a.yml', message: 'нет раздела services' },
    ]);
  });

  it('ловит пустой раздел services', () => {
    expect(checkComposeText('a.yml', 'services: {}\n')).toEqual([
      { file: 'a.yml', message: 'раздел services пуст' },
    ]);
  });

  it('ловит пустой файл', () => {
    expect(checkComposeText('a.yml', '')).toEqual([{ file: 'a.yml', message: 'пуст или не является объектом' }]);
  });
});
