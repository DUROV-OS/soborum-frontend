import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { Link, Navigate, useBeforeUnload, useSearchParams } from 'react-router-dom'
import { useQueryChoice } from '@/shared/lib/useQueryChoice'
import { lastPurchaseEntry, usePurchaseSelection, usePurchaseViewState } from './PurchaseViewState'
import { purchaseJournalTab, visibleWorkflows } from '@/shared/workflows'
import { useAuthStore } from '@/auth/store'
import { Plus, PackageCheck, Archive, Pencil, Trash2 } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Input, Select, Textarea, Field } from '@/shared/ui/Field'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { PurchaseReturnEditor, PurchaseReturnsPanel } from './PurchaseReturns'
import { AutomaticReview } from './AutomaticReview'
import { ReceiptEditor } from './ReceiptEditor'
import { PurchaseDocumentFiles } from './OrderFiles'
import { PurchaseDocumentSections } from './PurchaseDocumentSections'
import { OrderDocumentMap, type LinkedDocuments } from './OrderDocumentMap'
import { OrderMaterialLink, OrderPositions } from './OrderPositions'
import { JournalAmount, JournalControls, JournalTotals, emptyFilters, journalDate, journalMoney, type JournalSummary } from './JournalControls'

type Item = {
  material: string
  quantity: number
  unit_price: number
  received_quantity: number
  warehouse_material_id: number | null
  unit: string
  stock_tracked: boolean
}
type DraftItem = Item & { key: string }
type EditorStatus = { dirty: boolean; busy: boolean }
type Order = {
  has_receipts?: boolean
  id: number
  number: string
  supplier_id: number
  supplier_name: string
  counterparty_id?: number | null
  organization_id?: number | null
  organization_name?: string | null
  source_id?: string | null
  items: Item[]
  total_cost: number
  opening_paid: number
  paid: number
  pending_payment: number
  available_payment: number
  unpaid: number
  received_amount?: string
  invoice_totals?: { currency: string; amount: string }[]
  invoice_missing_currency?: boolean
  net_total?: number
  return_credit?: number
  refund_received?: number
  overpaid?: number
  version: number
  archived: boolean
  status: string
  source_state: string | null
  comment: string | null
  expected_at: string | null
  created_at: string
  currency: string
}
type Receipt = {
  id: number
  number: string
  source_id: string | null
  order_id: number | null
  supplier_id: number
  occurred_at: string
  status: string
  via_supplier_invoice?: boolean
  note: string
  counterparty_id?: number | null
  supplier_name?: string | null
  warehouse?: string | null
  organization_name?: string | null
  amount?: string | null
  paid?: string | null
  currency?: string | null
  incoming_date?: string | null
  incoming_number?: string | null
  status_label?: string | null
  lines: { title: string; unit: string; quantity: number; unit_price: number }[]
}
type Material = { id: number; title: string; warehouse: string; unit: string; price: number }
type Catalog = {
  organizations?: { id: number; name: string }[]
  suppliers: { id: number; name: string; archived: boolean }[]
  materials: Material[]
  accounts: { id: number; name: string }[]
}
const money = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
function receiptMoney(value: string | number | null | undefined, currency?: string | null) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return currency ? journalMoney(Number(value), currency) : Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
const qty = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const orderColumnsKey = 'durov.purchasing.columns.v2'
const registerLink = 'font-medium text-brand-dark underline underline-offset-2 hover:text-brand'
const status: Record<string, string> = {
  ordered: 'Заказано',
  in_transit: 'Частично получено / в пути',
  received: 'Получено',
  posted: 'Проведена',
  draft: 'Черновик',
}
const call = <T,>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown) =>
  apiRequest<T>({ section: 'purchasing', path, method, body })

export function PurchasingPage() {
  const [params] = useSearchParams()
  const hasAccess = useAuthStore(state => state.hasAccess)
  const userId = useAuthStore(state => state.current?.id)
  const tab = purchaseJournalTab(params)
  if (!params.size) {
    const entries = visibleWorkflows(hasAccess).find(group => group.id === 'purchasing')?.entries ?? []
    const destination = lastPurchaseEntry(entries, userId)
    if (destination) return <Navigate to={destination.to} replace />
  }
  const title = tab === 'orders' ? 'Заказы поставщикам' : tab === 'receipts' ? 'Приёмки' : 'Возвраты поставщикам'
  return <PurchasingJournal key={tab} tab={tab} title={title} />
}

