import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, Lock, SearchX, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import styles from './sostoyaniya.module.css';
import { Text, Heading } from './tipografika.tsx';
import { Stack } from './raskladka.tsx';
import { Button } from './deistviya.tsx';

/**
 * Обратная связь — docs/07-КОМПОНЕНТЫ.md § 9.
 * Область данных обязана иметь все состояния из docs/06 § 10: область,
 * для которой не описано поведение при ошибке, будет сделана без него.
 */

export interface SkeletonProps {
  /** «ширина» — только из набора: скелет повторяет структуру содержимого,
      а не произвольный прямоугольник (§ 9.1). */
  readonly width?: 'full' | 'short';
}

/** Скелет повторяет структуру будущего содержимого; прямоугольник во весь
    экран запрещён (§ 9.1). Появляется после 300 мс ожидания. */
export function Skeleton({ width = 'full' }: SkeletonProps): ReactNode {
  const size = width === 'short' ? styles.skeletonShort : styles.skeletonFull;
  return <div className={[styles.skeleton, size].join(' ')} aria-hidden="true" />;
}

export interface SpinnerProps {
  readonly size?: 16 | 24 | 32;
  readonly label?: string;
}

export function Spinner({ size = 24, label = 'Загрузка' }: SpinnerProps): ReactNode {
  return <Loader2 size={size} className={styles.spin} role="status" aria-label={label} />;
}

export interface EmptyStateProps {
  /** «вид»: «пусто» и «ничего не найдено» не взаимозаменяемы (§ 9.3). */
  readonly kind: 'empty' | 'notFound';
  readonly title: string;
  readonly hint: string;
  readonly action?: ReactNode;
}

export function EmptyState({ kind, title, hint, action }: EmptyStateProps): ReactNode {
  const Icon = kind === 'empty' ? Inbox : SearchX;
  return (
    <div className={styles.state}>
      <Icon size={32} className={styles.stateIconMuted} aria-hidden="true" />
      <Heading level={4}>{title}</Heading>
      <Text variant="lead" tone="secondary">{hint}</Text>
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  /** Текст из ответа сервера. Технические подробности не показываются. */
  readonly message: string;
  readonly requestId?: string;
  readonly onRetry?: () => void;
}

/**
 * Когда ответа сервера нет вовсе, текст задан дословно (§ 9.4) и
 * изобретению не подлежит.
 */
export const NETWORK_ERROR = {
  title: 'Не удалось связаться с сервером',
  hint: 'Проверьте подключение к сети и повторите. Если это повторяется, обратитесь к системному администратору.',
} as const;

export function ErrorState({ message, requestId, onRetry }: ErrorStateProps): ReactNode {
  return (
    <div className={styles.state}>
      <AlertCircle size={32} className={styles.stateIconDanger} aria-hidden="true" />
      <Heading level={4}>Ошибка</Heading>
      <Text variant="body" measure>{message}</Text>
      {requestId !== undefined && <Text variant="small" tone="secondary">Номер запроса: {requestId}</Text>}
      {onRetry !== undefined && <Button onClick={onRetry}>Повторить</Button>}
    </div>
  );
}

export interface NoAccessStateProps {
  readonly message?: string;
}

/** Кнопки «Повторить» здесь нет: повтор ничего не изменит (§ 9.5). */
export function NoAccessState({
  message = 'Этот объект существует, но не входит в вашу область видимости. ' +
    'Если доступ необходим для работы, обратитесь к администратору региона.',
}: NoAccessStateProps): ReactNode {
  return (
    <div className={styles.state}>
      <Lock size={32} className={styles.stateIconLock} aria-hidden="true" />
      <Heading level={4}>Нет доступа</Heading>
      <Text variant="body" measure>{message}</Text>
    </div>
  );
}

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

export interface BannerProps {
  readonly tone: BannerTone;
  readonly title?: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

const BANNER = {
  info: { style: styles.bannerInfo, Icon: Info },
  warning: { style: styles.bannerWarning, Icon: AlertTriangle },
  danger: { style: styles.bannerDanger, Icon: AlertCircle },
  success: { style: styles.bannerSuccess, Icon: CheckCircle2 },
};

export function Banner({ tone, title, children, action }: BannerProps): ReactNode {
  const { style, Icon } = BANNER[tone];
  return (
    <div className={[styles.banner, style].join(' ')} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden="true" />
      <Stack gap="sp-1">
        {title !== undefined && <Text variant="bodyStrong">{title}</Text>}
        <div className={styles.bannerBody}>{children}</div>
        {action}
      </Stack>
    </div>
  );
}

/**
 * Предупреждение о недопустимости сведений ограниченного доступа (§ 9.12).
 * Текст задан дословно и изменению без записи о решении не подлежит (Д-18).
 */
export function RestrictedNotice(): ReactNode {
  return (
    <Banner tone="warning">
      Не вводите сведения, составляющие государственную тайну. Система для них не предназначена.
    </Banner>
  );
}
