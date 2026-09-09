import { createContext, useContext, useId, useState } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './vvod.module.css';
import { formatDecimal, formatInteger } from './formaty.ts';
import { Tag } from './dannye.tsx';
import { EmptyState, Spinner, ErrorState } from './sostoyaniya.tsx';
import { IconButton } from './deistviya.tsx';

/** Ввод — docs/07-КОМПОНЕНТЫ.md § 7. */

export type FieldState = 'normal' | 'error' | 'disabled' | 'readonly';

/**
 * Связь подписи с элементом ввода не может зависеть от того, вспомнит ли
 * вызывающий передать одинаковый идентификатор в оба места: § 7.1 запрещает
 * элемент ввода без подписи, а забытый идентификатор — ровно такой случай.
 * Поэтому идентификатор рождается в поле и доходит до элемента сам.
 */
const FieldIdContext = createContext<string | undefined>(undefined);

export interface FieldProps {
  /** «подпись» — обязательна: поле без подписи запрещено (§ 7.1). */
  readonly label: string;
  /** Состояние «только чтение» показывает значение текстом, и элемент
      ввода тогда не нужен вовсе (§ 7.1). */
  readonly children?: ReactNode;
  /** «обязательное» — обозначается звёздочкой после подписи. */
  readonly required?: boolean;
  /** «подсказка» под полем. */
  readonly hint?: string;
  /** «ошибка» — вытесняет подсказку. */
  readonly error?: string;
  /** «состояние» */
  readonly state?: FieldState;
  /** Значение для состояния «только чтение»: показывается текстом. */
  readonly readonlyValue?: ReactNode;
  readonly htmlFor?: string;
}

export function Field({
  label, children, required = false, hint, error, state = 'normal', readonlyValue, htmlFor,
}: FieldProps): ReactNode {
  const generated = useId();
  const id = htmlFor ?? generated;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? <span className={styles.required} aria-hidden="true">{' *'}</span> : null}
      </label>
      {state === 'readonly'
        ? <span className={styles.readonlyValue}>{readonlyValue}</span>
        : <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>}
      {error !== undefined
        ? <span className={styles.error} role="alert">{error}</span>
        : (hint === undefined ? null : <span className={styles.hint}>{hint}</span>)}
    </div>
  );
}

function controlClass(state: FieldState): string {
  return [
    styles.control,
    state === 'error' ? styles.controlError : '',
    state === 'disabled' ? styles.controlDisabled : '',
  ].filter(Boolean).join(' ');
}

export interface TextInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly state?: FieldState;
  /** Пример формата, и только он: подписью placeholder не является (§ 7.2). */
  readonly placeholder?: string;
  readonly icon?: ReactNode;
  readonly suffix?: string;
  readonly clearable?: boolean;
  readonly id?: string;
}

export function TextInput({
  value, onChange, state = 'normal', placeholder, icon, suffix, clearable = false, id,
}: TextInputProps): ReactNode {
  const fieldId = useContext(FieldIdContext);
  return (
    <span className={controlClass(state)}>
      {icon === undefined ? null : <span className={styles.icon}>{icon}</span>}
      <input
        className={styles.input}
        id={id ?? fieldId}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={state === 'disabled'}
        readOnly={state === 'readonly'}
        onChange={(event) => { onChange(event.target.value); }}
      />
      {suffix === undefined ? null : <span className={styles.suffix}>{suffix}</span>}
      {clearable && value !== '' && state === 'normal'
        ? <IconButton label="Очистить" size="s" icon={<X size={16} aria-hidden="true" />} onClick={() => { onChange(''); }} />
        : null}
    </span>
  );
}

export interface TextAreaProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly state?: FieldState;
  /** Ограничение длины. Счётчик появляется при остатке менее 20 % (§ 7.3). */
  readonly maxLength?: number;
  readonly id?: string;
}

export function TextArea({ value, onChange, state = 'normal', maxLength, id }: TextAreaProps): ReactNode {
  const fieldId = useContext(FieldIdContext);
  const left = maxLength === undefined ? undefined : maxLength - value.length;
  const showCounter = maxLength !== undefined && left !== undefined && left < maxLength * 0.2;
  return (
    <>
      <textarea
        className={styles.textarea}
        id={id ?? fieldId}
        value={value}
        maxLength={maxLength}
        disabled={state === 'disabled'}
        readOnly={state === 'readonly'}
        onChange={(event) => { onChange(event.target.value); }}
      />
      {showCounter ? <span className={styles.counter}>{`Осталось ${formatInteger(left)}`}</span> : null}
    </>
  );
}

