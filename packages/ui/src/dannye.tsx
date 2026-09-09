import type { ReactNode } from 'react';
import styles from './dannye.module.css';

/** Отображение данных — docs/07-КОМПОНЕНТЫ.md § 6. */

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface TagProps {
  readonly children: ReactNode;
  readonly tone?: TagTone;
}

const TAG = {
  neutral: styles.tagNeutral, primary: styles.tagPrimary, success: styles.tagSuccess,
  warning: styles.tagWarning, danger: styles.tagDanger,
};

export function Tag({ children, tone = 'neutral' }: TagProps): ReactNode {
  return <span className={[styles.tag, TAG[tone]].join(' ')}>{children}</span>;
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
