import { describe, it, expect } from 'vitest';
import { compareGenerated, type GeneratedArtifact } from './core.ts';

const artifact: GeneratedArtifact = {
  path: 'packages/contracts/openapi.json',
  command: 'pnpm run gen:openapi',
};

/** Барьер П-2: сгенерированное обязано совпадать с закоммиченным. */
describe('check:generated', () => {
  it('пропускает совпадающие артефакты', () => {
    expect(compareGenerated([{ artifact, committed: '{"a":1}', produced: '{"a":1}' }])).toEqual([]);
  });

  it('ловит расхождение с генератором', () => {
    expect(compareGenerated([{ artifact, committed: '{"a":1}', produced: '{"a":2}' }])).toEqual([
      { path: artifact.path, reason: 'расходится с генератором' },
    ]);
  });

  it('ловит отсутствие закоммиченного артефакта', () => {
    expect(compareGenerated([{ artifact, committed: null, produced: '{"a":1}' }])).toEqual([
      { path: artifact.path, reason: 'отсутствует в репозитории' },
    ]);
  });

  it('сравнение побайтовое: лишний перевод строки — расхождение', () => {
    expect(compareGenerated([{ artifact, committed: '{"a":1}\n', produced: '{"a":1}' }])).toHaveLength(1);
  });

  it('пустой перечень расхождений не даёт', () => {
    expect(compareGenerated([])).toEqual([]);
  });
});
