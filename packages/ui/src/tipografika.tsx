import type { ReactNode } from 'react';
import styles from './tipografika.module.css';

/** Типографика — docs/06-ДИЗАЙН-СИСТЕМА.md § 3. */

export type TextVariant = 'caption' | 'small' | 'body' | 'bodyStrong' | 'lead';
export type TextTone = 'primary' | 'secondary' | 'disabled' | 'danger';

export interface TextProps {
  readonly children: ReactNode;
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  /** Моноширинные цифры: обязательны в таблицах, плитках и полях чисел (§ 3.3). */
  readonly numeric?: boolean;
  /** Ограничение ширины текстового блока девяноста знаками (§ 3.4). */
  readonly measure?: boolean;
}

export function Text({
  children, variant = 'body', tone = 'primary', numeric = false, measure = false,
}: TextProps): ReactNode {
  const className = [
    styles.base, styles[variant], styles[tone],
    numeric ? styles.numeric : '', measure ? styles.measure : '',
  ].filter(Boolean).join(' ');
  return <p className={className}>{children}</p>;
}

export interface HeadingProps {
  readonly children: ReactNode;
  readonly level: 1 | 2 | 3 | 4;
}

export function Heading({ children, level }: HeadingProps): ReactNode {
  const className = [styles.base, styles[`h${level}`], styles.primary].join(' ');
  if (level === 1) return <h1 className={className}>{children}</h1>;
  if (level === 2) return <h2 className={className}>{children}</h2>;
  if (level === 3) return <h3 className={className}>{children}</h3>;
  return <h4 className={className}>{children}</h4>;
}
