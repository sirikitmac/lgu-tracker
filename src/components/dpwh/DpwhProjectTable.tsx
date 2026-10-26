'use client';

import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, MapPin, MapPinOff } from 'lucide-react';
import {
  columnVisibilityFeature,
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type ReactTable,
  type SortingState,
  type Updater,
  type ColumnVisibilityState as VisibilityState,
} from '@tanstack/react-table';
import type { ProjectListItem } from '@/types/dpwh';
import { projectHref, sourceLabel } from '@/lib/integrations/bettergov/sources';
import { categoryLabel, contractMapHref, formatCount, formatDate, formatPeso, formatProgress, locationLabel } from './format';
import { StatusPill } from './StatusPill';
import { ProgressBar } from './DpwhProjectCard';
import { iconButtonClass, secondaryButtonClass, textLinkClass } from './ui';

/**
 * The project directory as a TanStack Table (v9) in server-processing mode.
 * Postgres filters, sorts, and pages (GET /api/dpwh/contracts); the table owns
 * the sorting, pagination, and column-visibility state that build that query
 * and renders the one page it returns. Filters stay in the directory's filter
 * state, which maps one to one onto the API's query parameters.
 *
 * The same table instance feeds the List and Grid views, so both show the
 * same rows and share paging.
 */

export const directoryFeatures = tableFeatures({ rowSortingFeature, rowPaginationFeature, columnVisibilityFeature });
export type DirectoryTable = ReactTable<typeof directoryFeatures, ProjectListItem>;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const; // the API allows 1-100

/** Columns whose header sorts the server query, and the API sort key each one uses. */
const COLUMN_SORT_KEYS: Record<string, string> = {
  project: 'title',
  location: 'location',
  start_date: 'start_date',
  amount: 'contract_amount',
  progress: 'progress',
};
const DEFAULT_SORT = 'contract_amount-desc';

/** "contract_amount-desc" → [{ id: 'amount', desc: true }]; sorts with no column (budget, contract date) → []. */
export function sortingFromKey(sort: string): SortingState {
  const cut = sort.lastIndexOf('-');
  const key = sort.slice(0, cut);
  const id = Object.keys(COLUMN_SORT_KEYS).find((c) => COLUMN_SORT_KEYS[c] === key);
  return id ? [{ id, desc: sort.slice(cut + 1) === 'desc' }] : [];
}
function keyFromSorting(sorting: SortingState): string {
  const first = sorting[0];
  return first && COLUMN_SORT_KEYS[first.id] ? `${COLUMN_SORT_KEYS[first.id]}-${first.desc ? 'desc' : 'asc'}` : DEFAULT_SORT;
}

/** Optional columns, hidden until the reader turns them on. */
export const DEFAULT_COLUMN_VISIBILITY: VisibilityState = { contractor: false, office: false, start_date: false };

const resolve = <T,>(updater: Updater<T>, current: T): T => (typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater);

/** Row actions live in context so the column definitions stay module-level and stable. */
const RowActions = createContext<{ onOpenContract: (id: string) => void; officeColumnShown: boolean }>({
  onOpenContract: () => {},
  officeColumnShown: false,
});

const isContract = (item: ProjectListItem) => item.source === 'dpwh_contracts';

function ProjectCell({ item }: { item: ProjectListItem }) {
  const { onOpenContract, officeColumnShown } = useContext(RowActions);
  const title = item.contract_name ?? item.title;
  const label = (
    <>
      <span className="block font-medium leading-snug text-ink group-hover:underline underline-offset-2 decoration-line-strong line-clamp-2" title={title}>
        {title}
      </span>
      <span className="block mt-1 text-xs text-muted">
        {item.record_id} · {sourceLabel(item.source)}
        {!officeColumnShown && item.implementing_office ? ` · ${item.implementing_office}` : ''}
      </span>
    </>
  );
  const linkClass = 'block text-left group rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
  return isContract(item) ? (
    <button type="button" onClick={() => onOpenContract(item.record_id)} className={linkClass}>{label}</button>
  ) : (
    <Link href={projectHref(item.source, item.record_id)} className={linkClass}>{label}</Link>
  );
}

function LocationCell({ item }: { item: ProjectListItem }) {
  const mapHref = isContract(item) ? contractMapHref({ ...item, contract_id: item.record_id }) : null;
  return (
    <>
      <span className="block text-ink">{locationLabel(item)}</span>
      <span className="block text-xs text-muted">{item.region ?? '—'}</span>
      {mapHref ? (
        <Link href={mapHref} className={`inline-flex items-center gap-1 mt-1 text-xs ${textLinkClass}`}>
          <MapPin className="w-3 h-3" aria-hidden="true" /> Map
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1 mt-1 text-xs text-muted" title="The source reports no coordinates for this project.">
          <MapPinOff className="w-3 h-3" aria-hidden="true" /> No coordinates
        </span>
      )}
    </>
  );
}

