import { ChevronRight, Loader2, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import styles from './navigatsiya.module.css';
import { Counter } from './dannye.tsx';
import { Button } from './deistviya.tsx';

/** Навигация — docs/07-КОМПОНЕНТЫ.md § 5. */

export interface NavSection {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly href: string;
  /** Счётчик непрочитанного справа (§ 5.1). */
  readonly counter?: number;
}

export interface SideNavProps {
  /** «разделы». Недоступные по правам сюда не попадают вовсе (§ 5.1). */
  readonly sections: readonly NavSection[];
  /** «свёрнуто» */
  readonly collapsed?: boolean;
  readonly currentId?: string;
  readonly label?: string;
}

export function SideNav({ sections, collapsed = false, currentId, label = 'Разделы' }: SideNavProps): ReactNode {
  const className = [styles.sidenav, collapsed ? styles.sidenavCollapsed : ''].filter(Boolean).join(' ');
  return (
    <nav className={className} aria-label={label}>
      {sections.map((section) => (
        <a
          key={section.id}
          className={[styles.navItem, section.id === currentId ? styles.navCurrent : ''].filter(Boolean).join(' ')}
          href={section.href}
          aria-current={section.id === currentId ? 'page' : undefined}
          aria-label={collapsed ? section.label : undefined}
          title={collapsed ? section.label : undefined}
        >
          {section.icon}
          {collapsed ? null : <span className={styles.navLabel}>{section.label}</span>}
          {collapsed ? null : <Counter value={section.counter ?? 0} />}
        </a>
      ))}
    </nav>
  );
}

export type ConnectionState = 'connected' | 'retrying' | 'lost';

export interface ConnectionIndicatorProps {
  /** «состояние» */
  readonly state: ConnectionState;
  readonly onReload?: () => void;
}

/**
 * Индикатор соединения § 5.2.1. Исправное состояние не занимает места
 * в шапке. Отсутствие соединения работу не блокирует: индикатор сообщает
 * лишь о том, что чужие изменения сами не приходят.
 */
export function ConnectionIndicator({ state, onReload }: ConnectionIndicatorProps): ReactNode {
  if (state === 'connected') return null;
  if (state === 'retrying') {
    return (
      <span className={[styles.connection, styles.connectionRetrying].join(' ')} role="status">
        <Loader2 className={styles.connectionSpin} size={16} aria-hidden="true" />
        Восстанавливаю соединение
      </span>
    );
  }
  return (
    <span className={[styles.connection, styles.connectionLost].join(' ')} role="status">
      <WifiOff size={16} aria-hidden="true" />
      Нет связи с сервером
      <Button kind="quiet" size="s" onClick={() => { onReload?.(); }}>Обновить страницу</Button>
    </span>
  );
}

export interface PostContext {
  readonly post: string;
  readonly unit: string;
  /** Строка «Замещает: <должность>, приказ №<номер>» (§ 5.2). */
  readonly substitutingFor?: string;
  readonly orderNumber?: string;
}

export interface TopBarProps {
  readonly title: string;
  /** Назначения пользователя. Если одно — переключать нечего (§ 5.2). */
  readonly contexts: readonly PostContext[];
  readonly currentIndex?: number;
  readonly connection?: ConnectionState;
  readonly search?: ReactNode;
  readonly notifications?: ReactNode;
  readonly profile?: ReactNode;
  readonly collapseButton?: ReactNode;
  readonly onSwitchPost?: () => void;
}

export function TopBar({
  title, contexts, currentIndex = 0, connection = 'connected',
  search, notifications, profile, collapseButton, onSwitchPost,
}: TopBarProps): ReactNode {
  const current = contexts[currentIndex];
  const switchable = contexts.length > 1;
  return (
    <header className={styles.topbar}>
      {collapseButton}
      <span className={styles.topbarTitle}>{title}</span>
      {search === undefined ? null : <span className={styles.topbarSearch}>{search}</span>}
      <span className={styles.topbarSpacer} />
      {current === undefined ? null : (
        <button
          className={[styles.postSwitch, switchable ? '' : styles.postSwitchStatic].filter(Boolean).join(' ')}
          type="button"
          disabled={!switchable}
          onClick={() => { onSwitchPost?.(); }}
        >
          <span>{current.post}</span>
          <span>{current.unit}</span>
          {current.substitutingFor === undefined ? null : (
            <span>{`Замещает: ${current.substitutingFor}, приказ №${current.orderNumber ?? '—'}`}</span>
          )}
        </button>
      )}
      <ConnectionIndicator state={connection} />
      {notifications}
      {profile}
    </header>
  );
}

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/** Хлебные крошки § 5.3. Последний элемент ссылкой не является. */
export function Breadcrumbs({ crumbs }: { readonly crumbs: readonly Crumb[] }): ReactNode {
  return (
    <nav className={styles.breadcrumbs} aria-label="Путь">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={crumb.label}>
            {index === 0 ? null : <ChevronRight size={16} aria-hidden="true" />}
            {last || crumb.href === undefined
              ? <span className={styles.crumbLast} aria-current={last ? 'page' : undefined}>{crumb.label}</span>
              : <a className={styles.crumbLink} href={crumb.href}>{crumb.label}</a>}
          </span>
        );
      })}
    </nav>
  );
}

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly counter?: number;
  readonly disabled?: boolean;
  /** Причина недоступности обязательна: вкладка без объяснения — тупик (§ 5.4). */
  readonly disabledReason?: string;
  /** Содержимое вкладки. Область обязана существовать, даже пустая: на неё
      ссылается aria-controls самой вкладки. */
  readonly content?: ReactNode;
}

export interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly currentId: string;
  readonly label?: string;
  readonly onSelect?: (id: string) => void;
}

/**
 * Вкладки § 5.4 на примитиве Radix (§ 4 стека): он ведёт перемещение
 * стрелками, связывает вкладку с её содержимым и удерживает role="tab"
 * прямым потомком role="tablist".
 */
export function Tabs({ tabs, currentId, label = 'Вкладки', onSelect }: TabsProps): ReactNode {
  return (
    <RadixTabs.Root value={currentId} onValueChange={(next) => { onSelect?.(next); }}>
      <RadixTabs.List className={styles.tabs} aria-label={label}>
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            className={styles.tab}
            key={tab.id}
            value={tab.id}
            // Недоступная вкладка остаётся в порядке обхода: иначе причину
            // недоступности нельзя прочитать с клавиатуры (§ 5.4).
            aria-disabled={tab.disabled === true}
            title={tab.disabled === true ? tab.disabledReason : undefined}
            onClick={(event) => { if (tab.disabled === true) event.preventDefault(); }}
          >
            {tab.label}
            <Counter value={tab.counter ?? 0} />
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content className={styles.tabPanel} key={tab.id} value={tab.id}>
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

export const PAGE_SIZES = [25, 50, 100, 200] as const;

export interface PaginationProps {
  readonly from: number;
  readonly to: number;
  /** Неизвестное общее число — допустимое состояние (§ 5.5). */
  readonly total?: number;
  readonly pageSize: number;
  readonly busy?: boolean;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly onPageSize?: (size: number) => void;
}

/** Более десяти тысяч показывается словами: точное число там не нужно (§ 5.5). */
function totalText(total: number | undefined): string {
  if (total === undefined) return 'из неизвестного числа';
  return total > 10000 ? 'из более 10 000' : `из ${total.toLocaleString('ru-RU')}`;
}

export function Pagination({
  from, to, total, pageSize, busy = false, onPrev, onNext, onPageSize,
}: PaginationProps): ReactNode {
  const last = total !== undefined && to >= total;
  return (
    <div className={styles.pagination}>
      <span className={styles.paginationCount}>{`Показано ${from}–${to} ${totalText(total)}`}</span>
      <label>
        {'По '}
        <select
          value={pageSize}
          disabled={busy}
          onChange={(event) => { onPageSize?.(Number(event.target.value)); }}
        >
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <Button kind="normal" size="s" disabled={busy || from <= 1} onClick={() => { onPrev?.(); }}>Назад</Button>
      <Button kind="normal" size="s" disabled={busy || last} onClick={() => { onNext?.(); }}>Далее</Button>
    </div>
  );
}
