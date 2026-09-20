import { ReactNode, useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, ChevronUp, X } from 'lucide-react'

export interface DataTableColumn<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right'
  /** Если задан — заголовок кликабелен и открывает меню выбора сортировки. */
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
  const [openHeader, setOpenHeader] = useState<string | null>(null)

  useEffect(() => {
    if (!openHeader) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenHeader(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openHeader])

  function applySort(header: string, direction: SortDirection | null) {
    setSort(direction ? { header, direction } : null)
    setOpenHeader(null)
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
            {columns.map((col) => {
              const active = sort?.header === col.header
              return (
                <th
                  key={col.header}
                  className={`relative px-4 py-2.5 font-medium text-muted ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className ?? ''}`}
                >
                  {col.sortValue ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenHeader((h) => (h === col.header ? null : col.header))}
                        aria-haspopup="menu"
                        aria-expanded={openHeader === col.header}
                        className={`inline-flex items-center gap-1 hover:text-ink ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        {col.header}
                        {active ? (
                          sort!.direction === 'asc' ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )
                        ) : null}
                      </button>

                      {openHeader === col.header && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenHeader(null)} />
                          <div
                            className={`absolute z-20 mt-2 w-52 rounded-md border border-border bg-surface p-1.5 text-left text-ink shadow-xl ${col.align === 'right' ? 'right-0' : 'left-0'}`}
                          >
                            <button
                              type="button"
                              onClick={() => applySort(col.header, 'asc')}
                              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted"
                            >
                              <ArrowUpAZ size={14} />
                              По возрастанию
                            </button>
                            <button
                              type="button"
                              onClick={() => applySort(col.header, 'desc')}
                              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted"
                            >
                              <ArrowDownAZ size={14} />
                              По убыванию
                            </button>
                            {active && (
                              <button
                                type="button"
                                onClick={() => applySort(col.header, null)}
                                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] text-muted hover:bg-surface-muted"
                              >
                                <X size={14} />
                                Без сортировки
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    col.header
                  )}
                </th>
              )
            })}
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