const helper = createColumnHelper<typeof directoryFeatures, ProjectListItem>();
const dash = <span className="text-muted">—</span>;

const columns = helper.columns([
  helper.accessor((r) => r.contract_name ?? r.title, {
    id: 'project',
    header: 'Project',
    enableHiding: false,
    cell: (info) => <ProjectCell item={info.row.original} />,
  }),
  helper.accessor((r) => r.province ?? r.region, {
    id: 'location',
    header: 'Location (reported)',
    cell: (info) => <LocationCell item={info.row.original} />,
  }),
  helper.accessor('category', {
    header: 'Category',
    enableSorting: false,
    cell: (info) => <span className="text-ink">{categoryLabel(info.getValue())}</span>,
  }),
  helper.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => <StatusPill status={info.getValue()} />,
  }),
  helper.accessor('contractor', {
    header: 'Contractor',
    enableSorting: false,
    cell: (info) => (info.getValue() ? <span className="line-clamp-2 text-ink" title={info.getValue() ?? ''}>{info.getValue()}</span> : dash),
  }),
  helper.accessor('implementing_office', {
    id: 'office',
    header: 'Implementing office',
    enableSorting: false,
    cell: (info) => (info.getValue() ? <span className="text-ink">{info.getValue()}</span> : dash),
  }),
  helper.accessor('start_date', {
    header: 'Start date',
    sortDescFirst: true,
    cell: (info) => (info.getValue() ? <span className="tabular-nums whitespace-nowrap">{formatDate(info.getValue())}</span> : dash),
  }),
  helper.accessor((r) => (isContract(r) ? r.contract_amount : r.budget), {
    id: 'amount',
    header: 'Amount',
    sortDescFirst: true,
    cell: (info) => {
      const item = info.row.original;
      return (
        <>
          <span className="font-medium text-ink">{formatPeso(info.getValue())}</span>
          {!isContract(item) && <span className="block text-xs font-normal text-muted">{item.amount_label}</span>}
        </>
      );
    },
  }),
  helper.accessor('progress', {
    header: 'Progress',
    sortDescFirst: true,
    cell: (info) => {
      const item = info.row.original;
      if (!isContract(item)) return <span className="text-muted">Not applicable</span>;
      if (item.progress === null) return <span className="text-muted">Not reported</span>;
      return (
        <>
          <span className="text-ink">{formatProgress(item.progress)}</span>
          <ProgressBar value={Number(item.progress)} status={item.status} className="w-16 ml-auto mt-1.5" />
        </>
      );
    },
  }),
]);

/** Per-column layout: numeric columns align right; less important ones drop out on narrow screens. */
const COLUMN_CLASS: Record<string, string> = {
  project: 'w-[38%] min-w-[260px]',
  location: 'min-w-[150px]',
  category: 'hidden lg:table-cell min-w-[130px]',
  status: 'whitespace-nowrap',
  contractor: 'min-w-[180px]',
  office: 'min-w-[160px]',
  start_date: 'text-right whitespace-nowrap',
  amount: 'text-right whitespace-nowrap tabular-nums',
  progress: 'text-right whitespace-nowrap tabular-nums',
};

export function useDirectoryTable({
  items,
  total,
  sort,
  onSortChange,
  pagination,
  onPaginationChange,
  columnVisibility,
  onColumnVisibilityChange,
}: {
  items: ProjectListItem[];
  total: number;
  sort: string;
  onSortChange: (sort: string) => void;
  pagination: PaginationState;
  onPaginationChange: (next: PaginationState) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (next: VisibilityState) => void;
}): DirectoryTable {
  const sorting = sortingFromKey(sort);
  return useTable({
    features: directoryFeatures,
    columns,
    data: items,
    getRowId: (row) => `${row.source}:${row.record_id}`,
    state: { sorting, pagination, columnVisibility },
    onSortingChange: (u) => onSortChange(keyFromSorting(resolve(u, sorting))),
    onPaginationChange: (u) => onPaginationChange(resolve(u, pagination)),
    onColumnVisibilityChange: (u) => onColumnVisibilityChange(resolve(u, columnVisibility)),
    manualSorting: true,
    manualPagination: true,
    rowCount: total,
    enableSortingRemoval: false,
    enableMultiSort: false,
    autoResetPageIndex: false,
  });
}