export interface NumberInputProps {
  /**
   * Пустое поле — это «нет данных», а введённый ноль — это ноль. Компонент
   * обязан их различать, поэтому значение здесь `number | null` (§ 7.4).
   */
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly state?: FieldState;
  readonly min?: number;
  readonly max?: number;
  readonly decimals?: number;
  readonly unit?: string;
  readonly id?: string;
}

/** Точка при вводе заменяется запятой: десятичный разделитель — запятая (§ 7.4). */
function parseNumber(raw: string): number | null {
  // Убираются оба неразрывных пробела: узкий U+202F ставит разделитель
  // разрядов, обычный U+00A0 приходит из буфера обмена.
  const normalized = raw.replace(/[\s\u00A0\u202F]/gu, '').replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumberInput({
  value, onChange, state = 'normal', min, max, decimals = 0, unit, id,
}: NumberInputProps): ReactNode {
  const fieldId = useContext(FieldIdContext);
  // Разряды проставляются при потере фокуса и не мешают вводу (§ 7.4).
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shown = draft ?? (value === null
    ? ''
    : (decimals > 0 ? formatDecimal(value, decimals) : formatInteger(value)));
  const outOfRange = value !== null
    && ((min !== undefined && value < min) || (max !== undefined && value > max));
  return (
    <>
      <span className={controlClass(outOfRange ? 'error' : state)}>
        <input
          className={[styles.input, styles.number].join(' ')}
          id={id ?? fieldId}
          type="text"
          inputMode="decimal"
          value={shown}
          disabled={state === 'disabled'}
          readOnly={state === 'readonly'}
          onFocus={() => { setDraft(value === null ? '' : String(value).replace('.', ',')); }}
          onChange={(event) => {
            const raw = event.target.value.replace('.', ',');
            setDraft(raw);
            onChange(parseNumber(raw));
          }}
          onBlur={() => { setDraft(undefined); }}
        />
        {unit === undefined ? null : <span className={styles.suffix}>{unit}</span>}
      </span>
      {outOfRange ? (
        <span className={styles.error} role="alert">
          {`Допустимо от ${formatDecimal(min ?? Number.NEGATIVE_INFINITY, decimals)} до ${formatDecimal(max ?? Number.POSITIVE_INFINITY, decimals)}`}
        </span>
      ) : null}
    </>
  );
}

export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Частично установлен: часть подчинённых отмечена, часть нет. */
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
}

export function Checkbox({
  label, checked, onChange, indeterminate = false, disabled = false, invalid = false,
}: CheckboxProps): ReactNode {
  return (
    <label className={[styles.checkbox, disabled ? styles.checkboxDisabled : ''].filter(Boolean).join(' ')}>
      <input
        className={styles.checkboxBox}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid}
        ref={(node) => { if (node !== null) node.indeterminate = indeterminate; }}
        onChange={(event) => { onChange(event.target.checked); }}
      />
      <span className={styles.checkboxLabel}>{label}</span>
    </label>
  );
}

export interface RadioOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface RadioGroupProps {
  /** Два-пять вариантов. При большем числе применяется Select (§ 7.12). */
  readonly options: readonly RadioOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly name?: string;
  readonly disabled?: boolean;
}

