import { describe, it, expect } from 'vitest';
import { findFirstBreak, type ChainLink } from './core.ts';

const link = (id: string, prevHash: string | null, hash: string, expectedHash = hash): ChainLink =>
  ({ id, prevHash, hash, expectedHash });

/** Барьер adr/12: изъятие или подмена записи журнала обнаруживается. */
describe('целостность журнала', () => {
  it('целая цепочка нарушений не даёт', () => {
    expect(findFirstBreak([link('1', null, 'a'), link('2', 'a', 'b'), link('3', 'b', 'c')])).toBeNull();
  });

  it('пустой журнал нарушений не даёт', () => {
    expect(findFirstBreak([])).toBeNull();
  });

  it('ловит изменённое содержимое записи', () => {
    const links = [link('1', null, 'a'), link('2', 'a', 'b', 'ДРУГОЙ')];
    expect(findFirstBreak(links)).toEqual({ id: '2', reason: 'содержимое записи изменено' });
  });

  it('ловит разорванную связь: запись из середины изъята', () => {
    const links = [link('1', null, 'a'), link('3', 'b', 'c')];
    expect(findFirstBreak(links)).toEqual({ id: '3', reason: 'связь с предыдущей записью разорвана' });
  });

  it('ловит подменённое начало цепочки', () => {
    expect(findFirstBreak([link('1', 'откуда-то', 'a')])).toEqual({
      id: '1', reason: 'связь с предыдущей записью разорвана',
    });
  });

  it('сообщает ПЕРВОЕ нарушение, а не последнее', () => {
    const links = [link('1', null, 'a'), link('2', 'a', 'b', 'X'), link('3', 'b', 'c', 'Y')];
    expect(findFirstBreak(links)?.id).toBe('2');
  });
});
