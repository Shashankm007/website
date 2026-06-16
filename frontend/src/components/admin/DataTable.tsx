import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Feedback';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  empty?: React.ReactNode;
  rowKey?: (row: T) => string;
}

const SKELETON_ROWS = 5;

/**
 * Generic, styled admin table. Renders a header row, skeleton rows while
 * loading, an empty slot when there are no rows, and a cell per column using
 * `render` (falling back to the raw value under `key`).
 */
export function DataTable<T>({ columns, rows, loading, empty, rowKey }: DataTableProps<T>) {
  const getKey = (row: T, i: number) => (rowKey ? rowKey(row) : String(i));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, r) => (
                <tr key={`s${r}`}>
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  {empty ?? <p className="text-center text-sm text-slate-500">No records found.</p>}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={getKey(row, i)} className="transition hover:bg-slate-50/70">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle text-slate-700', col.className)}>
                      {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
