import { useLayoutEffect, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './tablitsa.module.css';
import { DASH, formatDate, formatDateTime, formatInteger } from './formaty.ts';
import { Skeleton, EmptyState, ErrorState, NoAccessState, NETWORK_ERROR } from './sostoyaniya.tsx';

/** Таблица — docs/07-КОМПОНЕНТЫ.md § 6.1. */

export type ColumnKind = 'text' | 'number' | 'date' | 'datetime' | 'tag' | 'severity' | 'status' | 'actions';

export type Row = Readonly<Record<string, unknown>>;

export interface Column {
  readonly key: string;
  readonly title: string;
  /** «вид» колонки. Определяет форматирование и выравнивание. */
  readonly kind?: ColumnKind;
  /** «ширина»: число — фиксированная в px, отсутствие — авто. */
  readonly width?: number;
  /** «обязательность отображения»: только такие колонки видны в карточках. */
  readonly required?: boolean;
  readonly sortable?: boolean;
  /** Своё представление ячейки — для видов метка, важность, состояние, действия. */
  readonly render?: (row: Row) => ReactNode;
}

export type TableState = 'data' | 'loading' | 'empty' | 'notFound' | 'error' | 'noAccess';

export interface SortOrder {
  readonly key: string;
  readonly direction: 'asc' | 'desc';
}

export interface TableProps {
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  /** Ключ строки. Порядковый номер ключом не является: строки переставляются. */
  readonly rowKey: (row: Row) => string;
  readonly caption: string;
  /** «плотность» */
  readonly density?: 'compact' | 'normal';
  readonly sort?: SortOrder;
  readonly state?: TableState;
  /** «закреплённыеКолонки» — число колонок слева. */
  readonly pinnedColumns?: number;
  readonly selectedKey?: string;
  readonly checkedKeys?: readonly string[];
  /** «наСтроку» */
  readonly onRow?: (row: Row) => void;
  readonly onSort?: (key: string) => void;
  /** Нижняя строка со скелетом: идёт подгрузка следующей страницы. */
  readonly loadingMore?: boolean;
  readonly emptyTitle?: string;
  readonly emptyHint?: string;
  /** Текст отказа из ответа сервера. Без него берётся дословный текст § 9.4
      для случая, когда ответа не было вовсе. */
  readonly errorMessage?: string;
  readonly requestId?: string;
  readonly onRetry?: () => void;
}

const ALIGN: Readonly<Record<ColumnKind, string | undefined>> = {
  text: undefined, number: styles.number, date: undefined, datetime: undefined,
  tag: undefined, severity: undefined, status: undefined, actions: styles.center,
};

/** Пустая ячейка запрещена: отсутствие данных — только знак тире (06 § 8). */
function cellText(value: unknown, kind: ColumnKind): string {
  if (value === null || value === undefined || value === '') return DASH;
  if (kind === 'number') return typeof value === 'number' ? formatInteger(value) : String(value);
  if (kind === 'date') return formatDate(value as string);
  if (kind === 'datetime') return formatDateTime(value as string);
  return String(value);
}

export function Table({
  columns, rows, rowKey, caption, density = 'compact', sort, state = 'data',
  pinnedColumns = 0, selectedKey, checkedKeys = [], onRow, onSort,
  loadingMore = false, emptyTitle = 'Записей пока нет', emptyHint = 'Здесь появятся записи реестра',
  errorMessage, requestId, onRetry,
}: TableProps): ReactNode {
  const scroller = useRef<HTMLDivElement>(null);

  // Ширина колонок и смещение закреплённых — данные экрана, а не величины
  // дизайн-системы, поэтому они выставляются после раскладки, а не атрибутом
  // style в разметке (06 § 13 п. 11).
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node === null) return;
    const cols = node.querySelectorAll('col');
    columns.forEach((column, index) => {
      const col = cols[index];
      if (col instanceof HTMLElement) {
        col.style.setProperty('width', column.width === undefined ? 'auto' : `${String(column.width)}px`);
      }
    });
    if (pinnedColumns <= 0) return;
    for (const tr of node.querySelectorAll('tr')) {
      let offset = 0;
      for (let i = 0; i < pinnedColumns; i += 1) {
        const cell = tr.children[i];
        if (!(cell instanceof HTMLElement)) break;
        cell.style.setProperty('left', `${String(offset)}px`);
        offset += cell.offsetWidth;
      }
    }
  }, [pinnedColumns, columns, rows]);

  if (state === 'noAccess') return <NoAccessState />;
  if (state === 'error') {
    return (
      <ErrorState
        message={errorMessage ?? NETWORK_ERROR.hint}
        requestId={requestId}
        onRetry={onRetry}
      />
    );
  }
  if (state === 'empty') return <EmptyState kind="empty" title={emptyTitle} hint={emptyHint} />;
  if (state === 'notFound') {
    return <EmptyState kind="notFound" title="Ничего не найдено" hint="Измените условия отбора" />;
  }

  const skeletonRows = state === 'loading' ? Array.from({ length: 10 }, (_, i) => i) : [];

  return (
    <div className={styles.scroller} ref={scroller}>
      <table className={styles.table}>
        <caption className={styles.label}>{caption}</caption>
        <colgroup>
          {columns.map((column) => <col key={column.key} />)}
        </colgroup>
        <thead className={styles.head}>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                className={[
                  styles.headCell,
                  ALIGN[column.kind ?? 'text'],
                  index < pinnedColumns ? styles.pinned : '',
                  index === pinnedColumns - 1 ? styles.pinnedEdge : '',
                  column.required === true ? '' : styles.optional,
                ].filter(Boolean).join(' ')}
                scope="col"
                aria-sort={sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {column.sortable === true
                  ? (
                    <button className={styles.sortButton} type="button" onClick={() => { onSort?.(column.key); }}>
                      {column.title}
                      {sort?.key === column.key
                        ? (sort.direction === 'asc'
                          ? <ArrowUp size={16} aria-hidden="true" />
                          : <ArrowDown size={16} aria-hidden="true" />)
                        : null}
                    </button>
                  )
                  : column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skeletonRows.map((index) => (
            <tr key={`skeleton-${String(index)}`} className={density === 'normal' ? styles.rowNormal : styles.row}>
              {columns.map((column) => (
                <td key={column.key} className={styles.cell}><Skeleton /></td>
              ))}
            </tr>
          ))}
          {state === 'data' ? rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={[
                  density === 'normal' ? styles.rowNormal : styles.row,
                  onRow === undefined ? '' : styles.rowClickable,
                  key === selectedKey ? styles.rowSelected : '',
                  checkedKeys.includes(key) ? styles.rowChecked : '',
                ].filter(Boolean).join(' ')}
                onClick={() => { onRow?.(row); }}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={[
                      styles.cell,
                      ALIGN[column.kind ?? 'text'],
                      index < pinnedColumns ? styles.pinned : '',
                      index === pinnedColumns - 1 ? styles.pinnedEdge : '',
                      column.required === true ? '' : styles.optional,
                    ].filter(Boolean).join(' ')}
                    title={column.render === undefined ? cellText(row[column.key], column.kind ?? 'text') : undefined}
                  >
                    <span className={styles.label}>{column.title}</span>
                    {column.render === undefined
                      ? cellText(row[column.key], column.kind ?? 'text')
                      : column.render(row)}
                  </td>
                ))}
              </tr>
            );
          }) : null}
          {loadingMore ? (
            <tr className={styles.row}>
              {columns.map((column) => (
                <td key={column.key} className={styles.cell}><Skeleton /></td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
