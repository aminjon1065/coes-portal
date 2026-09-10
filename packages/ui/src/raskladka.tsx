import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as RadixSeparator from '@radix-ui/react-separator';
import styles from './raskladka.module.css';
import { Button, Menu } from './deistviya.tsx';
import type { MenuItem } from './deistviya.tsx';

/**
 * Раскладка — docs/07-КОМПОНЕНТЫ.md § 4.
 * Имена компонентов латиницей, в документе — по-русски (§ 1).
 */

export type Space =
  | 'sp-05' | 'sp-1' | 'sp-2' | 'sp-3' | 'sp-4'
  | 'sp-5' | 'sp-6' | 'sp-8' | 'sp-10' | 'sp-12' | 'sp-16';

export interface StackProps {
  readonly children: ReactNode;
  /** «направление» */
  readonly direction?: 'vertical' | 'horizontal';
  /** «отступ» — только токен шкалы: произвольное число передать нельзя (§ 4.1) */
  readonly gap?: Space;
  /** «выравнивание» */
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
  /** «распределение» */
  readonly justify?: 'start' | 'center' | 'end' | 'between';
  /** «переносить» */
  readonly wrap?: boolean;
}

const GAP: Readonly<Record<Space, string | undefined>> = {
  'sp-05': styles.gapSp05, 'sp-1': styles.gapSp1, 'sp-2': styles.gapSp2, 'sp-3': styles.gapSp3,
  'sp-4': styles.gapSp4, 'sp-5': styles.gapSp5, 'sp-6': styles.gapSp6, 'sp-8': styles.gapSp8,
  'sp-10': styles.gapSp10, 'sp-12': styles.gapSp12, 'sp-16': styles.gapSp16,
};
const ALIGN = { start: styles.alignStart, center: styles.alignCenter, end: styles.alignEnd, stretch: styles.alignStretch };
const JUSTIFY = { start: styles.justifyStart, center: styles.justifyCenter, end: styles.justifyEnd, between: styles.justifyBetween };

export function Stack({
  children, direction = 'vertical', gap = 'sp-4', align = 'stretch', justify = 'start', wrap = false,
}: StackProps): ReactNode {
  const className = [
    styles.stack,
    direction === 'vertical' ? styles.vertical : styles.horizontal,
    GAP[gap], ALIGN[align], JUSTIFY[justify], wrap ? styles.wrap : '',
  ].filter(Boolean).join(' ');
  return <div className={className}>{children}</div>;
}

export interface GridProps {
  readonly children: ReactNode;
  /** «колонок» — сетка на 12 колонок (§ 4.2) */
  readonly columns?: 1 | 2 | 3 | 4 | 6 | 12;
}

const COLUMNS: Readonly<Record<GridProps['columns'] & number, string | undefined>> = {
  1: styles.cols1, 2: styles.cols2, 3: styles.cols3, 4: styles.cols4, 6: styles.cols6, 12: styles.cols12,
};

export function Grid({ children, columns = 12 }: GridProps): ReactNode {
  return <div className={[styles.grid, COLUMNS[columns]].filter(Boolean).join(' ')}>{children}</div>;
}

export interface PanelProps {
  readonly children: ReactNode;
  /** «заголовок» */
  readonly title?: ReactNode;
  /** «действия» */
  readonly actions?: ReactNode;
  /** «отступ» */
  readonly padding?: 'none' | 'tight' | 'normal';
}

export function Panel({ children, title, actions, padding = 'normal' }: PanelProps): ReactNode {
  const body =
    padding === 'none' ? styles.panelBodyNone : padding === 'tight' ? styles.panelBodyTight : styles.panelBody;
  return (
    <div className={styles.panel}>
      {(title !== undefined || actions !== undefined) && (
        <div className={styles.panelHeader}>
          <div>{title}</div>
          <div>{actions}</div>
        </div>
      )}
      <div className={body}>{children}</div>
    </div>
  );
}

export interface SectionProps {
  readonly children: ReactNode;
  readonly title: ReactNode;
}

export function Section({ children, title }: SectionProps): ReactNode {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

export interface DividerProps {
  readonly direction?: 'horizontal' | 'vertical';
}

export function Divider({ direction = 'horizontal' }: DividerProps): ReactNode {
  return (
    <RadixSeparator.Root
      className={direction === 'vertical' ? styles.dividerV : styles.dividerH}
      orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
    />
  );
}

export interface ToolbarProps {
  /** Поля и постоянно видимые элементы полосы. */
  readonly children?: ReactNode;
  /** Действия. Не поместившиеся уходят в меню more-horizontal (§ 4.6). */
  readonly actions?: readonly MenuItem[];
  readonly overflowLabel?: string;
}

/** Ширина кнопки меню плюс промежуток до неё: место под неё резервируется
    заранее, иначе последнее действие окажется обрезанным. */
const MENU_RESERVE = 42;

/**
 * Полоса действий § 4.6. Сколько кнопок поместилось — считается по
 * измеренной ширине, а не задаётся вызывающим: иначе на узком экране
 * действия просто обрезались бы.
 */
export function Toolbar({ children, actions = [], overflowLabel = 'Ещё действия' }: ToolbarProps): ReactNode {
  const row = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLSpanElement>(null);
  // Естественные ширины снимаются на первом проходе, пока видны все кнопки:
  // у скрытой ширина равна нулю и второй замер испортил бы расчёт.
  const widths = useRef<readonly number[]>([]);
  const [visible, setVisible] = useState(actions.length);

  useLayoutEffect(() => {
    const node = row.current;
    if (node === null) return undefined;
    const gap = Number.parseFloat(window.getComputedStyle(node).columnGap) || 0;

    const measure = (): void => {
      const items = [...node.querySelectorAll(`.${styles.toolbarItem ?? ''}`)];
      if (widths.current.length !== actions.length) {
        widths.current = items.map((item) => (item as HTMLElement).offsetWidth);
      }
      const leadWidth = lead.current === null ? 0 : lead.current.offsetWidth;
      const available = node.clientWidth - leadWidth - (leadWidth > 0 ? gap : 0);

      let used = 0;
      let fit = 0;
      for (const width of widths.current) {
        const next = used + width + (fit > 0 ? gap : 0);
        if (next > available) break;
        used = next;
        fit += 1;
      }
      if (fit === actions.length) { setVisible(fit); return; }

      // Часть действий уйдёт в меню — значит место под его кнопку нужно
      // освободить, и, возможно, за счёт ещё одного действия.
      while (fit > 0 && used + gap + MENU_RESERVE > available) {
        const width = widths.current[fit - 1] ?? 0;
        used -= width + (fit > 1 ? gap : 0);
        fit -= 1;
      }
      setVisible(fit);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, [actions.length]);

  const hidden = actions.slice(visible);
  return (
    <div className={styles.toolbar} ref={row}>
      {children === undefined ? null : <span className={styles.toolbarLead} ref={lead}>{children}</span>}
      {actions.map((action, index) => (
        <span
          key={action.id}
          className={[styles.toolbarItem, index < visible ? '' : styles.toolbarHidden].filter(Boolean).join(' ')}
        >
          <Button kind="quiet" size="s" icon={action.icon} disabled={action.disabled === true} onClick={() => { action.onSelect?.(); }}>
            {action.label}
          </Button>
        </span>
      ))}
      <Menu label={overflowLabel} items={hidden} />
    </div>
  );
}
