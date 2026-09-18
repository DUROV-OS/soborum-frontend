import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calculator, Plus, Trash2, Upload } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input, Select } from '@/shared/ui/Field'
import { Tabs } from '@/shared/ui/Tabs'
import { AmountFilterMode, useAccountingStore } from '../store'
import { CreateMovementModal } from '../components/CreateMovementModal'
import { ImportPaymentsModal } from '../components/ImportPaymentsModal'
import { MovementDetailDrawer } from '../components/MovementDetailDrawer'
import { SalaryTab } from './SalaryTab'
import {
  DIRECTION_LABEL,
  MoneyDirection,
  MoneyMovementStatus,
  MoneySourceKind,
  MoneySubkind,
  SOURCE_KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  SUBKIND_LABEL,
} from '../types'

function money(amount: number, direction: MoneyDirection): string {
  const sign = direction === 'expense' ? '−' : ''
  return `${sign}${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

const AMOUNT_MODE_LABEL: Record<AmountFilterMode, string> = {
  all: 'Не важно',
  range: 'Диапазон',
  gt: 'Больше',
  lt: 'Меньше',
  eq: 'Равно',
}

/** Общий вид фильтра «Сумма»/«Налог» — режим сравнения + одно или два числовых поля (0072-c). */
function AmountRangeFilter({
  label,
  mode,
  from,
  to,
  onModeChange,
  onFromChange,
  onToChange,
}: {
  label: string
  mode: AmountFilterMode
  from: string
  to: string
  onModeChange: (mode: AmountFilterMode) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select className="w-full sm:w-40" value={mode} onChange={(e) => onModeChange(e.target.value as AmountFilterMode)}>
        {(Object.keys(AMOUNT_MODE_LABEL) as AmountFilterMode[]).map((m) => (
          <option key={m} value={m}>
            {label}: {AMOUNT_MODE_LABEL[m]}
          </option>
        ))}
      </Select>
      {mode !== 'all' && (
        <Input
          type="number"
          className="w-24"
          placeholder={mode === 'range' ? 'от' : 'значение'}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      )}
      {mode === 'range' && (
        <>
          <span className="text-muted">—</span>
          <Input type="number" className="w-24" placeholder="до" value={to} onChange={(e) => onToChange(e.target.value)} />
        </>
      )}
    </div>
  )
}

export function AccountingPage() {
  const movements = useAccountingStore((s) => s.movements)
  const loading = useAccountingStore((s) => s.loading)
  const loadError = useAccountingStore((s) => s.loadError)
  const filters = useAccountingStore((s) => s.filters)
  const load = useAccountingStore((s) => s.load)
  const setFilters = useAccountingStore((s) => s.setFilters)
  const resetFilters = useAccountingStore((s) => s.resetFilters)
  const remove = useAccountingStore((s) => s.remove)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')

  const [searchParams, setSearchParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const requested = searchParams.get('movement')
    return requested ? Number(requested) : null
  })
  const [tab, setTab] = useState<'register' | 'salary'>('register')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    // Переход по ссылке «создана проводка» (0011-f) — открываем карточку и
    // убираем параметр из адреса, чтобы обновление страницы не переоткрывало её.
    if (searchParams.get('movement')) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDeleteRow(id: number) {
    if (!window.confirm('Удалить проводку? Отменить нельзя.')) return
    setDeletingId(id)
    const result = await remove(id)
    setDeletingId(null)
    setListError(result.ok ? null : result.reason ?? 'Не удалось удалить проводку')
  }

  useEffect(() => {
    load()
  }, [load])

  const selected = movements.find((m) => m.id === selectedId) ?? null
  const filtersDirty =
    filters.direction !== 'all' ||
    filters.subkind !== 'all' ||
    filters.status !== 'all' ||
    filters.source_kind !== 'all' ||
    filters.period !== 'all' ||
    filters.amount_mode !== 'all' ||
    filters.tax_mode !== 'all'

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Бухгалтерия</h1>
          <p className="mt-1 text-[13px] text-muted">
            Единый реестр движения денежных средств: вид, сумма, налог, инициатор, статус.
          </p>
        </div>
        {tab === 'register' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload size={16} />
              Импорт платежей
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Новая проводка
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'register', label: 'Реестр' },
            { key: 'salary', label: 'Сотрудники' },
          ]}
          activeKey={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'salary' ? (
        <SalaryTab />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Select
              className="w-full sm:w-44"
              value={filters.direction}
              onChange={(e) => setFilters({ direction: e.target.value as MoneyDirection | 'all' })}
            >
              <option value="all">Все направления</option>
              {(Object.keys(DIRECTION_LABEL) as MoneyDirection[]).map((d) => (
                <option key={d} value={d}>
                  {DIRECTION_LABEL[d]}
                </option>
              ))}
            </Select>
            <Select
              className="w-full sm:w-52"
              value={filters.subkind}
              onChange={(e) => setFilters({ subkind: e.target.value as MoneySubkind | 'all' })}
            >
              <option value="all">Все виды</option>
              {(Object.keys(SUBKIND_LABEL) as MoneySubkind[]).map((s) => (
                <option key={s} value={s}>
                  {SUBKIND_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select
              className="w-full sm:w-44"
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as MoneyMovementStatus | 'all' })}
            >
              <option value="all">Все статусы</option>
              {(Object.keys(STATUS_LABEL) as MoneyMovementStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select
              className="w-full sm:w-44"
              value={filters.source_kind}
              onChange={(e) => setFilters({ source_kind: e.target.value as MoneySourceKind | 'all' })}
            >
              <option value="all">Любой источник</option>
              {(Object.keys(SOURCE_KIND_LABEL) as MoneySourceKind[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_KIND_LABEL[s]}
                </option>
              ))}
            </Select>
            <DateFilterSelect value={filters.period} onChange={(period) => setFilters({ period })} />
            <AmountRangeFilter
              label="Сумма"
              mode={filters.amount_mode}
              from={filters.amount_from}
              to={filters.amount_to}
              onModeChange={(amount_mode) => setFilters({ amount_mode, amount_from: '', amount_to: '' })}
              onFromChange={(amount_from) => setFilters({ amount_from })}
              onToChange={(amount_to) => setFilters({ amount_to })}
            />
            <AmountRangeFilter
              label="Налог"
              mode={filters.tax_mode}
              from={filters.tax_from}
              to={filters.tax_to}
              onModeChange={(tax_mode) => setFilters({ tax_mode, tax_from: '', tax_to: '' })}
              onFromChange={(tax_from) => setFilters({ tax_from })}
              onToChange={(tax_to) => setFilters({ tax_to })}
            />
            {filtersDirty && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Сбросить
              </Button>
            )}
          </div>
          {loadError && <p className="mb-3 text-[12px] text-danger">{loadError}</p>}

          {!loading && movements.length === 0 ? (
            <EmptyState
              icon={<Calculator size={24} />}
              title={filtersDirty ? 'Под фильтры ничего не подходит' : 'Проводок пока нет'}
              description={
                filtersDirty
                  ? 'Измените или сбросьте фильтры.'
                  : 'Создайте первую проводку кнопкой «Новая проводка».'
              }
            />
          ) : (
            <DataTable
              columns={[
                {
                  header: 'Дата',
                  accessor: (m) =>
                    new Date(m.posted_at ?? m.created_at).toLocaleDateString('ru-RU'),
                },
                {
                  header: 'Вид',
                  accessor: (m) => (
                    <div>
                      <div className="text-ink">{SUBKIND_LABEL[m.subkind]}</div>
                      <div className="text-[12px] text-muted">{DIRECTION_LABEL[m.direction]}</div>
                    </div>
                  ),
                },
                {
                  header: 'Сумма',
                  align: 'right',
                  className: 'tabular',
                  accessor: (m) => (
                    <span className={m.direction === 'expense' ? 'text-danger' : 'text-ink'}>
                      {money(m.amount, m.direction)}
                    </span>
                  ),
                },
                {
                  header: 'Налог',
                  align: 'right',
                  className: 'tabular',
                  accessor: (m) => (m.tax ? `${m.tax.toLocaleString('ru-RU')} ₽` : '—'),
                },
                { header: 'Инициатор', accessor: (m) => m.initiator_name ?? `№${m.initiator_id}` },
                {
                  header: 'Источник',
                  accessor: (m) =>
                    m.source_label ?? <span className="text-muted">{SOURCE_KIND_LABEL[m.source_kind]}</span>,
                },
                {
                  header: 'Статус',
                  accessor: (m) => <Chip tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Chip>,
                },
                ...(isAdmin
                  ? [
                      {
                        header: '',
                        accessor: (m: (typeof movements)[number]) =>
                          m.status === 'draft' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRow(m.id)
                              }}
                              disabled={deletingId === m.id}
                              aria-label="Удалить проводку"
                              title="Удалить проводку"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null,
                      },
                    ]
                  : []),
              ]}
              rows={movements}
              keyOf={(m) => String(m.id)}
              onRowClick={(m) => setSelectedId(m.id)}
              loading={loading}
              emptyLabel="Проводок пока нет"
            />
          )}
          {listError && <p className="mt-2 text-[12px] text-danger">{listError}</p>}
        </>
      )}

      <CreateMovementModal open={creating} onClose={() => setCreating(false)} />
      <ImportPaymentsModal open={importing} onClose={() => setImporting(false)} />
      <MovementDetailDrawer movement={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