function SortGlyph({ state }: { state: false | 'asc' | 'desc' }) {
  const Icon = state === 'asc' ? ArrowUp : state === 'desc' ? ArrowDown : ArrowUpDown;
  return <Icon className={`w-3.5 h-3.5 shrink-0 ${state ? 'text-ink' : 'text-line-strong group-hover:text-muted'}`} aria-hidden="true" />;
}

/** List view. Only the table scrolls sideways on narrow screens, never the page. */
export function DpwhProjectTable({
  table,
  loading,
  onOpenContract,
}: {
  table: DirectoryTable;
  loading: boolean;
  onOpenContract: (contractId: string) => void;
}) {
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const officeColumnShown = table.getColumn('office')?.getIsVisible() ?? false;

  return (
    <RowActions.Provider value={{ onOpenContract, officeColumnShown }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const col = header.column;
                  const sorted = col.getIsSorted();
                  const align = COLUMN_CLASS[col.id]?.includes('text-right') ? 'justify-end text-right' : 'justify-start text-left';
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={`px-4 py-2.5 text-xs font-medium text-muted ${COLUMN_CLASS[col.id] ?? ''}`}
                    >
                      {col.getCanSort() ? (
                        <button
                          type="button"
                          onClick={col.getToggleSortingHandler()}
                          className={`group inline-flex items-center gap-1 w-full ${align} rounded-md hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink ${sorted ? 'text-ink' : ''}`}
                          title={`Sort by ${String(col.columnDef.header).toLowerCase()}`}
                        >
                          {String(col.columnDef.header)}
                          <SortGlyph state={sorted} />
                        </button>
                      ) : (
                        <span className={`flex ${align}`}>{String(col.columnDef.header)}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {loading && rows.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {visibleColumns.map((col) => (
                      <td key={col.id} className={`px-4 py-4 ${COLUMN_CLASS[col.id] ?? ''}`}>
                        <div className={`h-3.5 rounded bg-sunken ${col.id === 'project' ? 'w-4/5' : 'w-16'} ${COLUMN_CLASS[col.id]?.includes('text-right') ? 'ml-auto' : ''}`} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row.id} className="align-top transition-colors hover:bg-ground focus-within:bg-ground">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`px-4 py-3.5 text-[13px] ${COLUMN_CLASS[cell.column.id] ?? ''}`}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </RowActions.Provider>
  );
}

/** Column visibility menu: a disclosure with one checkbox per hideable column. */
export function ColumnToggle({ table }: { table: DirectoryTable }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const hiddenCount = hideable.filter((c) => !c.getIsVisible()).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={menuId} className={secondaryButtonClass}>
        <Columns3 className="w-4 h-4" aria-hidden="true" /> Columns
        {hiddenCount > 0 && <span className="text-muted font-medium tabular-nums">({hideable.length - hiddenCount}/{hideable.length})</span>}
      </button>
      {open && (
        <fieldset id={menuId} className="absolute right-0 z-30 mt-2 w-60 p-2 rounded-card glass-strong border border-line shadow-float">
          <legend className="sr-only">Columns to show</legend>
          {hideable.map((col) => (
            <label key={col.id} className="flex items-center gap-2.5 h-9 px-2 rounded-lg text-sm text-ink hover:bg-sunken cursor-pointer">
              <input
                type="checkbox"
                checked={col.getIsVisible()}
                onChange={col.getToggleVisibilityHandler()}
                className="w-4 h-4 accent-ink"
              />
              {String(col.columnDef.header)}
              {col.id === 'category' && <span className="ml-auto text-[11px] text-muted">wide screens</span>}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

/** Pager shared by both views: range, page size, and first/previous/next/last. */
export function DirectoryPager({ table, total }: { table: DirectoryTable; total: number }) {
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, total);
  const btn = iconButtonClass;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[13px] text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="tabular-nums">
          {formatCount(start)}–{formatCount(end)} of {formatCount(total)}
        </span>
        <label className="inline-flex items-center gap-2">
          Rows per page
          <select
            className="h-9 pl-2.5 pr-7 rounded-control border border-line-strong bg-surface text-sm text-ink focus:outline-2 focus:outline-accent-ink"
            value={pageSize}
            onChange={(e) => table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="First page">
          <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button" className={btn} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <span className="px-2 tabular-nums text-ink" aria-live="polite">
          Page {formatCount(pageIndex + 1)} of {formatCount(pageCount)}
        </span>
        <button type="button" className={btn} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button" className={btn} onClick={() => table.lastPage()} disabled={!table.getCanLastPage()} aria-label="Last page">
          <ChevronsRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
