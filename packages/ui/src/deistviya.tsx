import type { ReactNode } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
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
  /** Причина недоступности. Отключённая кнопка обязана её объяснять (§ 1, п. 7).
      Явное «| undefined» — передача насквозь при exactOptionalPropertyTypes. */
  readonly disabledReason?: string | undefined;
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

export interface ButtonGroupProps {
  readonly children: ReactNode;
  /** Назначение группы озвучивается вслух: это переключатель представления (§ 8.3). */
  readonly label: string;
}

/** Группа кнопок § 8.3: переключение представления — таблица, карта, обе. */
export function ButtonGroup({ children, label }: ButtonGroupProps): ReactNode {
  return <span className={styles.group} role="group" aria-label={label}>{children}</span>;
}

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Опасные действия § 8.4 уходят в конец списка и красятся цветом опасности. */
  readonly danger?: boolean;
  readonly disabled?: boolean;
  /** Причина недоступности: отключённый пункт обязан её объяснять (§ 8.4). */
  readonly disabledReason?: string;
  readonly onSelect?: () => void;
}

export interface MenuProps {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly icon?: ReactNode;
}

/**
 * Меню § 8.4. Пустое меню не отображается вовсе: кнопка, за которой нет
 * ни одного доступного действия, вводит в заблуждение.
 */
export function Menu({ label, items, icon }: MenuProps): ReactNode {
  if (items.length === 0) return null;
  const ordered = [...items.filter((i) => i.danger !== true), ...items.filter((i) => i.danger === true)];
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>
        <IconButton label={label} icon={icon ?? <MoreHorizontal size={16} aria-hidden="true" />} />
      </RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content className={styles.menuList} sideOffset={4} align="end" aria-label={label}>
          {ordered.map((item) => (
            <RadixMenu.Item
              className={[styles.menuItem, item.danger === true ? styles.menuDanger : ''].filter(Boolean).join(' ')}
              key={item.id}
              disabled={item.disabled === true}
              title={item.disabled === true ? item.disabledReason : undefined}
              onSelect={() => { item.onSelect?.(); }}
            >
              {item.icon}
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