function PurchasingJournal({ tab, title }: { tab: 'orders' | 'receipts' | 'returns'; title: string }) {
  const [params, setParams] = useSearchParams()
  const requestedOrder = Number(params.get('order'))
  const orderId = tab === 'orders' && Number.isSafeInteger(requestedOrder) && requestedOrder > 0 ? requestedOrder : null
  const requestedReceipt = Number(params.get('receipt'))
  const receiptId = tab === 'receipts' && Number.isSafeInteger(requestedReceipt) && requestedReceipt > 0 ? requestedReceipt : null
  const createReceipt = params.get('receive') === '1'
  useEffect(() => {
    let active = true
    if (createReceipt) setReceiving({})
    if (receiptId) {
      document.getElementById('main-content')?.scrollTo({ top: 0 })
      setError('')
      call<Receipt>(`/receipts/${receiptId}`).then(row => { if (active) setSelectedReceipt(row) })
        .catch(error => { if (active) setError(error.message) })
    }
    return () => { active = false }
  }, [createReceipt, receiptId])
  const scope = tab === 'orders' ? 'supplier-orders' : 'receipts'
  const selection = usePurchaseSelection(tab === 'returns' ? null : scope)
  const [catalog, setCatalog] = useState<Catalog>({ suppliers: [], materials: [], accounts: [] })
  const [filters, setFilters] = usePurchaseViewState(scope, 'filters', emptyFilters)
  const [filtersOpen, setFiltersOpen] = usePurchaseViewState(scope, 'filters-open', false)
  const [cardTab, setCardTab] = useQueryChoice('section', ['positions', 'documents', 'files', 'control'], 'positions')
  const [linkedDocuments, setLinkedDocuments] = useState<LinkedDocuments | null>(null)
  const [documentError, setDocumentError] = useState('')
  const documentGeneration = useRef(0)
  const columnNames = ['Дата', 'Контрагент', 'Организация', 'Сумма', 'Выставлено счетов', 'Оплачено', 'Принято', 'Ожидаемая поставка', 'Комментарий']
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const current = localStorage.getItem(orderColumnsKey)
      const saved = JSON.parse(current ?? localStorage.getItem('durov.purchasing.columns') ?? 'null')
      if (Array.isArray(saved)) {
        const renamed: Record<string, string> = {'Поставщик': 'Контрагент', 'Не оплачено': 'Выставлено счетов', 'Приёмка': 'Принято'}
        const columns = saved.map(name => renamed[name] ?? name).filter(name => columnNames.includes(name))
        return current ? columns : [...new Set([...columns, 'Организация'])]
      }
    } catch { /* Use defaults when browser storage is unavailable. */ }
    return columnNames.filter(v => v !== 'Комментарий')
  })
  const [archive, setArchive] = usePurchaseViewState(scope, 'archive', 'active'),
    [query, setQuery] = usePurchaseViewState(scope, 'search', ''),
    [offset, setOffset] = usePurchaseViewState(scope, 'offset', 0)
  const [orders, setOrders] = useState<{ total: number; items: Order[]; summary?: JournalSummary[] }>({ total: 0, items: [] }),
    [receipts, setReceipts] = useState<{ total: number; items: Receipt[] }>({ total: 0, items: [] })
  const [loadedOrder, setSelected] = useState<Order | null>(null),
    [loadedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const selected = loadedOrder?.id === orderId ? loadedOrder : null
  const selectedReceipt = loadedReceipt?.id === receiptId ? loadedReceipt : null
  const [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const [returningReceiptId, setReturningReceiptId] = useState<number | null>(null)
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ row?: Order } | null>(null),
    [receiving, setReceiving] = useState<{ row?: Order } | null>(null),
    [paying, setPaying] = useState<Order | null>(null)
  const editorStatus = useRef<EditorStatus>({ dirty: false, busy: false })
  const editingPositions = !!editing?.row
  const confirmLeaveOrder = useCallback(() => !editingPositions || (!editorStatus.current.busy &&
    (!editorStatus.current.dirty || window.confirm('Закрыть заказ без сохранения изменений?'))), [editingPositions])
  useEffect(() => {
    if (!editingPositions) return
    const beforeNavigate = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element) || !event.target.closest('#main-navigation a, [data-section-navigation] a')) return
      if (!confirmLeaveOrder()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('click', beforeNavigate, true)
    return () => document.removeEventListener('click', beforeNavigate, true)
  }, [editingPositions, confirmLeaveOrder])
  useBeforeUnload(event => {
    if (editingPositions && (editorStatus.current.dirty || editorStatus.current.busy)) event.preventDefault()
  })
  const closeOrder = () => {
    if (confirmLeaveOrder()) setParams({ tab: 'orders' }, { replace: true })
  }
  const orderSaved = (order: Order) => {
    setEditing(null)
    setSelected(order)
    setParams({ tab: 'orders', order: String(order.id) }, { replace: order.id === orderId })
    setRevision(value => value + 1)
    if (order.id === orderId) void loadDocuments(order.id)
  }
  const accounting = useAccessLevel('accounting'),
    warehouse = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(accounting, 'edit'),
    canReceive = accessLevelAtLeast(warehouse, 'edit'),
    canArchive = accessLevelAtLeast(accounting, 'full')
  useEffect(() => {
    call<Catalog>('/catalog')
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    if (orderId || receiptId) return
    if (tab === 'returns') {
      setLoading(false)
      return
    }
    let current = true
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ query, offset: String(offset) })
      Object.entries(filters).forEach(([key, value]) => { if (value && (tab === 'orders' || !['payment', 'delivery'].includes(key))) params.set(key, value) })
      const request =
        tab === 'orders'
          ? call<typeof orders>(
              `/orders?archive=${archive}&${params}`,
            )
          : call<typeof receipts>(`/receipts?${params}`)
      request
        .then((r) => {
          if (current) {
            if (offset > 0 && offset >= r.total) {
              setOffset(Math.max(0, Math.floor((r.total - 1) / 50) * 50))
              return
            }
            if (tab === 'orders') setOrders(r as typeof orders)
            else setReceipts(r as typeof receipts)
          }
        })
        .catch((e) => {
          if (current) setError(e.message)
        })
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 150)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [tab, orderId, receiptId, archive, query, offset, revision, filters, setOffset])

  const loadDocuments = async (id: number) => {
    const generation = ++documentGeneration.current
    setLinkedDocuments(null)
    setDocumentError('')
    try {
      const result = await call<LinkedDocuments>(`/orders/${id}/documents`)
      if (generation === documentGeneration.current) setLinkedDocuments(result)
    } catch (e) {
      if (generation === documentGeneration.current) setDocumentError((e as Error).message)
    }
  }
  useEffect(() => {
    setEditing(null)
    setError('')
    if (!orderId) {
      setSelected(null)
      return
    }
    document.getElementById('main-content')?.scrollTo({ top: 0 })
    let current = true
    call<Order>(`/orders/${orderId}`).then(row => { if (current) setSelected(row) })
      .catch(e => { if (current) setError(e.message) })
    void loadDocuments(orderId)
    return () => { current = false; documentGeneration.current++ }
  }, [orderId])

  const reload = async (id?: number) => {
    setRevision(v => v + 1)
    if (id) { setSelected(await call<Order>(`/orders/${id}`)); await loadDocuments(id) }
  }
  const open = (row: Order) => setParams({ tab: 'orders', order: String(row.id) })
  const openReceipt = (row: Receipt) => {
    setParams({ tab: 'receipts', receipt: String(row.id) })
  }
  const orderColumns: DataTableColumn<Order>[] = [
    { header: '№', accessor: r => <button className="whitespace-nowrap font-medium text-accent hover:underline" onClick={e => { e.stopPropagation(); open(r) }}>№ {r.number}</button> },
    { header: 'Дата', accessor: r => journalDate(r.created_at), className: 'whitespace-nowrap' },
    { header: 'Контрагент', accessor: r => r.counterparty_id
      ? <Link to={`/suppliers?counterparty=${r.counterparty_id}`} onClick={event => event.stopPropagation()}
        className={registerLink}>{r.supplier_name}</Link>
      : r.supplier_name, className: 'min-w-[180px]' },
    { header: 'Организация', accessor: r => r.organization_name || '—', className: 'whitespace-nowrap' },
    { header: 'Сумма', accessor: r => <JournalAmount value={r.net_total ?? r.total_cost} target={r.total_cost}
      currency={r.currency} label="Сумма после возвратов" />, align: 'right', className: 'whitespace-nowrap tabular-nums' },
    { header: 'Выставлено счетов', accessor: r => (
      <div className="space-y-1">
        {r.invoice_totals?.map(({ currency, amount }) => <JournalAmount key={currency} value={Number(amount)}
          target={currency === r.currency ? r.total_cost : undefined} currency={currency} label="Выставлено счетов" />)}
        {r.invoice_missing_currency && <div className="text-xs text-muted">Уточните валюту</div>}
        {!r.invoice_totals?.length && !r.invoice_missing_currency && <JournalAmount value={null}
          target={r.invoice_totals ? r.total_cost : undefined} currency={r.currency} label="Выставлено счетов" />}
      </div>
    ), align: 'right', className: 'whitespace-nowrap tabular-nums' },
    { header: 'Оплачено', accessor: r => <JournalAmount value={r.paid} target={r.net_total ?? r.total_cost}
      currency={r.currency} label="Оплачено" />, align: 'right', className: 'whitespace-nowrap tabular-nums' },
    { header: 'Принято', accessor: r => <JournalAmount value={r.received_amount === undefined ? null : Number(r.received_amount)}
      target={r.received_amount === undefined ? undefined : r.total_cost} currency={r.currency} label="Принято" />,
      align: 'right', className: 'whitespace-nowrap tabular-nums' },
    { header: 'Ожидаемая поставка', accessor: r => journalDate(r.expected_at), className: 'whitespace-nowrap' },
    { header: 'Комментарий', accessor: r => <span className="line-clamp-2" title={r.comment || ''}>{r.comment || '—'}</span>, className: 'min-w-[180px] max-w-xs' },
  ]
  const receiptColumns: DataTableColumn<Receipt>[] = [
    { header: 'Номер', className: 'whitespace-nowrap', accessor: r => (
      <button type="button" className={registerLink} onClick={event => {
        event.stopPropagation()
        openReceipt(r)
      }}>{r.number}</button>
    ) },
    { header: 'Дата', accessor: r => journalDate(r.occurred_at), className: 'whitespace-nowrap' },
    { header: 'На склад', accessor: r => r.warehouse || '—', className: 'min-w-32' },
    { header: 'Контрагент', className: 'min-w-[170px]', accessor: r => {
      const name = r.supplier_name || catalog.suppliers.find(s => s.id === r.supplier_id)?.name || '—'
      return r.counterparty_id ? (
        <Link to={`/suppliers?counterparty=${r.counterparty_id}`} className={registerLink}
          onClick={event => event.stopPropagation()}>{name}</Link>
      ) : name
    } },
    { header: 'Организация', accessor: r => r.organization_name || '—', className: 'min-w-32' },
    { header: 'Сумма', align: 'right', className: 'whitespace-nowrap tabular-nums', accessor: r => (
      receiptMoney(r.amount ?? r.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0), r.currency)
    ) },
    { header: 'Оплачено', align: 'right', className: 'whitespace-nowrap tabular-nums', accessor: r => receiptMoney(r.paid, r.currency) },
    { header: 'Входящая дата', accessor: r => journalDate(r.incoming_date), className: 'whitespace-nowrap' },
    { header: 'Входящий номер', accessor: r => r.incoming_number || '—', className: 'whitespace-nowrap' },
    { header: 'Статус', accessor: r => <Chip tone={r.status === 'posted' ? 'success' : 'neutral'}>{r.status_label || status[r.status] || r.status}</Chip>, className: 'whitespace-nowrap' },
    { header: 'Комментарий', accessor: r => <span className="line-clamp-2" title={r.note || ''}>{r.note || '—'}</span>, className: 'min-w-[180px] max-w-xs' },
  ]
  const total = tab === 'orders' ? orders.total : receipts.total
  const linkedCount = linkedDocuments &&
    (linkedDocuments.receipts.length + (linkedDocuments.invoices?.length ?? 0) +
      linkedDocuments.payments.length + linkedDocuments.returns.length + (linkedDocuments.factures?.length ?? 0))
  return (
    <div>
      {!orderId && !receiptId && <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">Заказы поставщикам, частичные поставки, остатки и оплата.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReceive && (
            <Button variant="secondary" onClick={() => setReceiving({})}>
              <PackageCheck size={16} />
              Приёмка без заказа
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setEditing({})}>
              <Plus size={16} />
              Заказ поставщику
            </Button>
          )}
        </div>
      </div>}
      {error && (
        <div role="alert" className="mb-4 rounded-md bg-danger-bg p-3 text-sm text-danger">
          {error}
          <button className="ml-3 underline" onClick={() => setError('')}>
            Закрыть
          </button>
        </div>
      )}
      {!orderId && !receiptId && <>
      {tab !== 'returns' && <JournalControls expanded={filtersOpen} onExpanded={setFiltersOpen} query={query} onQuery={v => { setQuery(v); setOffset(0) }} filters={filters}
        onFilters={v => { setFilters(v); setOffset(0) }} archive={archive} onArchive={v => { setArchive(v); setOffset(0) }} suppliers={catalog.suppliers} receipts={tab === 'receipts'} />}
      {tab === 'orders' && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">Найдено заказов: {loading ? '…' : orders.total}</span>
        <details className="relative"><summary className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2">Колонки</summary>
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-border bg-surface p-3 shadow-xl">
            {columnNames.map(name => <label className="flex gap-2 py-2" key={name}><input type="checkbox" checked={visibleColumns.includes(name)} onChange={e => {
              const next = e.target.checked ? [...visibleColumns, name] : visibleColumns.filter(v => v !== name)
              setVisibleColumns(next); try { localStorage.setItem(orderColumnsKey, JSON.stringify(next)) } catch { /* Selection still applies to this session. */ }
            }} />{name}</label>)}
          </div>
        </details>
      </div>}
      {tab === 'returns' ? (
        <PurchaseReturnsPanel
          catalog={catalog}
          canEdit={canEdit}
          canArchive={canArchive}
          canCancel={canArchive && accessLevelAtLeast(warehouse, 'full')}
        />
      ) : tab === 'orders' ? (
        <DataTable
          selection={selection}
          rows={orders.items}
          keyOf={(r) => String(r.id)}
          onRowClick={open}
          loading={loading}
          columns={orderColumns.filter(c => c.header === '№' || visibleColumns.includes(c.header))}
          emptyLabel="Заказы не найдены. Измените фильтр или создайте заказ поставщику."
        />
      ) : (
        <DataTable
          selection={selection}
          rows={receipts.items}
          keyOf={(r) => String(r.id)}
          onRowClick={openReceipt}
          loading={loading}
          columns={receiptColumns}
          emptyLabel="Приёмки не найдены"
        />
      )}
      {tab === 'orders' && <JournalTotals rows={orders.summary || []} loading={loading} />}
      {tab !== 'returns' && (
        <div className="mt-4 flex justify-between gap-3 text-sm">
          <span className="text-muted">
            {total ? offset + 1 : 0}–{Math.min(offset + 50, total)} из {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!offset || loading}
              onClick={() => setOffset((v) => Math.max(0, v - 50))}
            >
              Назад
            </Button>
            <Button
              variant="secondary"
              disabled={offset + 50 >= total || loading}
              onClick={() => setOffset((v) => v + 50)}
            >
              Далее
            </Button>
          </div>
        </div>
      )}
      </>}
      {orderId && <section aria-label={'Заказ № ' + (selected?.number ?? orderId)} className="min-w-0 space-y-5 text-sm">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-medium text-ink">Заказ № {selected?.number ?? orderId}</h1>
            {selected && <p className="mt-1 text-muted">{[selected.supplier_name, selected.organization_name].filter(Boolean).join(' · ')}</p>}
          </div>
          <Button variant="secondary" onClick={closeOrder}>К списку заказов</Button>
        </header>
        {!selected && !error && <p role="status" className="text-muted">Загружаем заказ…</p>}
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              {!editingPositions && canReceive && !selected.archived && selected.status !== 'received' && (
                <Button onClick={() => setReceiving({ row: selected })}>Принять материалы</Button>
              )}
              {!editingPositions && canEdit && !selected.archived && (
                <Button variant="secondary" onClick={() => { setCardTab('positions'); setEditing({ row: selected }) }}>
                  <Pencil size={14} />
                  Изменить
                </Button>
              )}
              {!editingPositions && canEdit && !selected.archived && selected.available_payment > 0 && (
                <Button variant="secondary" onClick={() => setPaying(selected)}>
                  Оплата частями
                </Button>
              )}
              {!editingPositions && canArchive && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await call(`/orders/${selected.id}/archive`, 'POST', {
                        version: selected.version,
                        archived: !selected.archived,
                      })
                      await reload(selected.id)
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                >
                  <Archive size={14} />
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
            </div>
            <div className="grid gap-4 rounded-xl border border-border bg-surface-muted p-4 md:grid-cols-[1fr_1fr_auto]">
              <dl className="grid content-start grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted">Контрагент</dt><dd className="font-medium">{selected.supplier_name}</dd>
                <dt className="text-muted">Организация</dt><dd>{selected.organization_name || '—'}</dd>
                <dt className="text-muted">Дата заказа</dt><dd>{journalDate(selected.created_at)}</dd>
                <dt className="text-muted">Поставка</dt><dd>{journalDate(selected.expected_at)}</dd>
              </dl>
              <div>
              <p className="font-medium">{status[selected.status]}</p>
              {selected.source_state && <p className="text-xs text-muted">Статус источника: {selected.source_state}</p>}
              <p className="mt-2">
                Оплачено: {money(selected.paid)} · На согласовании: {money(selected.pending_payment)}
              </p>
              <p>Осталось оплатить: {money(selected.unpaid)}</p>
              {!!selected.return_credit && (
                <p>
                  Возвращено поставщику: {money(selected.return_credit)} · Стоимость после возвратов:{' '}
                  {money(selected.net_total || 0)}
                </p>
              )}
              {!!selected.refund_received && <p>Получено обратно: {money(selected.refund_received)}</p>}
              {!!selected.overpaid && <p>Переплата: {money(selected.overpaid)}</p>}
              </div>
              <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <p className="text-xs text-muted">Сумма заказа</p>
                <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums">{journalMoney(selected.total_cost, selected.currency)}</p>
              </div>
            </div>
            <Tabs activeKey={cardTab} onChange={setCardTab} tabs={[
              { key: 'positions', label: 'Позиции' },
              { key: 'documents', label: 'Связанные документы' + (linkedCount ? ' · ' + linkedCount : '') },
              { key: 'files', label: 'Файлы' },
              { key: 'control', label: 'Проверка закупки' },
            ]} />
            {editing?.row && <div hidden={cardTab !== 'positions'}>
              <OrderEditor key={editing.row.id} row={editing.row} catalog={catalog}
                editorStatus={editorStatus} onClose={() => setEditing(null)} onSaved={orderSaved} />
            </div>}
            {cardTab === 'positions' && !editingPositions && <>
              <OrderPositions key={selected.id} orderId={selected.id} version={selected.version}
                currency={selected.currency} materialIds={selected.items.map(item => item.warehouse_material_id)}
                canOpenMaterial={accessLevelAtLeast(warehouse, 'view')} />
              {selected.comment && <p className="mt-4 whitespace-pre-wrap">{selected.comment}</p>}
            </>}
            {cardTab === 'files' && <PurchaseDocumentFiles key={selected.id} resource="orders" id={selected.id} canUpload={canEdit && !selected.archived} />}
            {cardTab === 'control' && <AutomaticReview key={selected.id} orderId={selected.id} orderVersion={selected.version} canEdit={canEdit} />}
            {cardTab === 'documents' && (
              documentError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-danger">
                <span>{documentError}</span>
                <Button size="sm" variant="secondary" onClick={() => void loadDocuments(selected.id)}>Повторить</Button>
              </div> : linkedDocuments ? <OrderDocumentMap
                order={{
                  id: 'order-' + selected.id, number: selected.number, date: selected.created_at,
                  amount: selected.total_cost, currency: selected.currency,
                  status: selected.source_state || status[selected.status],
                  href: '/purchasing?tab=orders&order=' + selected.id,
                }}
                documents={linkedDocuments} confirmLeave={confirmLeaveOrder}
              /> : <p role="status" className="text-muted">Загружаем связанные документы…</p>
            )}
            <Link className="text-accent underline" to="/accounting" onClick={event => { if (!confirmLeaveOrder()) event.preventDefault() }}>
              Открыть бухгалтерию
            </Link>
          </div>
        )}
      </section>}
      {receiptId && <section aria-label={`Приёмка № ${selectedReceipt?.number ?? receiptId}`} className="min-w-0 space-y-5 text-sm">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-medium text-ink">Приёмка № {selectedReceipt?.number ?? receiptId}</h1>
            {selectedReceipt && <p className="mt-1 text-muted">{[
              selectedReceipt.supplier_name ?? catalog.suppliers.find(supplier => supplier.id === selectedReceipt.supplier_id)?.name,
              selectedReceipt.organization_name, selectedReceipt.warehouse,
            ].filter(Boolean).join(' · ')}</p>}
          </div>
          <Button variant="secondary" onClick={() => {
            setError(''); setSelectedReceipt(null); setParams({ tab: 'receipts' }, { replace: true })
          }}>К списку приёмок</Button>
        </header>
        {!selectedReceipt && !error && <p role="status" className="text-muted">Загружаем приёмку…</p>}
        {selectedReceipt && (
          <div className="space-y-4">
            <p className="text-muted">
              {journalDate(selectedReceipt.occurred_at)} · {selectedReceipt.status_label || status[selectedReceipt.status] || selectedReceipt.status}
            </p>
            <div className="flex flex-wrap gap-2">
              {canEdit && selectedReceipt.status === 'posted' && <Button variant="secondary" onClick={() => setEditingReceiptId(selectedReceipt.id)}>Изменить приёмку</Button>}
              {canEdit && canReceive && selectedReceipt.status === 'posted' && (
                <Button variant="secondary" onClick={() => setReturningReceiptId(selectedReceipt.id)}>Вернуть поставщику</Button>
              )}
            </div>
            <PurchaseDocumentSections key={selectedReceipt.id} id={selectedReceipt.id} resource="receipts"
              canUpload={canEdit} positions={<>
                <DataTable rows={selectedReceipt.lines} keyOf={line => String(selectedReceipt.lines.indexOf(line))}
                  columns={[
                    { header: '№', accessor: line => selectedReceipt.lines.indexOf(line) + 1 },
                    { header: 'Наименование', accessor: line => line.title },
                    { header: 'Количество', accessor: line => qty(line.quantity) + ' ' + line.unit },
                    { header: 'Цена', align: 'right', accessor: line => receiptMoney(line.unit_price, selectedReceipt.currency) },
                    { header: 'Сумма', align: 'right', accessor: line => receiptMoney(Number(line.quantity) * Number(line.unit_price), selectedReceipt.currency) },
                  ]} emptyLabel="В приёмке нет позиций" />
                {selectedReceipt.note && <p className="whitespace-pre-wrap">{selectedReceipt.note}</p>}
              </>} />
          </div>
        )}
      </section>}
      {editingReceiptId && <ReceiptEditor id={editingReceiptId} onClose={() => setEditingReceiptId(null)} onSaved={async () => {
        const updated = await call<Receipt>(`/receipts/${editingReceiptId}`)
        setSelectedReceipt(updated); setEditingReceiptId(null); setRevision(v => v + 1)
      }} />}
      {returningReceiptId && (
        <PurchaseReturnEditor
          receiptId={returningReceiptId}
          catalog={catalog}
          onClose={() => setReturningReceiptId(null)}
          onSaved={() => {
            setReturningReceiptId(null)
            setSelectedReceipt(null)
            setParams({ tab: 'returns' })
          }}
        />
      )}
      {editing && !editing.row && (
        <OrderEditor catalog={catalog} onClose={() => setEditing(null)} onSaved={orderSaved} />
      )}
      {receiving && (
        <ReceiveEditor
          row={receiving.row}
          catalog={catalog}
          onClose={() => setReceiving(null)}
          onSaved={async () => {
            const id = receiving.row?.id
            setReceiving(null)
            await reload(id)
          }}
        />
      )}
      {paying && (
        <PaymentEditor
          row={paying}
          catalog={catalog}
          onClose={() => setPaying(null)}
          onSaved={async () => {
            const id = paying.id
            setPaying(null)
            await reload(id)
          }}
        />
      )}
    </div>
  )
}

function MaterialPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const matches = catalog.materials.filter(
    (m) =>
      m.id === value ||
      !search ||
      `${m.title} ${m.warehouse}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
  const selected = catalog.materials.find((m) => m.id === value)
  const visible = [...(selected ? [selected] : []), ...matches.filter((m) => m.id !== value).slice(0, 80)]
  return (
    <div className="space-y-1">
      <Input
        aria-label="Найти материал"
        placeholder="Найти материал…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select
        aria-label="Складской материал"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value="">Выберите материал</option>
        {visible.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title} · {m.warehouse} · {m.unit}
          </option>
        ))}
      </Select>
    </div>
  )
}

function OrderEditor({
  row,
  catalog,
  editorStatus,
  onClose,
  onSaved,
}: {
  row?: Order
  catalog: Catalog
  editorStatus?: MutableRefObject<EditorStatus>
  onClose: () => void
  onSaved: (order: Order) => void
}) {
  const canOpenMaterial = accessLevelAtLeast(useAccessLevel('warehouse'), 'view')
  const newItem = (): DraftItem => ({
    key: crypto.randomUUID(), material: '', quantity: 1, unit_price: 0,
    received_quantity: 0, warehouse_material_id: null, unit: '', stock_tracked: true,
  })
  const [supplier, setSupplier] = useState(String(row?.supplier_id || '')),
    [items, setItems] = useState<DraftItem[]>(() => row
      ? row.items.map(item => ({ ...item, key: crypto.randomUUID() }))
      : [newItem()])
  const [picking, setPicking] = useState<string | null>(() => row ? null : items[0].key)
  const originalCount = row?.items.length ?? 0
  const [date, setDate] = useState(row?.expected_at || ''),
    [organization, setOrganization] = useState(String(row?.organization_id || '')),
    [number, setNumber] = useState(row?.number || ''),
    [reason, setReason] = useState(''),
    [comment, setComment] = useState(row?.comment || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const lines = items.map(({ key, ...item }) => item)
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const dirty = !!row && (JSON.stringify(lines) !== JSON.stringify(row.items) || reason !== '' ||
    supplier !== String(row.supplier_id) || organization !== String(row.organization_id || '') ||
    number !== row.number || date !== (row.expected_at || '') || comment !== (row.comment || ''))
  useEffect(() => {
    if (!editorStatus) return
    editorStatus.current = { dirty, busy }
    return () => { editorStatus.current = { dirty: false, busy: false } }
  }, [editorStatus, dirty, busy])
  const valid = !!supplier && (!!row || !!organization) && !!items.length &&
    (!row || (!!number.trim() && !!reason.trim())) && items.every(item =>
      item.material.trim() && Number.isFinite(item.quantity) && item.quantity > 0 &&
      item.quantity >= (item.received_quantity || 0) && Number.isFinite(item.unit_price) && item.unit_price > 0)
  const patch = (key: string, data: Partial<Item>) =>
    setItems(current => current.map(item => item.key === key ? { ...item, ...data } : item))
  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      const body = { supplier_id: Number(supplier), organization_id: Number(organization) || undefined, items: lines, expected_at: date || null, comment }
      const result = await call<Order>(
        row ? `/orders/${row.id}?version=${row.version}` : '/orders',
        row ? 'PATCH' : 'POST',
        row ? { ...body, number, reason } : body,
      )
      onSaved(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const footer = <>
    <Button variant="secondary" disabled={busy} onClick={onClose}>Отмена</Button>
    <Button disabled={busy || !valid} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить заказ'}</Button>
  </>
  const fields = <fieldset disabled={busy} className="grid min-w-0 gap-3 md:grid-cols-2">
        {row && <Field label="Номер заказа"><Input aria-label="Номер заказа" value={number} maxLength={255} onChange={e => setNumber(e.target.value)} /></Field>}
        <Field label="Организация">
          <Select aria-label="Организация" value={organization} required={!row}
            disabled={!!row && (!!row.source_id || !!row.has_receipts || row.paid > 0 || row.pending_payment > 0)}
            onChange={e => setOrganization(e.target.value)}>
            <option value="">Выберите организацию</option>
            {row?.organization_id && !catalog.organizations?.some(org => org.id === row.organization_id) &&
              <option value={row.organization_id}>{row.organization_name}</option>}
            {catalog.organizations?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </Select>
        </Field>
        <Field label="Поставщик">
          <Select
            aria-label="Поставщик"
            value={supplier}
            disabled={!!row && (!!row.has_receipts || row.paid > 0 || row.pending_payment > 0)}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Выберите поставщика</option>
            {catalog.suppliers
              .filter((s) => !s.archived || String(s.id) === supplier)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
      <Field label="Ожидаемая поставка">
        <Input aria-label="Ожидаемая поставка" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div className="md:col-span-2"><Field label="Комментарий">
        <Textarea value={comment} onChange={e => setComment(e.target.value)} />
      </Field></div>
    </fieldset>
  const currency = row?.currency || 'RUB'
  const table = <section className="space-y-3" aria-label="Редактирование позиций">
    {row?.has_receipts && <p className="text-sm text-muted">
      После приёмки состав исходных строк фиксируется. Можно уточнить количество и цену заказа или добавить товар.
    </p>}
    <DataTable rows={items.map((item, index) => ({ ...item, index }))} keyOf={item => item.key}
      emptyLabel="Добавьте позицию в заказ."
      columns={[
        { header: '№', accessor: item => item.index + 1 },
        { header: 'Наименование', className: 'min-w-[230px]', accessor: item => {
          const locked = !!row?.has_receipts && item.index < originalCount
          if (locked) return <div className="space-y-1">
            <OrderMaterialLink materialId={item.warehouse_material_id} name={item.material}
              amount={item.quantity} unit={item.unit} canOpenMaterial={canOpenMaterial} />
            <p className="text-xs text-muted">Принято {qty(item.received_quantity || 0)} {item.unit}</p>
          </div>
          return <div className="space-y-2">
            <button type="button" disabled={busy} aria-expanded={picking === item.key}
              className="text-left font-medium text-brand-dark underline underline-offset-2 hover:text-brand"
              onClick={() => setPicking(picking === item.key ? null : item.key)}>
              {item.material || 'Выбрать товар'}
            </button>
            {picking === item.key && <>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={!item.stock_tracked} disabled={busy} onChange={e => patch(item.key, {
                  stock_tracked: !e.target.checked, warehouse_material_id: null, material: '', unit: '', unit_price: 0,
                })} />
                Услуга без складского учёта
              </label>
              {item.stock_tracked ? <MaterialPicker catalog={catalog} value={item.warehouse_material_id} onChange={id => {
                const material = catalog.materials.find(entry => entry.id === id)
                patch(item.key, { warehouse_material_id: id, material: material?.title || '',
                  unit: material?.unit || '', unit_price: material?.price || 0 })
                if (material) setPicking(null)
              }} /> : <Input aria-label="Название услуги" placeholder="Название услуги" value={item.material}
                onChange={e => patch(item.key, { material: e.target.value })} />}
            </>}
          </div>
        } },
        { header: 'Количество', className: 'w-28', align: 'right', accessor: item => <div>
          <OrderNumberCell label="Количество заказа" value={item.quantity} disabled={busy}
            onChange={quantity => patch(item.key, { quantity })} />
          {item.unit && <span className="text-xs text-muted">{item.unit}</span>}
        </div> },
        { header: 'Цена', className: 'w-32', align: 'right', accessor: item => <OrderNumberCell
          label="Цена заказа" value={item.unit_price} disabled={busy} onChange={unit_price => patch(item.key, { unit_price })} /> },
        { header: 'Сумма', className: 'w-36', align: 'right', accessor: item => <OrderNumberCell label="Сумма позиции"
          value={Number((item.quantity * item.unit_price).toFixed(2))}
          disabled={busy || !(item.quantity > 0)} onChange={sum => patch(item.key, { unit_price: sum / item.quantity })} /> },
        { header: '', accessor: item => <Button type="button" variant="ghost" size="sm"
          aria-label={'Удалить позицию ' + (item.index + 1)} title="Удалить позицию"
          disabled={busy || (!!row?.has_receipts && item.index < originalCount)}
          onClick={() => {
            if (picking === item.key) setPicking(null)
            setItems(current => current.filter(line => line.key !== item.key))
          }}><Trash2 size={16} /></Button> },
      ]}
    />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" disabled={busy} onClick={() => {
        const item = newItem()
        setItems(current => [...current, item])
        setPicking(item.key)
      }}><Plus size={16} />Добавить позицию</Button>
      <p className="font-medium tabular-nums">Итого: {Number.isFinite(total) ? journalMoney(total, currency) : '—'}</p>
    </div>
  </section>
  const feedback = error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-danger">{error}</p>
  if (!row) return <Modal open onClose={() => { if (!busy) onClose() }} title="Заказ поставщику" width="max-w-4xl" footer={footer}>
    <div className="space-y-4">{feedback}{fields}{table}</div>
  </Modal>
  return <div className="space-y-4">
    {feedback}
    {table}
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer font-medium text-ink">Реквизиты заказа</summary>
      <div className="pt-3">{fields}</div>
    </details>
    <Field label="Причина изменения" required><Input aria-label="Причина изменения заказа" maxLength={1000}
      value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></Field>
    <div className="flex justify-end gap-2">{footer}</div>
  </div>
}

function OrderNumberCell({ label, value, disabled, onChange }: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [input, setInput] = useState<string | null>(null)
  return <Input aria-label={label} inputMode="decimal" disabled={disabled} className="min-w-[5.25rem] text-right tabular-nums"
    value={input ?? (Number.isFinite(value) ? String(value) : '')}
    onChange={e => {
      const text = e.target.value
      setInput(text)
      const parsed = text.trim().replace(',', '.')
      onChange(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(parsed) ? Number(parsed) : NaN)
    }}
    onBlur={() => setInput(null)} />
}

function ReceiveEditor({
  row,
  catalog,
  onClose,
  onSaved,
}: {
  row?: Order
  catalog: Catalog
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [supplier, setSupplier] = useState(String(row?.supplier_id || ''))
  const [lines, setLines] = useState(
    row
      ? row.items
          .map((item, index) => ({
            order_line: index,
            material_id: item.warehouse_material_id,
            quantity: String(Math.max(0, item.quantity - (item.received_quantity || 0))),
            unit_price: String(item.unit_price),
            title: item.material,
            stock_tracked: item.stock_tracked,
          }))
          .filter((l) => Number(l.quantity) > 0)
      : [
          {
            order_line: null as number | null,
            material_id: null as number | null,
            quantity: '1',
            unit_price: '0',
            title: '',
            stock_tracked: true,
          },
        ],
  )
  const [date, setDate] = useState(() => {
      const d = new Date()
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const patch = (i: number, data: Partial<(typeof lines)[number]>) =>
    setLines((v) => v.map((line, n) => (n === i ? { ...line, ...data } : line)))
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await call('/receipts', 'POST', {
        request_id: requestId,
        order_id: row?.id || null,
        supplier_id: Number(supplier),
        version: row?.version || null,
        occurred_at: new Date(date).toISOString(),
        note,
        lines: lines
          .filter((l) => Number(l.quantity) > 0)
          .map(({ order_line, material_id, quantity, unit_price }) => ({
            order_line,
            material_id,
            quantity,
            unit_price,
          })),
      })
      await onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Приёмка заказа № ' + row.number : 'Приёмка без заказа'}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !supplier || !lines.some((l) => Number(l.quantity) > 0)} onClick={save}>
            Провести приёмку
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <p className="text-sm text-muted">
          Проведение увеличит остатки и обновит среднюю закупочную стоимость материалов. Для частичной
          поставки укажите фактически полученное количество; нулевые строки будут пропущены.
        </p>
        <Field label="Поставщик">
          <Select
            aria-label="Поставщик приёмки"
            value={supplier}
            disabled={!!row}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Выберите поставщика</option>
            {catalog.suppliers
              .filter((s) => !s.archived || String(s.id) === supplier)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </Field>
        {lines.map((l, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border p-3">
            {l.title && <p className="font-medium">{l.title}</p>}
            {l.stock_tracked && (!row || !row.items[l.order_line || 0].warehouse_material_id) ? (
              <MaterialPicker
                catalog={catalog}
                value={l.material_id}
                onChange={(id) => {
                  const m = catalog.materials.find((m) => m.id === id)
                  patch(i, { material_id: id, title: m?.title || '', unit_price: String(m?.price || 0) })
                }}
              />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Фактически получено">
                <Input
                  aria-label="Количество приёмки"
                  type="number"
                  step="any"
                  min="0"
                  value={l.quantity}
                  onChange={(e) => patch(i, { quantity: e.target.value })}
                />
              </Field>
              <Field label="Цена за единицу, ₽">
                <Input
                  aria-label="Цена приёмки"
                  type="number"
                  step="any"
                  min="0"
                  value={l.unit_price}
                  onChange={(e) => patch(i, { unit_price: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        {!row && (
          <Button
            variant="secondary"
            onClick={() =>
              setLines((v) => [
                ...v,
                {
                  order_line: null,
                  material_id: null,
                  quantity: '1',
                  unit_price: '0',
                  title: '',
                  stock_tracked: true,
                },
              ])
            }
          >
            Добавить позицию
          </Button>
        )}
        <Field label="Дата и время">
          <Input
            aria-label="Дата приёмки"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Основание / комментарий">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function PaymentEditor({
  row,
  catalog,
  onClose,
  onSaved,
}: {
  row: Order
  catalog: Catalog
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [requestId] = useState(() => crypto.randomUUID())
  const [amount, setAmount] = useState(String(row.available_payment)),
    [account, setAccount] = useState(String(catalog.accounts[0]?.id || '')),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await call(`/orders/${row.id}/payments`, 'POST', {
        request_id: requestId,
        amount,
        account_id: Number(account),
      })
      await onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={'Оплата заказа № ' + row.number}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={busy || !account || Number(amount) <= 0 || Number(amount) > row.available_payment}
            onClick={save}
          >
            На согласование
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <p className="text-sm">
          Можно подготовить платёж до {money(row.available_payment)}. Проведённые оплаты и суммы на
          согласовании уже учтены.
        </p>
        <Field label="Сумма, ₽">
          <Input
            aria-label="Сумма платежа"
            type="number"
            step="0.01"
            min="0.01"
            max={row.available_payment}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Счёт организации">
          <Select aria-label="Счёт платежа" value={account} onChange={(e) => setAccount(e.target.value)}>
            {catalog.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-muted">
          В бухгалтерии появится платёж на согласование. Деньги будут учтены как оплаченные после его
          проведения.
        </p>
      </div>
    </Modal>
  )
}
