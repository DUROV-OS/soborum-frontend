import { ReactNode, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface DataTableColumn<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right'
  /** Если задан — заголовок кликабелен и включает сортировку по возрастанию/убыванию/сбросу. */
  sortValue?: (row: T) => string | number | Date
}

type SortDirection = 'asc' | 'desc'

function compareSortValues(a: string | number | Date, b: string | number | Date): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ru')
}

export function DataTable<T>({
  columns,
  rows,
  keyOf,
  onRowClick,
  loading = false,
  emptyLabel = 'Нет данных',
  loadingLabel = 'Загрузка…',
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  keyOf: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyLabel?: string
  loadingLabel?: string
}) {
  const [sort, setSort] = useState<{ header: string; direction: SortDirection } | null>(null)

  function handleHeaderClick(col: DataTableColumn<T>) {
    if (!col.sortValue) return
    setSort((prev) => {
      if (prev?.header !== col.header) return { header: col.header, direction: 'asc' }
      if (prev.direction === 'asc') return { header: col.header, direction: 'desc' }
      return null
    })
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.header === sort.header)
    if (!col?.sortValue) return rows
    const sign = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => sign * compareSortValues(col.sortValue!(a), col.sortValue!(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-4 py-2.5 font-medium text-muted ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className ?? ''}`}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => handleHeaderClick(col)}
                    className={`inline-flex items-center gap-1 hover:text-ink ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {col.header}
                    {sort?.header === col.header ? (
                      sort.direction === 'asc' ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )
                    ) : null}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-surface-muted/60' : ''}`}
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-4 py-2.5 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className ?? ''}`}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                {loading ? loadingLabel : emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
