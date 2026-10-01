import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calculator, Plus, Trash2, Upload, X } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input, Select } from '@/shared/ui/Field'
import { Tabs } from '@/shared/ui/Tabs'
import { DATE_FILTER_LABEL } from '@/shared/lib/dateFilter'
import { AmountFilterMode, useAccountingStore } from '../store'
import { CounterpartiesTab } from '../components/CounterpartiesTab'
import { CounterpartyDrawer } from '../components/CounterpartyDrawer'
import { CounterpartyPicker } from '../components/CounterpartyPicker'
import { CreateMovementModal } from '../components/CreateMovementModal'
import { MoneySummaryTiles } from '../components/MoneySummaryTiles'
import { OverviewTab } from '../components/OverviewTab'
import { ImportStatementModal } from '../components/ImportStatementModal'
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
  STATUS_SORT_ORDER,
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

/** Активный фильтр — снимается по клику на крестик, без отдельной кнопки «Сбросить». */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Chip tone="brand">
      <span className="flex items-center gap-1.5">
        {label}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Убрать фильтр «${label}»`}
          className="text-brand-dark/70 hover:text-danger"
        >
          <X size={12} />
        </button>
      </span>
    </Chip>
  )
}

export function AccountingPage() {
  const movements = useAccountingStore((s) => s.movements)
  const loading = useAccountingStore((s) => s.loading)
  const loadError = useAccountingStore((s) => s.loadError)
  const filters = useAccountingStore((s) => s.filters)
  const load = useAccountingStore((s) => s.load)
  const setFilters = useAccountingStore((s) => s.setFilters)
  const remove = useAccountingStore((s) => s.remove)
  const organizations = useAccountingStore((s) => s.organizations)
  const selectedOrganizationId = useAccountingStore((s) => s.selectedOrganizationId)
  const selectedAccountId = useAccountingStore((s) => s.selectedAccountId)
  const selectOrganization = useAccountingStore((s) => s.selectOrganization)
  const selectAccount = useAccountingStore((s) => s.selectAccount)
  const summary = useAccountingStore((s) => s.summary)
  const summaryLoading = useAccountingStore((s) => s.summaryLoading)
  const counterparties = useAccountingStore((s) => s.counterparties)
  const showCounterparty = useAccountingStore((s) => s.showCounterparty)
  const externalMovement = useAccountingStore((s) => s.externalMovement)
  const openMovementById = useAccountingStore((s) => s.openMovementById)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')

  const [searchParams, setSearchParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const requested = searchParams.get('movement')
    return requested ? Number(requested) : null
  })
  // Вкладки: сводка по обеим организациям, затем вкладка на каждое юрлицо
  // (реестр её счёта), затем прежняя вкладка «Сотрудники» (0081-b).
  const [tab, setTab] = useState<'overview' | 'register' | 'counterparties' | 'salary'>('register')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [customRangeOpen, setCustomRangeOpen] = useState(
    () => Boolean(filters.custom_date_from || filters.custom_date_to),
  )

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

  // Платёж из карточки контрагента может быть с другого счёта — тогда его нет
  // в загруженном реестре и он приходит отдельным запросом (externalMovement).
  const selected =
    movements.find((m) => m.id === selectedId) ??
    (externalMovement && externalMovement.id === selectedId ? externalMovement : null)
  const currentOrganization = organizations.find((o) => o.id === selectedOrganizationId) ?? null
  const accountOptions = (currentOrganization?.accounts ?? []).filter((a) => a.is_active)
  // Сводка приходит целиком (все организации) — берём из неё срез выбранного счёта.
  const accountTotals =
    summary?.organizations
      .find((o) => o.organization_id === selectedOrganizationId)
      ?.accounts.find((a) => a.account_id === selectedAccountId) ?? null
  const filtersDirty =
    filters.direction !== 'all' ||
    filters.subkind !== 'all' ||
    filters.status !== 'all' ||
    filters.source_kind !== 'all' ||
    filters.period !== 'all' ||
    filters.custom_date_from !== '' ||
    filters.custom_date_to !== '' ||
    filters.initiator_id !== 'all' ||
    filters.counterparty_id !== 'all' ||
    filters.amount_mode !== 'all' ||
    filters.tax_mode !== 'all'

  // Список инициаторов для фильтра строится из реально встречающихся
  // инициаторов уже загруженных проводок, а не из полного списка аккаунтов
  // (доступного только admin) — по тому же принципу, что employeeOptions в
  // TasksPage.tsx.
  const initiatorOptions = useMemo(() => {
    const byId = new Map<number, string>()
    for (const m of movements) byId.set(m.initiator_id, m.initiator_name ?? `№${m.initiator_id}`)
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [movements])

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = []
  if (filters.direction !== 'all') {
    activeFilterChips.push({
      key: 'direction',
      label: `Направление: ${DIRECTION_LABEL[filters.direction]}`,
      onRemove: () => setFilters({ direction: 'all' }),
    })
  }
  if (filters.subkind !== 'all') {
    activeFilterChips.push({
      key: 'subkind',
      label: `Вид: ${SUBKIND_LABEL[filters.subkind]}`,
      onRemove: () => setFilters({ subkind: 'all' }),
    })
  }
  if (filters.status !== 'all') {
    activeFilterChips.push({
      key: 'status',
      label: `Статус: ${STATUS_LABEL[filters.status]}`,
      onRemove: () => setFilters({ status: 'all' }),
    })
  }
  if (filters.source_kind !== 'all') {
    activeFilterChips.push({
      key: 'source_kind',
      label: `Источник: ${SOURCE_KIND_LABEL[filters.source_kind]}`,
      onRemove: () => setFilters({ source_kind: 'all' }),
    })
  }
  if (filters.custom_date_from && filters.custom_date_to) {
    activeFilterChips.push({
      key: 'period',
      label: `Период: ${new Date(filters.custom_date_from).toLocaleDateString('ru-RU')} – ${new Date(filters.custom_date_to).toLocaleDateString('ru-RU')}`,
      onRemove: () => {
        setCustomRangeOpen(false)
        setFilters({ custom_date_from: '', custom_date_to: '' })
      },
    })
  } else if (filters.period !== 'all') {
    activeFilterChips.push({
      key: 'period',
      label: `Период: ${DATE_FILTER_LABEL[filters.period]}`,
      onRemove: () => setFilters({ period: 'all' }),
    })
  }
  if (filters.initiator_id !== 'all') {
    const initiator = initiatorOptions.find((i) => i.id === filters.initiator_id)
    activeFilterChips.push({
      key: 'initiator',
      label: `Инициатор: ${initiator?.name ?? `№${filters.initiator_id}`}`,
      onRemove: () => setFilters({ initiator_id: 'all' }),
    })
  }
  if (filters.counterparty_id !== 'all') {
    const counterparty = counterparties.find((c) => c.id === filters.counterparty_id)
    activeFilterChips.push({
      key: 'counterparty',
      label: `Контрагент: ${counterparty?.name ?? `№${filters.counterparty_id}`}`,
      onRemove: () => setFilters({ counterparty_id: 'all' }),
    })
  }
  if (filters.amount_mode !== 'all') {
    activeFilterChips.push({
      key: 'amount',
      label: `Сумма: ${AMOUNT_MODE_LABEL[filters.amount_mode]}`,
      onRemove: () => setFilters({ amount_mode: 'all', amount_from: '', amount_to: '' }),
    })
  }
  if (filters.tax_mode !== 'all') {
    activeFilterChips.push({
      key: 'tax',
      label: `Налог: ${AMOUNT_MODE_LABEL[filters.tax_mode]}`,
      onRemove: () => setFilters({ tax_mode: 'all', tax_from: '', tax_to: '' }),
    })
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Бухгалтерия</h1>
          <p className="mt-1 text-[13px] text-muted">
            {tab === 'register' && currentOrganization
              ? `${currentOrganization.name} — движение денег по выбранному счёту.`
              : 'Движение денежных средств обеих организаций: приход, расход и сальдо по счетам.'}
          </p>
        </div>
        {tab === 'register' && accountOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload size={16} />
              Импорт выписки
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
            { key: 'overview', label: 'Сводка' },
            ...organizations.map((org) => ({ key: `org-${org.id}`, label: org.short_name })),
            { key: 'counterparties', label: 'Контрагенты' },
            { key: 'salary', label: 'Сотрудники' },
          ]}
          activeKey={tab === 'register' ? `org-${selectedOrganizationId}` : tab}
          onChange={(key) => {
            if (key === 'overview' || key === 'salary' || key === 'counterparties') {
              setTab(key)
              return
            }
            setTab('register')
            selectOrganization(Number(key.replace('org-', '')))
          }}
        />
      </div>

      {tab === 'overview' ? (
        <OverviewTab />
      ) : tab === 'counterparties' ? (
        <CounterpartiesTab />
      ) : tab === 'salary' ? (
        <SalaryTab />
      ) : accountOptions.length === 0 ? (
        <EmptyState
          icon={<Calculator size={24} />}
          title="У организации нет действующих счетов"
          description="Заведите счёт, чтобы видеть по нему приход и расход."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted">Счёт:</span>
            {accountOptions.length <= 3 ? (
              accountOptions.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => selectAccount(account.id)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                    account.id === selectedAccountId
                      ? 'border-brand bg-brand/10 text-brand-dark'
                      : 'border-border text-muted hover:text-ink'
                  }`}
                >
                  {account.name}
                </button>
              ))
            ) : (
              <Select
                className="w-full sm:w-64"
                value={String(selectedAccountId ?? '')}
                onChange={(e) => selectAccount(Number(e.target.value))}
              >
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <MoneySummaryTiles
            totals={accountTotals}
            loading={summaryLoading}
            hint="Проведённые проводки этого счёта за выбранный период"
          />

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
            <Select
              className="w-full sm:w-44"
              value={String(filters.initiator_id)}
              onChange={(e) =>
                setFilters({ initiator_id: e.target.value === 'all' ? 'all' : Number(e.target.value) })
              }
            >
              <option value="all">Любой инициатор</option>
              {initiatorOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <div className="w-full sm:w-64">
              <CounterpartyPicker
                value={filters.counterparty_id === 'all' ? null : filters.counterparty_id}
                onChange={(id) => setFilters({ counterparty_id: id ?? 'all' })}
                allowCreate={false}
              />
            </div>
            {customRangeOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="w-full sm:w-auto"
                  value={filters.custom_date_from}
                  onChange={(e) => setFilters({ custom_date_from: e.target.value })}
                />
                <span className="text-muted">—</span>
                <Input
                  type="date"
                  className="w-full sm:w-auto"
                  value={filters.custom_date_to}
                  onChange={(e) => setFilters({ custom_date_to: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomRangeOpen(false)
                    setFilters({ custom_date_from: '', custom_date_to: '' })
                  }}
                >
                  Пресеты периода
                </Button>
              </div>
            ) : (
              <>
                <DateFilterSelect value={filters.period} onChange={(period) => setFilters({ period })} />
                <Button variant="ghost" size="sm" onClick={() => setCustomRangeOpen(true)}>
                  Свой диапазон
                </Button>
              </>
            )}
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
          </div>
          {loadError && <p className="mb-3 text-[12px] text-danger">{loadError}</p>}

          {activeFilterChips.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((f) => (
                <FilterChip key={f.key} label={f.label} onRemove={f.onRemove} />
              ))}
            </div>
          )}

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
                  sortValue: (m) => new Date(m.posted_at ?? m.created_at),
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
                  sortValue: (m) => (m.direction === 'expense' ? -m.amount : m.amount),
                },
                {
                  header: 'Налог',
                  align: 'right',
                  className: 'tabular',
                  accessor: (m) => (m.tax ? `${m.tax.toLocaleString('ru-RU')} ₽` : '—'),
                  sortValue: (m) => m.tax,
                },
                {
                  header: 'Инициатор',
                  accessor: (m) => m.initiator_name ?? `№${m.initiator_id}`,
                  sortValue: (m) => m.initiator_name ?? String(m.initiator_id),
                },
                {
                  header: 'Контрагент',
                  accessor: (m) =>
                    m.counterparty_id && m.counterparty_name ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          // не открываем карточку проводки: клик адресный
                          e.stopPropagation()
                          void showCounterparty(m.counterparty_id!)
                        }}
                        className="text-brand-dark underline-offset-2 hover:underline"
                      >
                        {m.counterparty_name}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    ),
                },
                {
                  header: 'Источник',
                  accessor: (m) =>
                    m.source_label ?? <span className="text-muted">{SOURCE_KIND_LABEL[m.source_kind]}</span>,
                },
                {
                  header: 'Статус',
                  accessor: (m) => <Chip tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Chip>,
                  sortValue: (m) => STATUS_SORT_ORDER[m.status],
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
      <ImportStatementModal open={importing} onClose={() => setImporting(false)} />
      <MovementDetailDrawer movement={selected} onClose={() => setSelectedId(null)} />
      <CounterpartyDrawer
        onOpenMovement={(id) => {
          void showCounterparty(null)
          void openMovementById(id)
          setSelectedId(id)
        }}
      />
    </div>
  )
}
