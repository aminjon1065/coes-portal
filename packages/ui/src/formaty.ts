/**
 * Форматы данных — docs/06-ДИЗАЙН-СИСТЕМА.md § 8.
 *
 * Собраны в одном месте потому, что расхождение форматов между экранами —
 * первое, что замечает пользователь, и последнее, что находит проверка.
 */

/** Знак отсутствия данных. Пустая ячейка запрещена: она неотличима от сбоя. */
export const DASH = '—';

/** Узкий неразрывный пробел U+202F — разделитель разрядов. */
const GROUP = ' ';

/** Неразрывный пробел перед знаком процента. */
const NBSP = ' ';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function asDate(value: Date | string): Date | undefined {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `дд.ММ.гггг` */
export function formatDate(value: Date | string | null | undefined): string {
  const date = value === null || value === undefined ? undefined : asDate(value);
  if (date === undefined) return DASH;
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
}

/** `дд.ММ.гггг ЧЧ:мм` */
export function formatDateTime(value: Date | string | null | undefined): string {
  const date = value === null || value === undefined ? undefined : asDate(value);
  if (date === undefined) return DASH;
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `дд.ММ.гггг ЧЧ:мм:сс` — только журнал действий. */
export function formatDateTimeSeconds(value: Date | string | null | undefined): string {
  const date = value === null || value === undefined ? undefined : asDate(value);
  if (date === undefined) return DASH;
  return `${formatDateTime(date)}:${pad(date.getSeconds())}`;
}

/** `дд.ММ.гггг — дд.ММ.гггг` */
export function formatPeriod(from: Date | string | null | undefined, to: Date | string | null | undefined): string {
  return `${formatDate(from)} ${DASH} ${formatDate(to)}`;
}

/**
 * Целое: разряды через узкий неразрывный пробел. Ноль остаётся нулём:
 * «погибших нет» и «данных о погибших нет» — разные утверждения.
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    const left = digits.length - i;
    out += digits[i] ?? '';
    if (left > 1 && left % 3 === 1) out += GROUP;
  }
  return sign + out;
}

/** Дробное: запятая как разделитель, разряды целой части — как у целого. */
export function formatDecimal(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const fixed = Math.abs(value).toFixed(digits);
  const [whole = '0', fraction] = fixed.split('.');
  const sign = value < 0 ? '-' : '';
  const head = formatInteger(Number(whole));
  return fraction === undefined ? sign + head : `${sign}${head},${fraction}`;
}

/** Проценты: число, неразрывный пробел, знак. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${formatDecimal(value, digits)}${NBSP}%`;
}

/** Деньги: сомони. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${formatDecimal(value, 2)} смн`;
}

/** Размер файла: один знак после запятой. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return DASH;
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${unit === 0 ? formatInteger(value) : formatDecimal(value, 1)} ${units[unit] ?? ''}`;
}

/** Длительность: `Ч ч М мин`, менее часа — `М мин`, менее минуты — `С с`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return DASH;
  const whole = Math.trunc(seconds);
  if (whole < 60) return `${String(whole)} с`;
  const minutes = Math.trunc(whole / 60);
  if (minutes < 60) return `${String(minutes)} мин`;
  return `${String(Math.trunc(minutes / 60))} ч ${String(minutes % 60)} мин`;
}

/** Координата в градусах: пять знаков после запятой. */
export function formatDegrees(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${formatDecimal(value, 5)}°`;
}
