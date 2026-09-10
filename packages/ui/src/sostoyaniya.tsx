import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, Lock, SearchX, Info, CheckCircle2, AlertTriangle, X, MonitorX } from 'lucide-react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import * as RadixDialog from '@radix-ui/react-dialog';
import styles from './sostoyaniya.module.css';
import { Text, Heading } from './tipografika.tsx';
import { Stack } from './raskladka.tsx';
import { formatFileSize } from './formaty.ts';
import { Button, IconButton } from './deistviya.tsx';

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
  // Явное «| undefined» нужно при exactOptionalPropertyTypes: эти свойства
  // передаются насквозь из компонентов, которые сами их получают как
  // необязательные (например из таблицы § 6.1).
  readonly requestId?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
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

export interface TooltipProps {
  readonly children: ReactNode;
  /** Текст подсказки. Интерактивных элементов не содержит (§ 9.10). */
  readonly text: string;
}

/** Задержка появления подсказки — 400 мс (§ 9.10). */
export const TOOLTIP_DELAY_MS = 400;

/**
 * Подсказка § 9.10 на примитиве Radix (§ 4 стека): он сам открывает
 * подсказку по наведению и по фокусу с клавиатуры, закрывает по Esc и
 * связывает её с элементом через aria-describedby.
 */
export function Tooltip({ children, text }: TooltipProps): ReactNode {
  return (
    <RadixTooltip.Provider delayDuration={TOOLTIP_DELAY_MS}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span className={styles.tooltipWrap}>{children}</span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.tooltip} sideOffset={4}>
            {text}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

export interface ToastMessage {
  readonly id: string;
  readonly text: string;
  readonly tone?: 'success' | 'info';
}

/** Одновременно не более трёх: более старые вытесняются (§ 9.7). */
export const TOAST_LIMIT = 3;

/** Живёт пять секунд (§ 9.7). */
export const TOAST_LIFETIME_MS = 5000;

export interface ToastsProps {
  readonly messages: readonly ToastMessage[];
  readonly onClose: (id: string) => void;
}

/**
 * Всплывающие сообщения § 9.7. Только подтверждение выполненного действия
 * и сведения, не требующие реакции: ошибка, требующая действия
 * пользователя, показывается на месте, рядом с причиной (06 § 13 п. 17).
 */
export function Toasts({ messages, onClose }: ToastsProps): ReactNode {
  const shown = messages.slice(-TOAST_LIMIT);
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {shown.map((message) => (
        <div
          className={[styles.toast, message.tone === 'success' ? styles.toastSuccess : ''].filter(Boolean).join(' ')}
          key={message.id}
        >
          {message.tone === 'success'
            ? <CheckCircle2 size={16} className={styles.stateIconSuccess} aria-hidden="true" />
            : <Info size={16} className={styles.stateIconInfo} aria-hidden="true" />}
          <Text variant="body">{message.text}</Text>
          <Button kind="quiet" size="s" onClick={() => { onClose(message.id); }}>Закрыть</Button>
        </div>
      ))}
    </div>
  );
}

export type DialogWidth = 400 | 560 | 720 | 960;

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: DialogWidth;
  /** Диалог с несохранёнными данными не закрывается нажатием на подложку. */
  readonly dirty?: boolean;
  /** Ошибка внутри диалога: баннер сверху, диалог не закрывается (§ 9.8). */
  readonly error?: string;
  readonly onClose: () => void;
}

const DIALOG_WIDTH: Readonly<Record<DialogWidth, string | undefined>> = {
  400: styles.dialogS, 560: styles.dialogM, 720: styles.dialogL, 960: styles.dialogXL,
};

/**
 * Диалог § 9.8 на примитиве Radix (§ 4 стека). Примитив захватывает фокус,
 * закрывает по Esc, возвращает фокус вызвавшему элементу и держит одно
 * модальное окно: диалог поверх диалога получается невозможным по
 * устройству, а не по договорённости (06 § 13 п. 14).
 */
