import type { ReactNode } from 'react';
import styles from './raskladka.module.css';

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
  return <hr className={direction === 'vertical' ? styles.dividerV : styles.dividerH} />;
}
