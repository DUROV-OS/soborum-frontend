import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Input, Select } from '@/shared/ui/Field'
import * as warehouseApi from '../api'
import { useWarehouseStore } from '../store'
import {
  DESTINATION_KIND_LABEL,
  JOURNAL_REASONS,
  JournalEntry,
  JournalFilters,
  MOVEMENT_REASON_LABEL,
  MovementReason,
} from '../types'
import { formatQty } from './OperationLinesEditor'

const PAGE_SIZE = 200

/** Начало местного дня `YYYY-MM-DD` (+ `addDays`) в ISO для фильтра журнала. */
function dayStartIso(day: string, addDays = 0): string | undefined {
  if (!day) return undefined
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

function Dash() {
  return <span className="text-muted">—</span>
}

/** Журнал операций склада (0088-c): все движения, менявшие остаток, — с датой
 * операции, остатком после, «куда» и «кто получил». */
export function JournalPanel() {
  const materials = useWarehouseStore((s) => s.materials)
  const operationsVersion = useWarehouseStore((s) => s.operationsVersion)
  const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all')
  const [reason, setReason] = useState<MovementReason | 'all'>('all')
  const [materialId, setMaterialId] = useState<number | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filters: JournalFilters = {
    direction: direction === 'all' ? undefined : direction,
    reason: reason === 'all' ? undefined : reason,
    material_id: materialId === 'all' ? undefined : materialId,
    date_from: dayStartIso(dateFrom),
    date_to: dayStartIso(dateTo, 1),
  }
  const filtersKey = JSON.stringify(filters)

  async function fetchPage(offset: number) {
    setLoading(true)
    setError(null)
    try {
      const page = await warehouseApi.journal({ ...filters, limit: PAGE_SIZE, offset })
      setRows((prev) => (offset === 0 ? page : [...prev, ...page]))
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить журнал')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, operationsVersion])

  const sortedMaterials = [...materials].sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={direction} onChange={(e) => setDirection(e.target.value as 'all' | 'in' | 'out')}>
          <option value="all">Приход и расход</option>
          <option value="in">Только приход</option>
          <option value="out">Только расход</option>
        </Select>
        <Select value={reason} onChange={(e) => setReason(e.target.value as MovementReason | 'all')}>
          <option value="all">Все операции</option>
          {JOURNAL_REASONS.map((key) => (
            <option key={key} value={key}>
              {MOVEMENT_REASON_LABEL[key]}
            </option>
          ))}
        </Select>
        <Select
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Все материалы</option>
          {sortedMaterials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="С даты" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="По дату" />
      </div>
      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}
      <DataTable
        columns={[
          {
            header: 'Дата операции',
            accessor: (r) => new Date(r.occurred_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
            className: 'tabular whitespace-nowrap',
          },
          {
            header: 'Операция',
            accessor: (r) => (
              <div>
                <div>{MOVEMENT_REASON_LABEL[r.reason]}</div>
                {r.note && <div className="text-[12px] text-muted">{r.note}</div>}
              </div>
            ),
          },
          {
            header: 'Материал',
            accessor: (r) => (
              <div>
                <div className="font-medium text-ink">{r.material_title}</div>
                {r.material_code && <div className="text-[12px] text-muted">{r.material_code}</div>}
              </div>
            ),
          },
          {
            header: 'Кол-во',
            align: 'right',
            className: 'tabular whitespace-nowrap',
            accessor: (r) => (
              <span className={r.delta >= 0 ? 'text-success' : 'text-danger'}>
                {r.delta >= 0 ? '+' : '−'}
                {formatQty(Math.abs(r.delta))} {r.unit}
              </span>
            ),
          },
          {
            header: 'Остаток после',
            align: 'right',
            className: 'tabular whitespace-nowrap',
            accessor: (r) => (r.balance_after === null ? <Dash /> : `${formatQty(r.balance_after)} ${r.unit}`),
          },
          {
            header: 'Куда',
            accessor: (r) =>
              r.destination ? (
                <div>
                  {r.destination_kind && (
                    <div className="text-[12px] text-muted">{DESTINATION_KIND_LABEL[r.destination_kind]}</div>
                  )}
                  <div>{r.destination}</div>
                </div>
              ) : (
                <Dash />
              ),
          },
          { header: 'Кто получил', accessor: (r) => r.received_by ?? <Dash /> },
          { header: 'Оформил', accessor: (r) => r.created_by_name },
        ]}
        rows={rows}
        keyOf={(r) => String(r.movement_id)}
        loading={loading && rows.length === 0}
        emptyLabel="Операций за выбранный период нет"
      />
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => fetchPage(rows.length)}>
            {loading ? 'Загрузка…' : 'Показать ещё'}
          </Button>
        </div>
      )}
    </div>
  )
}
