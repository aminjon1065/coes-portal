import { useContext, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { now } from '@coes/core/clock.ts';
import styles from './vvod.module.css';
import { formatDate, formatFileSize, DASH } from './formaty.ts';
import { Button, IconButton } from './deistviya.tsx';
import { Tag } from './dannye.tsx';
import { FieldIdContext } from './vvod.tsx';
import type { FieldState } from './vvod.tsx';

/** Дата, период, файлы — docs/07-КОМПОНЕНТЫ.md § 7.5, § 7.6, § 7.14. */

/** Неделя начинается с понедельника (§ 7.5). */
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

const DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/u;

/** Разбор ввода с клавиатуры в формате дд.ММ.гггг (§ 7.5). */
export function parseDate(text: string): Date | undefined {
  const match = DATE_PATTERN.exec(text.trim());
  if (match === null) return undefined;
  const [, d = '', m = '', y = ''] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const valid = date.getDate() === Number(d)
    && date.getMonth() === Number(m) - 1
    && date.getFullYear() === Number(y);
  return valid ? date : undefined;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Смещение первого дня месяца при неделе, начинающейся с понедельника. */
function firstOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

interface CalendarProps {
  readonly value: Date | undefined;
  readonly min?: Date | undefined;
  readonly max?: Date | undefined;
  readonly onPick: (date: Date) => void;
}

function CalendarGrid({ value, min, max, onPick }: CalendarProps): ReactNode {
  const today = now();
  const start = value ?? today;
  const [shown, setShown] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const days = new Date(shown.year, shown.month + 1, 0).getDate();
  const offset = firstOffset(shown.year, shown.month);

  const step = (delta: number): void => {
    const next = new Date(shown.year, shown.month + delta, 1);
    setShown({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHead}>
        <IconButton label="Предыдущий месяц" size="s" icon={<ChevronLeft size={16} aria-hidden="true" />} onClick={() => { step(-1); }} />
        <span>{`${MONTHS[shown.month] ?? ''} ${String(shown.year)}`}</span>
        <IconButton label="Следующий месяц" size="s" icon={<ChevronRight size={16} aria-hidden="true" />} onClick={() => { step(1); }} />
      </div>
      <div className={styles.calendarGrid}>
        {WEEKDAYS.map((day) => <span className={styles.weekday} key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`gap-${String(i)}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(shown.year, shown.month, i + 1);
          const blocked = (min !== undefined && date < min) || (max !== undefined && date > max);
          return (
            <button
              className={[
                styles.day,
                sameDay(date, today) ? styles.dayToday : '',
                value !== undefined && sameDay(date, value) ? styles.dayChosen : '',
              ].filter(Boolean).join(' ')}
              key={date.toISOString()}
              type="button"
              disabled={blocked}
              onClick={() => { onPick(date); }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DateInputProps {
  readonly value: Date | null;
  readonly onChange: (value: Date | null) => void;
  readonly state?: FieldState;
  readonly min?: Date | undefined;
  readonly max?: Date | undefined;
  readonly id?: string;
}

/**
 * Ввод даты § 7.5: с клавиатуры в формате дд.ММ.гггг и выбором в календаре.
 * Неверный формат объясняется дословно, а не молча отбрасывается.
 */
export function DateInput({ value, onChange, state = 'normal', min, max, id }: DateInputProps): ReactNode {
  const fieldId = useContext(FieldIdContext);
  const [text, setText] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const shown = text ?? (value === null ? '' : formatDate(value));
  const malformed = text !== undefined && text !== '' && parseDate(text) === undefined;
  const outOfRange = value !== null
    && ((min !== undefined && value < min) || (max !== undefined && value > max));

  return (
    <div className={styles.dateWrap}>
      <span className={[
        styles.control,
        malformed || outOfRange ? styles.controlError : '',
        state === 'disabled' ? styles.controlDisabled : '',
      ].filter(Boolean).join(' ')}
      >
        <input
          className={styles.input}
          id={id ?? fieldId}
          type="text"
          inputMode="numeric"
          value={shown}
          placeholder="дд.мм.гггг"
          disabled={state === 'disabled'}
          readOnly={state === 'readonly'}
          onChange={(event) => {
            setText(event.target.value);
            const parsed = parseDate(event.target.value);
            if (parsed !== undefined) onChange(parsed);
            if (event.target.value === '') onChange(null);
          }}
          onBlur={() => { setText(undefined); }}
        />
        <IconButton
          label="Открыть календарь"
          size="s"
          icon={<Calendar size={16} aria-hidden="true" />}
          disabled={state === 'disabled' || state === 'readonly'}
          onClick={() => { setOpen(!open); }}
        />
      </span>
      {malformed ? <span className={styles.error} role="alert">Введите дату в формате дд.мм.гггг</span> : null}
      {outOfRange ? (
        <span className={styles.error} role="alert">
          {`Допустимо с ${min === undefined ? DASH : formatDate(min)} по ${max === undefined ? DASH : formatDate(max)}`}
        </span>
      ) : null}
      {open ? (
        <CalendarGrid
          value={value ?? undefined}
          min={min}
          max={max}
          onPick={(date) => { onChange(date); setText(undefined); setOpen(false); }}
        />
      ) : null}
    </div>
  );
}

export type PeriodPreset =
  | 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth' | 'quarter' | 'year' | 'custom';

export const PERIOD_PRESETS: readonly { readonly id: PeriodPreset; readonly label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'yesterday', label: 'Вчера' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Текущий месяц' },
  { id: 'prevMonth', label: 'Прошлый месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
  { id: 'custom', label: 'Произвольный' },
];

/** Границы готового периода. Считаются от единственного источника времени. */
export function presetRange(preset: PeriodPreset): { readonly from: Date | null; readonly to: Date | null } {
  const today = now();
  const day = (offset: number): Date =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  switch (preset) {
    case 'today': return { from: day(0), to: day(0) };
    case 'yesterday': return { from: day(-1), to: day(-1) };
    case 'week': return { from: day(-6), to: day(0) };
    case 'month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: day(0) };
    case 'prevMonth': return {
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 0),
    };
    case 'quarter': return {
      from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
      to: day(0),
    };
    case 'year': return { from: new Date(today.getFullYear(), 0, 1), to: day(0) };
    default: return { from: null, to: null };
  }
}

export interface DateRangeInputProps {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly onChange: (from: Date | null, to: Date | null) => void;
  readonly state?: FieldState;
}

/** Ввод периода § 7.6. Проверка: конец не раньше начала. */
export function DateRangeInput({ from, to, onChange, state = 'normal' }: DateRangeInputProps): ReactNode {
  const reversed = from !== null && to !== null && to < from;
  return (
    <div className={styles.range}>
      <div className={styles.rangeFields}>
        <DateInput value={from} state={state} onChange={(value) => { onChange(value, to); }} />
        <span>{DASH}</span>
        <DateInput value={to} state={state} onChange={(value) => { onChange(from, value); }} />
      </div>
      <div className={styles.presets}>
        {PERIOD_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            kind="quiet"
            size="s"
            disabled={state === 'disabled'}
            onClick={() => { const range = presetRange(preset.id); onChange(range.from, range.to); }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {reversed ? <span className={styles.error} role="alert">Конец периода не может быть раньше начала</span> : null}
    </div>
  );
}

export type UploadState = 'waiting' | 'uploading' | 'done' | 'error';

export interface UploadedFile {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly state: UploadState;
  /** Доля переданных байтов. Единственный процент в системе (§ 7.14). */
  readonly progress?: number;
  /** Причина отказа: точный текст из реестра пределов, а не «ошибка». */
  readonly error?: string;
  readonly icon?: ReactNode;
}

export interface FileUploadProps {
  readonly files: readonly UploadedFile[];
  readonly onPick: (files: FileList) => void;
  readonly onRemove: (id: string) => void;
  /** Отказ по пределу: текст берётся из реестра и здесь не сочиняется. */
  readonly limitMessage?: string;
  readonly disabled?: boolean;
}

export function FileUpload({ files, onPick, onRemove, limitMessage, disabled = false }: FileUploadProps): ReactNode {
  // Кнопка нажимает скрытое поле выбора файлов сама: кнопка внутри подписи
  // проглотила бы нажатие и до поля оно не дошло бы.
  const picker = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className={styles.drop}>
        <Upload size={24} aria-hidden="true" />
        <span>Перетащите файлы сюда</span>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Выбрать файлы"
          disabled={disabled}
          onChange={(event) => { if (event.target.files !== null) onPick(event.target.files); }}
        />
        <Button kind="normal" size="s" disabled={disabled} onClick={() => { picker.current?.click(); }}>
          Выбрать файлы
        </Button>
      </div>
      {limitMessage === undefined ? null : <span className={styles.error} role="alert">{limitMessage}</span>}
      {files.map((file) => (
        <div className={styles.fileRow} key={file.id}>
          {file.icon}
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
          {file.state === 'uploading' ? (
            <span className={styles.progress}>
              <span className={styles.progressFill} ref={(el) => {
                if (el !== null) el.style.setProperty('width', `${String(Math.round((file.progress ?? 0) * 100))}%`);
              }}
              />
            </span>
          ) : null}
          {file.state === 'waiting' ? <Tag>Ожидание</Tag> : null}
          {file.state === 'done' ? <Tag tone="success">Загружен</Tag> : null}
          {file.state === 'error' ? <span className={styles.fileError}>{file.error ?? DASH}</span> : null}
          <IconButton label={`Удалить ${file.name}`} size="s" icon={<X size={16} aria-hidden="true" />} onClick={() => { onRemove(file.id); }} />
        </div>
      ))}
    </div>
  );
}
