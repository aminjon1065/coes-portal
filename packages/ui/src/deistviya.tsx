import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import styles from './deistviya.module.css';

/** Действия — docs/07-КОМПОНЕНТЫ.md § 8. */

export type ButtonKind = 'primary' | 'normal' | 'quiet' | 'danger';
export type ButtonSize = 's' | 'm' | 'l';

export interface ButtonProps {
  readonly children: ReactNode;
  /** «вид» */
  readonly kind?: ButtonKind;
  /** «размер» */
  readonly size?: ButtonSize;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
  /** Причина недоступности. Отключённая кнопка обязана её объяснять (§ 1, п. 7). */
  readonly disabledReason?: string;
  /** «выполняется»: кнопка недоступна для повторного нажатия (§ 8.1). */
  readonly busy?: boolean;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit';
}

const SIZE = { s: styles.sizeS, m: styles.sizeM, l: styles.sizeL };

export function Button({
  children, kind = 'normal', size = 'm', icon, disabled = false,
  disabledReason, busy = false, onClick, type = 'button',
}: ButtonProps): ReactNode {
  const className = [styles.button, SIZE[size], styles[kind], busy ? styles.busy : ''].filter(Boolean).join(' ');
  return (
    <button
      className={className}
      type={type}
      disabled={disabled || busy}
      title={disabled && disabledReason !== undefined ? disabledReason : undefined}
      aria-busy={busy}
      onClick={onClick}
    >
      {busy ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps {
  /** Подпись обязательна: кнопка-значок без неё запрещена (§ 8.2). */
  readonly label: string;
  readonly icon: ReactNode;
  readonly kind?: ButtonKind;
  readonly size?: 's' | 'm';
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

export function IconButton({
  label, icon, kind = 'quiet', size = 'm', disabled = false, onClick,
}: IconButtonProps): ReactNode {
  const className = [
    styles.button, styles[kind], styles.icon, size === 's' ? styles.iconS : '',
  ].filter(Boolean).join(' ');
  return (
    <button className={className} type="button" disabled={disabled} aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  );
}
