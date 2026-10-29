import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, PackageCheck, Archive, Pencil } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea, Field } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { PurchaseReturnEditor, PurchaseReturnsPanel } from './PurchaseReturns'
import { AutomaticReview } from './AutomaticReview'

type Item = {
  material: string
  quantity: number
  unit_price: number
  received_quantity: number
  warehouse_material_id: number | null
  unit: string
  stock_tracked: boolean
}
type Order = {
  id: number
  number: string
  supplier_id: number
  supplier_name: string
  items: Item[]
  total_cost: number
  opening_paid: number
  paid: number
  pending_payment: number
  available_payment: number
  unpaid: number
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
}
type Receipt = {
  id: number
  number: string
  source_id: string | null
  order_id: number | null
  supplier_id: number
  occurred_at: string
  status: string
  note: string
  lines: { title: string; unit: string; quantity: number; unit_price: number }[]
}
type Material = { id: number; title: string; warehouse: string; unit: string; price: number }
type Catalog = {
  suppliers: { id: number; name: string; archived: boolean }[]
  materials: Material[]
  accounts: { id: number; name: string }[]
}
const money = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
const qty = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
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
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('receive') === '1') setReceiving({})
    const id = new URLSearchParams(window.location.search).get('order')
    if (id && /^\d+$/.test(id))
      call<Order>(`/orders/${id}`)
        .then(open)
        .catch((e) => setError(e.message))
  }, [])
  const [catalog, setCatalog] = useState<Catalog>({ suppliers: [], materials: [], accounts: [] })
  const [tab, setTab] = useState(
      new URLSearchParams(window.location.search).has('return') ? 'returns' : 'orders',
    ),
    [archive, setArchive] = useState('active'),
    [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0)
  const [orders, setOrders] = useState<{ total: number; items: Order[] }>({ total: 0, items: [] }),
    [receipts, setReceipts] = useState<{ total: number; items: Receipt[] }>({ total: 0, items: [] })
  const [selected, setSelected] = useState<Order | null>(null),
    [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [orderReceipts, setOrderReceipts] = useState<Receipt[]>([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const [returningReceiptId, setReturningReceiptId] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ row?: Order } | null>(null),
    [receiving, setReceiving] = useState<{ row?: Order } | null>(null),
    [paying, setPaying] = useState<Order | null>(null)
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
    if (tab === 'returns') {
      setLoading(false)
      return
    }
    let current = true
    setLoading(true)
    const timer = setTimeout(() => {
      const request =
        tab === 'orders'
          ? call<typeof orders>(
              `/orders?archive=${archive}&query=${encodeURIComponent(query)}&offset=${offset}`,
            )
          : call<typeof receipts>(`/receipts?offset=${offset}`)
      request
        .then((r) => {
          if (current) {
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
  }, [tab, archive, query, offset, revision])
  const reload = async (id?: number) => {
    setRevision((v) => v + 1)
    if (id) {
      const row = await call<Order>(`/orders/${id}`)
      setSelected(row)
      setOrderReceipts((await call<{ items: Receipt[] }>(`/receipts?order_id=${id}`)).items)
    }
  }
  const open = (row: Order) => {
    setSelected(row)
    setOrderReceipts([])
    call<{ items: Receipt[] }>(`/receipts?order_id=${row.id}`)
      .then((r) => setOrderReceipts(r.items))
      .catch((e) => setError(e.message))
  }
  const total = tab === 'orders' ? orders.total : receipts.total
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">Закупки и приёмки</h1>
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
      </div>
      {error && (
        <div role="alert" className="mb-4 rounded-md bg-danger-bg p-3 text-sm text-danger">
          {error}
          <button className="ml-3 underline" onClick={() => setError('')}>
            Закрыть
          </button>
        </div>
      )}
      <Tabs
        activeKey={tab}
        onChange={(v) => {
          setTab(v)
          setOffset(0)
        }}
        tabs={[
          { key: 'orders', label: 'Заказы поставщикам' },
          { key: 'receipts', label: 'Приёмки' },
          { key: 'returns', label: 'Возвраты поставщикам' },
        ]}
      />
      {tab === 'orders' && (
        <div className="my-4 flex flex-wrap gap-3">
          <Input
            aria-label="Поиск закупок"
            placeholder="Поставщик, номер, материал…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOffset(0)
            }}
          />
          <Select
            aria-label="Архив заказов"
            value={archive}
            onChange={(e) => {
              setArchive(e.target.value)
              setOffset(0)
            }}
          >
            <option value="active">Действующие</option>
            <option value="archived">Архивные</option>
            <option value="all">Все</option>
          </Select>
        </div>
      )}
      {tab === 'returns' ? (
        <PurchaseReturnsPanel
          catalog={catalog}
          canEdit={canEdit}
          canArchive={canArchive}
          canCancel={canArchive && accessLevelAtLeast(warehouse, 'full')}
        />
      ) : tab === 'orders' ? (
        <DataTable
          rows={orders.items}
          keyOf={(r) => String(r.id)}
          onRowClick={open}
          loading={loading}
          columns={[
            { header: 'Заказ', accessor: (r) => '№ ' + r.number },
            { header: 'Поставщик', accessor: (r) => r.supplier_name },
            { header: 'Сумма', accessor: (r) => money(r.total_cost) },
            { header: 'Приёмка', accessor: (r) => status[r.status] || r.status },
            { header: 'Оплачено', accessor: (r) => money(r.paid) },
            { header: 'Не оплачено', accessor: (r) => money(r.unpaid) },
          ]}
        />
      ) : (
        <DataTable
          rows={receipts.items}
          keyOf={(r) => String(r.id)}
          onRowClick={setSelectedReceipt}
          loading={loading}
          columns={[
            { header: 'Приёмка', accessor: (r) => '№ ' + r.number },
            { header: 'Дата', accessor: (r) => new Date(r.occurred_at).toLocaleDateString('ru-RU') },
            {
              header: 'Поставщик',
              accessor: (r) => catalog.suppliers.find((s) => s.id === r.supplier_id)?.name || '—',
            },
            {
              header: 'Сумма',
              accessor: (r) => money(r.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)),
            },
            { header: 'Статус', accessor: (r) => status[r.status] || r.status },
          ]}
        />
      )}
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
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? 'Заказ № ' + selected.number : ''}
        subtitle={selected?.supplier_name}
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              {canReceive && !selected.archived && selected.status !== 'received' && (
                <Button onClick={() => setReceiving({ row: selected })}>Принять материалы</Button>
              )}
              {canEdit && !selected.archived && selected.status === 'ordered' && (
                <Button variant="secondary" onClick={() => setEditing({ row: selected })}>
                  <Pencil size={14} />
                  Изменить
                </Button>
              )}
              {canEdit && !selected.archived && selected.available_payment > 0 && (
                <Button variant="secondary" onClick={() => setPaying(selected)}>
                  Оплата частями
                </Button>
              )}
              {canArchive && (
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
            <div className="rounded-md bg-surface-muted p-4">
              <p className="text-lg font-medium">{money(selected.total_cost)}</p>
              <p className="mt-1">{status[selected.status]}</p>
              {selected.source_state && (
                <p className="text-muted">Статус источника: {selected.source_state}</p>
              )}
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
              {selected.expected_at && (
                <p>Плановая поставка: {new Date(selected.expected_at).toLocaleDateString('ru-RU')}</p>
              )}
            </div>
            <DataTable
              rows={selected.items}
              keyOf={(r) => String(selected.items.indexOf(r))}
              columns={[
                { header: 'Материал', accessor: (r) => r.material },
                { header: 'Заказано', accessor: (r) => qty(r.quantity) + ' ' + r.unit },
                { header: 'Получено', accessor: (r) => qty(r.received_quantity || 0) },
                { header: 'Цена', accessor: (r) => money(r.unit_price) },
              ]}
            />
            <AutomaticReview orderId={selected.id} />
            {selected.comment && <p className="whitespace-pre-wrap">{selected.comment}</p>}
            <h3 className="font-medium">Приёмки по заказу</h3>
            {orderReceipts.length ? (
              orderReceipts.map((r) => (
                <button
                  className="block text-accent underline"
                  key={r.id}
                  onClick={() => {
                    setSelected(null)
                    setSelectedReceipt(r)
                  }}
                >
                  № {r.number} · {new Date(r.occurred_at).toLocaleDateString('ru-RU')}
                </button>
              ))
            ) : (
              <p className="text-muted">Связанных документов пока нет.</p>
            )}
            <Link className="text-accent underline" to="/accounting">
              Открыть бухгалтерию
            </Link>
          </div>
        )}
      </Drawer>
      <Drawer
        open={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title={selectedReceipt ? 'Приёмка № ' + selectedReceipt.number : ''}
      >
        {selectedReceipt && (
          <div className="space-y-4 text-sm">
            <p>
              {new Date(selectedReceipt.occurred_at).toLocaleString('ru-RU')} ·{' '}
              {status[selectedReceipt.status]}
            </p>
            <p>{catalog.suppliers.find((s) => s.id === selectedReceipt.supplier_id)?.name}</p>
            {canEdit && canReceive && selectedReceipt.status === 'posted' && (
              <Button onClick={() => setReturningReceiptId(selectedReceipt.id)}>Вернуть поставщику</Button>
            )}
            {selectedReceipt.source_id && (
              <p className="text-muted">
                Документ перенесён из МоегоСклада. Остатки по нему учтены при переносе.
              </p>
            )}
            <DataTable
              rows={selectedReceipt.lines}
              keyOf={(r) => String(selectedReceipt.lines.indexOf(r))}
              columns={[
                { header: 'Материал', accessor: (r) => r.title },
                { header: 'Количество', accessor: (r) => qty(r.quantity) + ' ' + r.unit },
                { header: 'Цена', accessor: (r) => money(r.unit_price) },
              ]}
            />
            <p className="whitespace-pre-wrap">{selectedReceipt.note}</p>
          </div>
        )}
      </Drawer>
      {returningReceiptId && (
        <PurchaseReturnEditor
          receiptId={returningReceiptId}
          catalog={catalog}
          onClose={() => setReturningReceiptId(null)}
          onSaved={() => {
            setReturningReceiptId(null)
            setSelectedReceipt(null)
            setTab('returns')
            setRevision((v) => v + 1)
          }}
        />
      )}
      {editing && (
        <OrderEditor
          row={editing.row}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={async (id) => {
            setEditing(null)
            await reload(id)
          }}
        />
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
  onClose,
  onSaved,
}: {
  row?: Order
  catalog: Catalog
  onClose: () => void
  onSaved: (id: number) => Promise<void>
}) {
  const [supplier, setSupplier] = useState(String(row?.supplier_id || '')),
    [items, setItems] = useState<Item[]>(
      row?.items || [
        {
          material: '',
          quantity: 1,
          unit_price: 0,
          received_quantity: 0,
          warehouse_material_id: null,
          unit: '',
          stock_tracked: true,
        },
      ],
    )
  const [date, setDate] = useState(row?.expected_at || ''),
    [comment, setComment] = useState(row?.comment || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const patch = (index: number, data: Partial<Item>) =>
    setItems((v) => v.map((item, i) => (i === index ? { ...item, ...data } : item)))
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const body = { supplier_id: Number(supplier), items, expected_at: date || null, comment }
      const result = await call<Order>(
        row ? `/orders/${row.id}?version=${row.version}` : '/orders',
        row ? 'PATCH' : 'POST',
        row ? { items, expected_at: date || null, comment } : body,
      )
      await onSaved(result.id)
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
      title={row ? 'Изменить заказ' : 'Заказ поставщику'}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !supplier || !items.length} onClick={save}>
            Сохранить заказ
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
        <Field label="Поставщик">
          <Select
            aria-label="Поставщик"
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
        {items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border p-3">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={!item.stock_tracked}
                onChange={(e) => patch(i, { stock_tracked: !e.target.checked, warehouse_material_id: null })}
              />
              Услуга без складского учёта
            </label>
            {item.stock_tracked ? (
              <MaterialPicker
                catalog={catalog}
                value={item.warehouse_material_id}
                onChange={(id) => {
                  const m = catalog.materials.find((m) => m.id === id)
                  patch(i, {
                    warehouse_material_id: id,
                    material: m?.title || '',
                    unit: m?.unit || '',
                    unit_price: m?.price || 0,
                  })
                }}
              />
            ) : (
              <Input
                aria-label="Название услуги"
                value={item.material}
                placeholder="Название услуги"
                onChange={(e) => patch(i, { material: e.target.value })}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Количество">
                <Input
                  aria-label="Количество заказа"
                  type="number"
                  min="0.000001"
                  step="any"
                  value={item.quantity}
                  onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Цена за единицу, ₽">
                <Input
                  aria-label="Цена заказа"
                  type="number"
                  min="0"
                  step="any"
                  value={item.unit_price}
                  onChange={(e) => patch(i, { unit_price: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={items.length === 1}
              onClick={() => setItems((v) => v.filter((_, n) => i !== n))}
            >
              Убрать позицию
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          onClick={() =>
            setItems((v) => [
              ...v,
              {
                material: '',
                quantity: 1,
                unit_price: 0,
                received_quantity: 0,
                warehouse_material_id: null,
                unit: '',
                stock_tracked: true,
              },
            ])
          }
        >
          Добавить позицию
        </Button>
        <p className="font-medium">
          Итого: {money(items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0))}
        </p>
        <Field label="Ожидаемая поставка">
          <Input
            aria-label="Ожидаемая поставка"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Комментарий">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
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

