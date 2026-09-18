import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Trash2, Truck } from 'lucide-react'
import * as accountingApi from '@/accounting/api'
import {
  SUPPLIER_ORDER_STATUS_LABEL,
  SUPPLIER_ORDER_STATUS_TONE,
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderStatus,
} from '@/accounting/types'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Field, Input } from '@/shared/ui/Field'

// Статус только вперёд, как у проводок (0011-d, статус-степпер — 0039).
const NEXT_STATUS: Record<SupplierOrderStatus, SupplierOrderStatus | null> = {
  ordered: 'in_transit',
  in_transit: 'received',
  received: null,
}

function money(amount: number): string {
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

const EMPTY_ITEM: SupplierOrderItem = { material: '', category: null, quantity: 1, unit_price: 0 }

/**
 * Карточка заказов у поставщика (0011-d завёл сущность и статусную машину
 * исполнения; список/оплата — 0011-f; раскладка по позициям и статус-степпер — 0039).
 */
export function SupplierOrdersSection({
  supplierId,
  totalOrdered,
  totalPaid,
  balance,
}: {
  supplierId: number
  totalOrdered: number
  totalPaid: number
  balance: number
}) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SupplierOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null)
  const [payResult, setPayResult] = useState<Record<number, { movementId: number } | { error: string }>>({})

  async function load() {
    setLoading(true)
    try {
      const [fetchedOrders, payments] = await Promise.all([
        accountingApi.listSupplierOrders(supplierId),
        // Уже существующая (не отменённая) оплата заказа — иначе после
        // перезагрузки страницы кнопка «Оплатить» снова предлагается для уже
        // оплаченного заказа и повторный клик получает 409 от бэка.
        accountingApi.listMovements({ subkind: 'supply_payment' }),
      ])
      setOrders(fetchedOrders)
      const orderIds = new Set(fetchedOrders.map((o) => o.id))
      const existing: Record<number, { movementId: number }> = {}
      for (const m of payments) {
        if (m.supply_id != null && orderIds.has(m.supply_id) && m.status !== 'cancelled' && !(m.supply_id in existing)) {
          existing[m.supply_id] = { movementId: m.id }
        }
      }
      setPayResult(existing)
      setError(null)
    } catch (e) {
      setError(reasonOf(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  async function pay(order: SupplierOrder) {
    setPayingId(order.id)
    try {
      const movement = await accountingApi.paySupplierOrder(order.id)
      setPayResult((prev) => ({ ...prev, [order.id]: { movementId: movement.id } }))
    } catch (e) {
      setPayResult((prev) => ({ ...prev, [order.id]: { error: reasonOf(e) } }))
    } finally {
      setPayingId(null)
    }
  }

  async function advanceStatus(order: SupplierOrder) {
    const to = NEXT_STATUS[order.status]
    if (!to) return
    setStatusBusyId(order.id)
    try {
      await accountingApi.changeSupplierOrderStatus(order.id, to)
      await load()
    } catch (e) {
      setError(reasonOf(e))
    } finally {
      setStatusBusyId(null)
    }
  }

  async function remove(order: SupplierOrder) {
    if (!window.confirm('Удалить заказ? Отменить нельзя.')) return
    try {
      await accountingApi.deleteSupplierOrder(order.id)
      await load()
    } catch (e) {
      setError(reasonOf(e))
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-ink">Заказы у поставщика</div>
        <Button size="sm" variant="secondary" onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> Заказ
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-md bg-surface-muted p-3.5">
          <div className="text-[12px] text-muted">Заказано</div>
          <div className="mt-1 text-[18px] font-medium tabular text-ink">{money(totalOrdered)}</div>
        </div>
        <div className="rounded-md bg-surface-muted p-3.5">
          <div className="text-[12px] text-muted">Оплачено</div>
          <div className="mt-1 text-[18px] font-medium tabular text-ink">{money(totalPaid)}</div>
        </div>
        <div className="rounded-md bg-surface-muted p-3.5">
          <div className="text-[12px] text-muted">Баланс</div>
          <div className={`mt-1 text-[18px] font-medium tabular ${balance > 0 ? 'text-danger' : 'text-ink'}`}>
            {money(balance)}
          </div>
        </div>
      </div>

      {creating && (
        <SupplierOrderForm
          supplierId={supplierId}
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            load()
          }}
        />
      )}

      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {!loading && orders.length === 0 && !creating && (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
            Заказов пока нет
          </p>
        )}
        {orders.map((order) => {
          const result = payResult[order.id]
          const expanded = expandedId === order.id
          const nextStatus = NEXT_STATUS[order.status]
          return (
            <div key={order.id} className="rounded-md border border-border px-3 py-2.5">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  aria-label={expanded ? 'Свернуть заказ' : 'Показать позиции заказа'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted hover:text-ink"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left" onClick={() => setExpandedId(expanded ? null : order.id)}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={SUPPLIER_ORDER_STATUS_TONE[order.status]}>
                          {SUPPLIER_ORDER_STATUS_LABEL[order.status]}
                        </Chip>
                        {order.expected_at && (
                          <span className="text-[12px] text-muted">
                            срок: {new Date(order.expected_at).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[12px] text-muted">
                        <Truck size={13} />
                        {order.items.map((it) => `${it.material} × ${it.quantity}`).join(', ')}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[13px] font-medium text-ink tabular">{money(order.total_cost)}</span>
                      {order.status === 'ordered' && (
                        <button
                          type="button"
                          onClick={() => remove(order)}
                          aria-label="Удалить заказ"
                          className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-2 overflow-x-auto rounded-md bg-surface-muted/60 p-2.5">
                      <table className="w-full min-w-[24rem] text-[12px]">
                        <thead>
                          <tr className="text-muted">
                            <th className="pb-1 text-left font-normal">Материал</th>
                            <th className="pb-1 text-left font-normal">Категория</th>
                            <th className="pb-1 text-right font-normal">Кол-во</th>
                            <th className="pb-1 text-right font-normal">Цена</th>
                            <th className="pb-1 text-right font-normal">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((it, i) => (
                            <tr key={i} className="text-ink">
                              <td className="py-0.5">{it.material}</td>
                              <td className="py-0.5 text-muted">{it.category || '—'}</td>
                              <td className="py-0.5 text-right tabular">{it.quantity}</td>
                              <td className="py-0.5 text-right tabular">{money(it.unit_price)}</td>
                              <td className="py-0.5 text-right tabular">{money(it.quantity * it.unit_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {order.received_at && (
                        <div className="mt-2 text-[12px] text-muted">
                          принята: {new Date(order.received_at).toLocaleDateString('ru-RU')}
                        </div>
                      )}
                      <div className="mt-2 text-[12px] text-muted">
                        Комментарий: {order.comment || '—'}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {nextStatus && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={statusBusyId === order.id}
                        onClick={() => advanceStatus(order)}
                      >
                        {statusBusyId === order.id
                          ? 'Обновление…'
                          : `Отметить «${SUPPLIER_ORDER_STATUS_LABEL[nextStatus]}»`}
                      </Button>
                    )}
                    {!result && (
                      <Button size="sm" disabled={payingId === order.id} onClick={() => pay(order)}>
                        {payingId === order.id ? 'Оплата…' : 'Оплатить поставку'}
                      </Button>
                    )}
                    {result && 'movementId' in result && (
                      <button
                        type="button"
                        onClick={() => navigate(`/accounting?movement=${result.movementId}`)}
                        className="text-[12px] text-brand hover:text-brand-dark"
                      >
                        Проводка создана в «Бухгалтерии» →
                      </button>
                    )}
                    {result && 'error' in result && <span className="text-[12px] text-danger">{result.error}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SupplierOrderForm({
  supplierId,
  onCancel,
  onDone,
}: {
  supplierId: number
  onCancel: () => void
  onDone: () => void
}) {
  const [items, setItems] = useState<SupplierOrderItem[]>([{ ...EMPTY_ITEM }])
  const [expectedAt, setExpectedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = items.every((it) => it.material.trim() && it.quantity > 0 && it.unit_price > 0)

  function patchItem(index: number, patch: Partial<SupplierOrderItem>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  async function submit() {
    if (!valid) {
      setError('У каждой позиции нужен материал, количество и цена больше нуля')
      return
    }
    setSaving(true)
    try {
      await accountingApi.createSupplierOrder({
        supplier_id: supplierId,
        items: items.map((it) => ({
          material: it.material.trim(),
          category: it.category?.trim() || null,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
        expected_at: expectedAt || null,
      })
      onDone()
    } catch (e) {
      setError(reasonOf(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-surface-muted/40 p-3">
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Input
              value={item.material}
              onChange={(e) => patchItem(index, { material: e.target.value })}
              placeholder="Материал"
              className="min-w-[10rem] flex-1"
            />
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => patchItem(index, { quantity: Number(e.target.value) })}
              placeholder="Кол-во"
              className="w-24"
            />
            <Input
              type="number"
              value={item.unit_price}
              onChange={(e) => patchItem(index, { unit_price: Number(e.target.value) })}
              placeholder="Цена, ₽"
              className="w-28"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                aria-label="Удалить позицию"
                className="rounded-md p-2 text-muted hover:bg-surface-muted hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { ...EMPTY_ITEM }])}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-brand hover:text-brand-dark"
        >
          <Plus size={14} /> Позиция
        </button>
      </div>

      <div className="mt-3 max-w-[12rem]">
        <Field label="Ожидаемый срок поставки">
          <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
        </Field>
      </div>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button size="sm" onClick={submit} disabled={!valid || saving}>
          {saving ? 'Сохранение…' : 'Заказать'}
        </Button>
      </div>
    </div>
  )
}
