import { ReactNode, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface KanbanColumn<K extends string> {
  key: K
  label: string
  hint?: string
}

export function KanbanBoard<T, K extends string>({
  columns,
  items,
  columnOf,
  keyOf,
  renderCard,
  onCardClick,
  loading = false,
  focusKey = null,
  sortItem,
  scrollColumns = false,
}: {
  columns: KanbanColumn<K>[]
  items: T[]
  columnOf: (item: T) => K
  keyOf: (item: T) => string
  renderCard: (item: T) => ReactNode
  onCardClick?: (item: T) => void
  loading?: boolean
  /** Колонка, которую нужно раскрыть на мобильном аккордеоне (например, куда только что
   * переехала карточка) — иначе на мобильных карточка в свёрнутой колонке визуально теряется. */
  focusKey?: K | null
  /** Если передан — карточки внутри каждой колонки сортируются им перед рендером;
   * если не передан — порядок как в `items` (текущее поведение). */
  sortItem?: (a: T, b: T) => number
  /** Десктопная раскладка: колонка получает фиксированную высоту и свою полосу
   * прокрутки вместо скролла всей страницы; заголовок остаётся закреплён.
   * По умолчанию выключено — поведение не меняется. */
  scrollColumns?: boolean
}) {
  const [openKey, setOpenKey] = useState<K | null>(columns[0]?.key ?? null)

  useEffect(() => {
    if (focusKey !== null) setOpenKey(focusKey)
  }, [focusKey])

  const columnsWithItems = columns.map((column) => {
    const columnItems = items.filter((item) => columnOf(item) === column.key)
    if (sortItem) columnItems.sort(sortItem)
    return { column, columnItems }
  })

  const renderCards = (columnItems: T[]) => (
    <>
      {columnItems.map((item) => (
        <div
          key={keyOf(item)}
          role="button"
          tabIndex={0}
          onClick={() => onCardClick?.(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onCardClick?.(item)
            }
          }}
          className="cursor-pointer rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-brand/40"
        >
          {renderCard(item)}
        </div>
      ))}
      {columnItems.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-3 text-center text-[12px] text-muted">
          {loading ? 'Загрузка…' : 'Пусто'}
        </div>
      )}
    </>
  )

  return (
    <>
      <div className="hidden gap-4 overflow-x-auto pb-2 sm:flex">
        {columnsWithItems.map(({ column, columnItems }) => (
          <div
            key={column.key}
            className={`flex w-72 shrink-0 flex-col ${scrollColumns ? 'max-h-[calc(100vh-14rem)]' : ''}`}
          >
            <div className="mb-3 flex shrink-0 items-baseline justify-between px-1">
              <h3 className="text-[13px] font-medium text-ink">{column.label}</h3>
              <span className="tabular text-[12px] text-muted">{columnItems.length}</span>
            </div>
            <div className={`flex flex-col gap-2 ${scrollColumns ? 'min-h-0 overflow-y-auto pr-0.5' : ''}`}>
              {renderCards(columnItems)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {columnsWithItems.map(({ column, columnItems }) => {
          const isOpen = openKey === column.key
          return (
            <div key={column.key} className="rounded-md border border-border bg-surface">
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : column.key)}
                className="flex w-full items-center justify-between px-3 py-3"
                aria-expanded={isOpen}
              >
                <span className="text-[13px] font-medium text-ink">{column.label}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-[12px] text-muted">{columnItems.length}</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-2 border-t border-border p-3 pt-2">
                  {renderCards(columnItems)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
