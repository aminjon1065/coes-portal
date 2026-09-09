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

export { Tag, StatusBadge, SeverityBadge, Counter } from './dannye.tsx';
export type { TagProps, TagTone, StatusBadgeProps, LifecycleStatus, SeverityBadgeProps, SeverityToken, CounterProps } from './dannye.tsx';

export { Skeleton, Spinner, EmptyState, ErrorState, NoAccessState, Banner, RestrictedNotice, Tooltip, NETWORK_ERROR } from './sostoyaniya.tsx';
export type { SkeletonProps, SpinnerProps, EmptyStateProps, ErrorStateProps, NoAccessStateProps, BannerProps, BannerTone, TooltipProps } from './sostoyaniya.tsx';

export { SideNav, TopBar, ConnectionIndicator, Breadcrumbs, Tabs, Pagination, PAGE_SIZES } from './navigatsiya.tsx';
export type {
  SideNavProps, NavSection, TopBarProps, PostContext, ConnectionIndicatorProps, ConnectionState,
  Crumb, TabsProps, TabItem, PaginationProps,
} from './navigatsiya.tsx';
