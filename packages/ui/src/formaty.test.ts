import { describe, expect, it } from 'vitest';
import {
  DASH, formatDate, formatDateTime, formatDateTimeSeconds, formatPeriod,
  formatInteger, formatDecimal, formatPercent, formatMoney, formatFileSize,
  formatDuration, formatDegrees,
} from './formaty.ts';

describe('форматы данных, docs/06 § 8', () => {
  it('дата и время выводятся по образцам документа', () => {
    const moment = new Date(2026, 8, 8, 14, 35, 7);
    expect(formatDate(moment)).toBe('08.09.2026');
    expect(formatDateTime(moment)).toBe('08.09.2026 14:35');
    expect(formatDateTimeSeconds(moment)).toBe('08.09.2026 14:35:07');
    expect(formatPeriod(new Date(2026, 0, 1), new Date(2026, 2, 31))).toBe('01.01.2026 — 31.03.2026');
  });

  it('разряды целого разделяются узким неразрывным пробелом U+202F', () => {
    expect(formatInteger(1234567)).toBe('1 234 567');
    expect(formatInteger(999)).toBe('999');
    expect(formatInteger(-1234)).toBe('-1 234');
  });

  // На различии «нет данных» и «ноль» стоит вся статистика: «погибших нет»
  // и «данных о погибших нет» — разные утверждения.
  it('ноль остаётся нулём, а отсутствие данных — знаком тире', () => {
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(null)).toBe(DASH);
    expect(formatInteger(undefined)).toBe(DASH);
    expect(formatDecimal(0, 1)).toBe('0,0');
    expect(formatDate(null)).toBe(DASH);
    expect(DASH).toBe('—');
  });

  it('дробное число разделяется запятой', () => {
    expect(formatDecimal(12.5)).toBe('12,5');
    expect(formatDecimal(1234.56, 2)).toBe('1 234,56');
    expect(formatPercent(12.5)).toBe('12,5 %');
    expect(formatMoney(1234567.89)).toBe('1 234 567,89 смн');
  });

  it('размер файла, длительность и координаты', () => {
    expect(formatFileSize(13002342)).toBe('12,4 МБ');
    expect(formatDuration(45)).toBe('45 с');
    expect(formatDuration(600)).toBe('10 мин');
    expect(formatDuration(5040)).toBe('1 ч 24 мин');
    expect(formatDegrees(38.5598)).toBe('38,55980°');
  });

  it('негодная дата не выдаётся за настоящую', () => {
    expect(formatDate('не дата')).toBe(DASH);
    expect(formatDateTime('')).toBe(DASH);
  });
});