export function RadioGroup({ options, value, onChange, name, disabled = false }: RadioGroupProps): ReactNode {
  const generated = useId();
  const group = name ?? generated;
  return (
    <div className={styles.radioGroup} role="radiogroup">
      {options.map((option) => (
        <label
          className={[styles.checkbox, disabled || option.disabled === true ? styles.checkboxDisabled : ''].filter(Boolean).join(' ')}
          key={option.value}
        >
          <input
            className={styles.checkboxBox}
            type="radio"
            name={group}
            value={option.value}
            checked={option.value === value}
            disabled={disabled || option.disabled === true}
            onChange={() => { onChange(option.value); }}
          />
          <span className={styles.checkboxLabel}>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export interface SwitchProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

/**
 * Переключатель § 7.13 — только для настроек, вступающих в силу немедленно.
 * Поля формы, сохраняемые кнопкой, используют Checkbox.
 */
export function Switch({ label, checked, onChange, disabled = false }: SwitchProps): ReactNode {
  return (
    <label className={styles.switch}>
      <input
        className={styles.label}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        hidden
        onChange={(event) => { onChange(event.target.checked); }}
      />
      <span className={[styles.switchTrack, checked ? styles.switchOn : ''].filter(Boolean).join(' ')}>
        <span className={styles.switchKnob} />
      </span>
      <span className={styles.checkboxLabel}>{label}</span>
    </label>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Точка цвета уровня важности слева от наименования (§ 7.8). */
  readonly severityDot?: ReactNode;
  readonly disabled?: boolean;
  /** Элемент справочника перестал действовать: из значения не удаляется (§ 7.8). */
  readonly expired?: boolean;
}

export type SelectState = 'normal' | 'loading' | 'error' | 'disabled' | 'readonly';

export interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value: readonly string[];
  readonly onChange: (value: readonly string[]) => void;
  readonly multiple?: boolean;
  readonly state?: SelectState;
  readonly placeholder?: string;
  readonly onRetry?: (() => void) | undefined;
  readonly id?: string;
}

/** Поиск появляется, когда элементов больше десяти (§ 7.7). */
const SEARCH_FROM = 10;

export function Select({
  options, value, onChange, multiple = false, state = 'normal',
  placeholder = 'Выберите значение', onRetry, id,
}: SelectProps): ReactNode {
  const fieldId = useContext(FieldIdContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = options.filter((option) => value.includes(option.value));
  const found = query === ''
    ? options
    : options.filter((option) => option.label.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));

  const pick = (option: SelectOption): void => {
    if (multiple) {
      onChange(value.includes(option.value) ? value.filter((v) => v !== option.value) : [...value, option.value]);
      return;
    }
    onChange([option.value]);
    setOpen(false);
  };

  return (
    <div className={styles.select}>
      {multiple ? (
        // Метки со снятием — сами кнопки, поэтому обёртка не может быть
        // кнопкой: вложенные органы управления запрещены.
        <div className={controlClass(state === 'disabled' ? 'disabled' : state === 'error' ? 'error' : 'normal')}>
          {chosen.length === 0 ? null : (
            <span className={styles.chips}>
              {chosen.map((option) => (
                <Tag
                  key={option.value}
                  removeLabel={`Убрать «${option.label}»`}
                  onRemove={() => { onChange(value.filter((v) => v !== option.value)); }}
                >
                  {option.expired === true ? `${option.label} (не действует)` : option.label}
                </Tag>
              ))}
            </span>
          )}
          <button
            className={styles.input}
            id={id ?? fieldId}
            type="button"
            disabled={state === 'disabled' || state === 'readonly'}
            aria-expanded={open}
            onClick={() => { setOpen(!open); }}
          >
            {chosen.length === 0 ? placeholder : 'Добавить'}
          </button>
        </div>
      ) : (
        <button
          className={controlClass(state === 'disabled' ? 'disabled' : state === 'error' ? 'error' : 'normal')}
          id={id ?? fieldId}
          type="button"
          disabled={state === 'disabled' || state === 'readonly'}
          aria-expanded={open}
          onClick={() => { setOpen(!open); }}
        >
          {chosen.length === 0
            ? <span className={styles.suffix}>{placeholder}</span>
            : <span>{chosen[0]?.expired === true ? `${chosen[0].label} (не действует)` : chosen[0]?.label}</span>}
        </button>
      )}
      {open && state === 'normal' ? (
        <ul className={styles.selectList} role="listbox">
          {options.length > SEARCH_FROM ? (
            <li>
              <TextInput value={query} onChange={setQuery} placeholder="Поиск" />
            </li>
          ) : null}
          {found.map((option) => (
            <li key={option.value}>
              <button
                className={[styles.option, value.includes(option.value) ? styles.optionCurrent : ''].filter(Boolean).join(' ')}
                type="button"
                role="option"
                aria-selected={value.includes(option.value)}
                disabled={option.disabled === true}
                onClick={() => { pick(option); }}
              >
                {option.severityDot}
                {option.expired === true ? `${option.label} (не действует)` : option.label}
              </button>
            </li>
          ))}
          {found.length === 0 ? (
            <li>
              <EmptyState kind="notFound" title="Ничего не найдено" hint="Измените условия поиска" />
            </li>
          ) : null}
        </ul>
      ) : null}
      {open && state === 'loading' ? <Spinner label="Загрузка списка" /> : null}
      {open && state === 'error'
        ? <ErrorState message="Не удалось загрузить список" onRetry={onRetry} />
        : null}
    </div>
  );
}
