import { Fragment } from 'react';
import { ArrowDown, ArrowUp, Lock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import styles from './dannye.module.css';
import { DASH, formatDateTimeSeconds, formatInteger } from './formaty.ts';
import { Skeleton } from './sostoyaniya.tsx';

/** Отображение данных — docs/07-КОМПОНЕНТЫ.md § 6. */

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface TagProps {
  readonly children: ReactNode;
  readonly tone?: TagTone;
  /** Крестик для снятия условия отбора (§ 6.6). */
  readonly onRemove?: (() => void) | undefined;
  /** Что именно снимает крестик: «Снять условие» без предмета бесполезно. */
  readonly removeLabel?: string;
}

const TAG = {
  neutral: styles.tagNeutral, primary: styles.tagPrimary, success: styles.tagSuccess,
  warning: styles.tagWarning, danger: styles.tagDanger,
};

export function Tag({ children, tone = 'neutral', onRemove, removeLabel }: TagProps): ReactNode {
  return (
    <span className={[styles.tag, TAG[tone]].join(' ')}>
      {children}
      {onRemove === undefined ? null : (
        <button className={styles.tagRemove} type="button" aria-label={removeLabel ?? 'Снять'} onClick={onRemove}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/**
 * Состояние объекта жизненного цикла. Соответствие цветов задано здесь,
 * а не на экране (§ 6.7): иначе одно и то же состояние выглядело бы
 * по-разному в разных реестрах.
 */
export type LifecycleStatus =
  | 'draft' | 'registered' | 'clarifying' | 'closed' | 'cancelled'
  | 'onApproval' | 'approved' | 'rejected' | 'toDestroy' | 'destroyed' | 'permanent';

const STATUS: Readonly<Record<LifecycleStatus, { readonly label: string; readonly struck?: true }>> = {
  draft: { label: 'Черновик' },
  registered: { label: 'Зарегистрировано' },
  clarifying: { label: 'Уточняется' },
  closed: { label: 'Закрыто' },
  cancelled: { label: 'Аннулировано', struck: true },
  onApproval: { label: 'На согласовании' },
  approved: { label: 'Утверждено' },
  rejected: { label: 'Отклонено' },
  toDestroy: { label: 'К уничтожению' },
  destroyed: { label: 'Уничтожено' },
  permanent: { label: 'Постоянное хранение' },
};

export interface StatusBadgeProps {
  readonly status: LifecycleStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): ReactNode {
  const { label, struck } = STATUS[status];
  return (
    <span className={[styles.status, struck === true ? styles.struck : ''].filter(Boolean).join(' ')}>
      <span className={styles.dot} data-status={status} aria-hidden="true" />
      {label}
    </span>
  );
}

export type SeverityToken = 'sev-1' | 'sev-2' | 'sev-3' | 'sev-4' | 'sev-5';

export interface SeverityBadgeProps {
  readonly level: SeverityToken;
  /** Наименование уровня выводится словами обязательно: цвет не может быть
      единственным носителем смысла (§ 6.8, § 2.4). */
  readonly label: string;
}

export function SeverityBadge({ level, label }: SeverityBadgeProps): ReactNode {
  return <span className={styles.severity} data-level={level}>{label}</span>;
}

export interface CounterProps {
  readonly value: number;
}

/** Ноль не отображается вовсе, более 99 — как «99+» (§ 6.10). */
export function Counter({ value }: CounterProps): ReactNode {
  if (value <= 0) return null;
  return <span className={styles.counter}>{value > 99 ? '99+' : String(value)}</span>;
}

export interface DescriptionItem {
  readonly term: string;
  readonly value?: ReactNode;
  /** Значение скрыто по правам: об этом говорится прямо (§ 6.2). */
  readonly hidden?: boolean;
  readonly loading?: boolean;
}

/** Список описаний § 6.2: пары «подпись — значение» в карточке объекта. */
export function DescriptionList({ items }: { readonly items: readonly DescriptionItem[] }): ReactNode {
  return (
    <dl className={styles.dl}>
      {items.map((item) => (
        <Fragment key={item.term}>
          <dt className={styles.dt}>{item.term}</dt>
          <dd className={styles.dd}>
            {item.loading === true ? <Skeleton width="short" /> : null}
            {item.loading !== true && item.hidden === true ? (
              <span className={styles.ddHidden}>
                <Lock size={16} aria-hidden="true" />
                Нет доступа
              </span>
            ) : null}
            {item.loading !== true && item.hidden !== true
              ? (item.value === undefined || item.value === null || item.value === '' ? DASH : item.value)
              : null}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export interface MetricTileProps {
  /** «подпись» */
  readonly caption: string;
  /** «значение». Отсутствие числа — знак тире, а не пустое место. */
  readonly value?: number;
  /** «единица» */
  readonly unit?: string;
  /** «изменение» относительно прошлого периода. */
  readonly change?: number;
  /**
   * Куда считать изменение хорошим. Указывается явно и всегда: рост числа
   * погибших не успех, и сам по себе зелёным быть не должен (§ 6.3).
   */
  readonly goodDirection?: 'up' | 'down' | 'none';
  /** «переход» — адрес реестра с применёнными условиями отбора. */
  readonly href?: string;
  readonly loading?: boolean;
}

export function MetricTile({
  caption, value, unit, change, goodDirection = 'none', href, loading = false,
}: MetricTileProps): ReactNode {
  const rising = change !== undefined && change > 0;
  const tone = goodDirection === 'none' || change === undefined || change === 0
    ? ''
    : ((rising && goodDirection === 'up') || (!rising && goodDirection === 'down') ? styles.metricGood : styles.metricBad);
  const body = (
    <>
      <span className={styles.metricCaption}>{caption}</span>
      <span className={styles.metricValue}>
        {loading ? <Skeleton width="short" /> : formatInteger(value)}
        {unit === undefined ? null : <span className={styles.metricUnit}>{unit}</span>}
      </span>
      {change === undefined ? null : (
        <span className={[styles.metricChange, tone].filter(Boolean).join(' ')}>
          {rising ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
          {formatInteger(Math.abs(change))}
        </span>
      )}
    </>
  );
  return href === undefined
    ? <div className={styles.metric}>{body}</div>
    : <a className={[styles.metric, styles.metricLink].join(' ')} href={href}>{body}</a>;
}

export interface AvatarProps {
  readonly name: string;
  readonly size?: 's' | 'm' | 'l';
  /** Изображение. При его отсутствии выводятся инициалы (§ 6.9). */
  readonly src?: string;
}

/** Аватар § 6.9. Фон один для всех: случайная раскраска людей запрещена. */
export function Avatar({ name, size = 'm', src }: AvatarProps): ReactNode {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  const sized = size === 's' ? styles.avatarS : size === 'l' ? styles.avatarL : styles.avatarM;
  return (
    <RadixAvatar.Root className={[styles.avatar, sized].join(' ')} title={name}>
      {src === undefined ? null : <RadixAvatar.Image className={styles.avatarImage} src={src} alt={name} />}
      <RadixAvatar.Fallback className={styles.avatarFallback} aria-label={name}>{initials}</RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

export interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly who: string;
  readonly post: string;
  readonly action: string;
  /** «Погибло: 2 → 3». Для персональных данных без разрешения уровня 2 —
      только сообщение об изменении, без значений (§ 6.11). */
  readonly change?: string;
  /** «(замещает <должность>, приказ №<номер>)» */
  readonly substitution?: string;
}

/** Лента журнала § 6.11. Время — с секундами: журнал того требует (06 § 8). */
export function AuditFeed({ entries }: { readonly entries: readonly AuditEntry[] }): ReactNode {
  return (
    <div className={styles.feed}>
      {entries.map((entry) => (
        <div className={styles.feedRow} key={entry.id}>
          <span className={styles.feedWhen}>{formatDateTimeSeconds(entry.at)}</span>
          <span className={styles.feedWho}>
            {`${entry.who}, ${entry.post}`}
            {entry.substitution === undefined ? '' : ` (${entry.substitution})`}
          </span>
          <span className={styles.feedWhat}>
            {entry.action}
            {entry.change === undefined ? '' : `. ${entry.change}`}
          </span>
        </div>
      ))}
    </div>
  );
}
