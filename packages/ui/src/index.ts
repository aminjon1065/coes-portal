/**
 * Библиотека компонентов — docs/07-КОМПОНЕНТЫ.md.
 *
 * Единственное место, где разрешены встроенные HTML-элементы и собственные
 * стили. Экраны собираются только отсюда (принцип П-3).
 */
export { Stack, Grid, Panel, Section, Divider, Toolbar } from './raskladka.tsx';
export type { StackProps, GridProps, PanelProps, SectionProps, DividerProps, Space, ToolbarProps } from './raskladka.tsx';

export { Text, Heading } from './tipografika.tsx';
export type { TextProps, HeadingProps, TextVariant, TextTone } from './tipografika.tsx';

export { Button, IconButton, ButtonGroup, Menu } from './deistviya.tsx';
export type { ButtonProps, IconButtonProps, ButtonKind, ButtonSize, ButtonGroupProps, MenuProps, MenuItem } from './deistviya.tsx';

export { Tag, StatusBadge, SeverityBadge, Counter, DescriptionList, MetricTile, Avatar, AuditFeed } from './dannye.tsx';
export type {
  TagProps, TagTone, StatusBadgeProps, LifecycleStatus, SeverityBadgeProps, SeverityToken, CounterProps,
  DescriptionItem, MetricTileProps, AvatarProps, AuditEntry,
} from './dannye.tsx';

export {
  Skeleton, Spinner, EmptyState, ErrorState, NoAccessState, Banner, RestrictedNotice, Tooltip,
  Toasts, Dialog, ConfirmDialog, DiskSpaceIndicator, UnsupportedBrowser,
  NETWORK_ERROR, TOAST_LIMIT, TOAST_LIFETIME_MS, SUPPORTED_BROWSERS,
} from './sostoyaniya.tsx';
export type {
  SkeletonProps, SpinnerProps, EmptyStateProps, ErrorStateProps, NoAccessStateProps,
  BannerProps, BannerTone, TooltipProps, ToastMessage, ToastsProps,
  DialogProps, DialogWidth, ConfirmDialogProps, DiskSpaceIndicatorProps, UnsupportedBrowserProps,
} from './sostoyaniya.tsx';

export { SideNav, TopBar, ConnectionIndicator, Breadcrumbs, Tabs, Pagination, PAGE_SIZES } from './navigatsiya.tsx';
export type {
  SideNavProps, NavSection, TopBarProps, PostContext, ConnectionIndicatorProps, ConnectionState,
  Crumb, TabsProps, TabItem, PaginationProps,
} from './navigatsiya.tsx';

export { Table } from './tablitsa.tsx';
export type { TableProps, Column, ColumnKind, Row, TableState, SortOrder } from './tablitsa.tsx';

export {
  DASH, formatDate, formatDateTime, formatDateTimeSeconds, formatPeriod,
  formatInteger, formatDecimal, formatPercent, formatMoney, formatFileSize,
  formatDuration, formatDegrees,
} from './formaty.ts';

export { Field, TextInput, TextArea, NumberInput, Checkbox, RadioGroup, Switch, Select } from './vvod.tsx';
export type {
  FieldProps, FieldState, TextInputProps, TextAreaProps, NumberInputProps,
  CheckboxProps, RadioOption, RadioGroupProps, SwitchProps,
  SelectProps, SelectOption, SelectState,
} from './vvod.tsx';

export { DateInput, DateRangeInput, FileUpload, parseDate, presetRange, PERIOD_PRESETS } from './data.tsx';
export type {
  DateInputProps, DateRangeInputProps, PeriodPreset,
  FileUploadProps, UploadedFile, UploadState,
} from './data.tsx';