export function Dialog({
  open, title, children, footer, width = 560, dirty = false, error, onClose,
}: DialogProps): ReactNode {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={[styles.dialog, DIALOG_WIDTH[width]].filter(Boolean).join(' ')}
          // Диалог с несохранёнными данными не закрывается нажатием на
          // подложку: потерять набранное молча недопустимо (§ 9.8).
          onPointerDownOutside={(event) => { if (dirty) event.preventDefault(); }}
        >
          <div className={styles.dialogHead}>
            <RadixDialog.Title asChild><Heading level={3}>{title}</Heading></RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label="Закрыть" icon={<X size={16} aria-hidden="true" />} />
            </RadixDialog.Close>
          </div>
          <div className={styles.dialogBody}>
            {error === undefined ? null : <Banner tone="danger" title="Ошибка">{error}</Banner>}
            {children}
          </div>
          {footer === undefined ? null : <div className={styles.dialogFoot}>{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export interface ConfirmDialogProps {
  readonly open: boolean;
  /** Заголовок — вопрос: «Аннулировать событие 2026-DUS-0017?» */
  readonly title: string;
  /** Текст — последствия: «Событие будет исключено из всех показателей». */
  readonly consequences: string;
  /** Подтверждающее слово для необратимых действий: пользователь набирает
      регистрационный номер объекта (§ 9.9). */
  readonly confirmWord?: string;
  readonly actionLabel: string;
  readonly reason?: ReactNode;
  readonly typed?: string;
  readonly onTyped?: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function ConfirmDialog({
  open, title, consequences, confirmWord, actionLabel, reason, typed = '', onTyped, onConfirm, onClose,
}: ConfirmDialogProps): ReactNode {
  const ready = confirmWord === undefined || typed === confirmWord;
  return (
    <Dialog
      open={open}
      title={title}
      width={400}
      onClose={onClose}
      footer={(
        <>
          <Button kind="normal" onClick={onClose}>Отмена</Button>
          <Button
            kind="danger"
            disabled={!ready}
            disabledReason={ready ? undefined : `Наберите ${confirmWord ?? ''} для подтверждения`}
            onClick={onConfirm}
          >
            {actionLabel}
          </Button>
        </>
      )}
    >
      <Stack gap="sp-3">
        <Text variant="body" measure>{consequences}</Text>
        {reason}
        {confirmWord === undefined ? null : (
          <Text variant="small" tone="secondary">
            {`Для подтверждения наберите ${confirmWord}`}
          </Text>
        )}
        {confirmWord === undefined ? null : (
          <input
            className={styles.confirmWord}
            type="text"
            value={typed}
            aria-label={`Подтверждение: ${confirmWord}`}
            onChange={(event) => { onTyped?.(event.target.value); }}
          />
        )}
      </Stack>
    </Dialog>
  );
}

export interface DiskSpaceIndicatorProps {
  readonly freeBytes: number;
  readonly totalBytes: number;
}

/** Свободное место § 9.11. Порог: выше 20 % обычный, 10–20 % предупреждение. */
export function DiskSpaceIndicator({ freeBytes, totalBytes }: DiskSpaceIndicatorProps): ReactNode {
  const share = totalBytes <= 0 ? 0 : freeBytes / totalBytes;
  const tone = share < 0.1 ? styles.diskDanger : (share < 0.2 ? styles.diskWarn : '');
  return (
    <div className={styles.disk}>
      <span className={styles.diskText}>
        {`Свободно ${formatFileSize(freeBytes)} из ${formatFileSize(totalBytes)}`}
      </span>
      <span className={styles.diskBar}>
        <span className={[styles.diskFill, tone].filter(Boolean).join(' ')} ref={(el) => {
          // Доля занятого — величина данных, а не дизайн-системы, поэтому
          // ширина выставляется после раскладки, а не атрибутом style.
          if (el !== null) el.style.setProperty('width', `${String(Math.round(share * 100))}%`);
        }} />
      </span>
    </div>
  );
}

/** Поддерживаемые браузеры — допущение Д-09. */
export const SUPPORTED_BROWSERS = 'Chrome 120 и выше, Edge 120 и выше, Firefox 120 и выше';

export interface UnsupportedBrowserProps {
  readonly detected: string;
}

/**
 * Экран несовместимости § 9.13. Показывается вместо приложения: обломки
 * интерфейса пользователю не показываются.
 */
export function UnsupportedBrowser({ detected }: UnsupportedBrowserProps): ReactNode {
  return (
    <div className={styles.unsupported}>
      <MonitorX size={32} className={styles.stateIconDanger} aria-hidden="true" />
      <Heading level={2}>Браузер не поддерживается</Heading>
      <Text variant="body" measure>{`Обнаружен: ${detected}`}</Text>
      <Text variant="body" measure>{`Поддерживаются: ${SUPPORTED_BROWSERS}`}</Text>
      <Text variant="body" measure>
        Обратитесь к системному администратору, чтобы обновить браузер.
      </Text>
    </div>
  );
}
