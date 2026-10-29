import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea, Field } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { Chip } from '@/shared/ui/Chip'
import { localInputToIso, localNowInput } from '@/warehouse/components/OperationLinesEditor'
import type { Catalog, Order, Shipment, Line, SalesEvent } from './types'

const call = <T,>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown) =>
  apiRequest<T>({ section: 'sales', path, method, body })
const qty = (n: number | string) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const money = (n: number | string, currency = 'RUB') =>
  Number(n).toLocaleString('ru-RU', { style: 'currency', currency })
const number = (s: string) => Number(s.replace(',', '.'))
const labels: Record<string, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждён',
  posted: 'Проведена',
  cancelled: 'Отменён',
  waiting: 'Ожидает отгрузки',
  partial: 'Частично отгружен',
  complete: 'Отгружен',
}
const eventLabels: Record<string, string> = {
  order_created: 'Заказ создан',
  order_edited: 'Заказ изменён',
  order_confirmed: 'Заказ подтверждён',
  order_cancelled: 'Заказ отменён',
  order_archived: 'Заказ в архиве',
  order_restored: 'Заказ восстановлен',
  shipment_created: 'Черновик отгрузки создан',
  shipment_posted: 'Отгрузка проведена',
  shipment_cancelled: 'Отгрузка отменена',
  shipment_archived: 'Отгрузка в архиве',
  shipment_restored: 'Отгрузка восстановлена',
}
const message = (e: unknown) => (e instanceof Error ? e.message : 'Не удалось выполнить действие')

export function SalesPage() {
  const postKeys = useRef<Record<string, string>>({})
  const [params, setParams] = useSearchParams()
  const level = useAccessLevel('sales'),
    stockLevel = useAccessLevel('warehouse')
  const edit = accessLevelAtLeast(level, 'edit'),
    full = accessLevelAtLeast(level, 'full')
  const stockEdit = accessLevelAtLeast(stockLevel, 'edit'),
    stockFull = accessLevelAtLeast(stockLevel, 'full')
  const [tab, setTab] = useState(params.has('shipment') ? 'shipments' : 'orders'),
    [archive, setArchive] = useState('active'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0)
  const [catalog, setCatalog] = useState<Catalog>({ counterparties: [], organizations: [], materials: [] })
  const [orders, setOrders] = useState<{ total: number; items: Order[] }>({ total: 0, items: [] }),
    [shipments, setShipments] = useState<{ total: number; items: Shipment[] }>({ total: 0, items: [] })
  const [selected, setSelected] = useState<Order | null>(null),
    [selectedShip, setSelectedShip] = useState<Shipment | null>(null)
  const [editing, setEditing] = useState<Order | true | null>(null),
    [shipping, setShipping] = useState<Order | null>(null)
  const [cancel, setCancel] = useState<{ kind: 'orders' | 'shipments'; row: Order | Shipment } | null>(null)
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    call<Catalog>('/catalog')
      .then((r) => {
        if (current) setCatalog(r)
      })
      .catch((e) => {
        if (current) setError(message(e))
      })
    return () => {
      current = false
    }
  }, [revision])
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    call<{ total: number; items: Order[] | Shipment[] }>(
      `/${tab}?archive=${archive}&query=${encodeURIComponent(query)}&offset=${page * 50}`,
    )
      .then((r) => {
        if (current) {
          if (tab === 'orders') setOrders(r as typeof orders)
          else setShipments(r as typeof shipments)
        }
      })
      .catch((e) => {
        if (current) setError(message(e))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [tab, archive, query, page, revision])
  useEffect(() => {
    let current = true
    const oid = params.get('order'),
      sid = params.get('shipment')
    if (oid && /^\d+$/.test(oid))
      call<Order>('/orders/' + oid)
        .then((r) => {
          if (current) {
            setSelected(r)
            setSelectedShip(null)
            if (params.get('ship') === '1' && edit) setShipping(r)
          }
        })
        .catch((e) => {
          if (current) setError(message(e))
        })
    else if (sid && /^\d+$/.test(sid))
      call<Shipment>('/shipments/' + sid)
        .then((r) => {
          if (current) {
            setSelectedShip(r)
            setSelected(null)
          }
        })
        .catch((e) => {
          if (current) setError(message(e))
        })
    return () => {
      current = false
    }
  }, [params, edit])
  function refresh() {
    setRevision((v) => v + 1)
  }
  async function openOrder(row: Order) {
    setSelectedShip(null)
    setSelected(row)
    try {
      setSelected(await call<Order>('/orders/' + row.id))
    } catch (e) {
      setError(message(e))
    }
  }
  async function openShip(row: Shipment) {
    setSelected(null)
    setSelectedShip(row)
    try {
      setSelectedShip(await call<Shipment>('/shipments/' + row.id))
    } catch (e) {
      setError(message(e))
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      refresh()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  function close() {
    setSelected(null)
    setSelectedShip(null)
    setParams({})
  }
  const total = tab === 'orders' ? orders.total : shipments.total
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Заказы и отгрузки</h1>
          <p className="mt-1 text-sm text-muted">
            Покупатели, товары и услуги, исполнение заказов и история выдачи.
          </p>
        </div>
        {edit && <Button onClick={() => setEditing(true)}>Новый заказ</Button>}
      </div>
      <Tabs
        tabs={[
          { key: 'orders', label: 'Заказы покупателей' },
          { key: 'shipments', label: 'Отгрузки' },
        ]}
        activeKey={tab}
        onChange={(key) => {
          setTab(key)
          setPage(0)
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Найти заказ или отгрузку"
          className="w-full sm:w-80"
          placeholder="Номер или покупатель"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
        />
        <Select
          aria-label="Архив продаж"
          className="w-full sm:w-44"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setPage(0)
          }}
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
        <Button variant="secondary" onClick={refresh}>
          Обновить
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {tab === 'orders' ? (
        <DataTable
          rows={error ? [] : orders.items}
          keyOf={(r) => String(r.id)}
          loading={loading}
          onRowClick={(r) => void openOrder(r)}
          columns={[
            {
              header: 'Заказ',
              accessor: (r) => (
                <div>
                  № {r.number}
                  <div className="text-xs text-muted">
                    {r.organization_name}
                    {r.source_id ? ' · Перенесён' : ''}
                  </div>
                </div>
              ),
            },
            { header: 'Покупатель', accessor: (r) => r.counterparty_name },
            { header: 'Сумма', accessor: (r) => money(r.total, r.currency) },
            {
              header: 'Исполнение',
              accessor: (r) => (
                <div>
                  <Chip>{labels[r.status]}</Chip>
                  <div className="mt-1 text-xs text-muted">
                    {labels[r.fulfillment]}
                    {r.archived ? ' · Архив' : ''}
                  </div>
                </div>
              ),
            },
            { header: 'План отгрузки', accessor: (r) => r.expected_at || '—' },
          ]}
        />
      ) : (
        <DataTable
          rows={error ? [] : shipments.items}
          keyOf={(r) => String(r.id)}
          loading={loading}
          onRowClick={(r) => void openShip(r)}
          columns={[
            {
              header: 'Отгрузка',
              accessor: (r) => (
                <div>
                  № {r.number}
                  <div className="text-xs text-muted">
                    {new Date(r.occurred_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ),
            },
            { header: 'Покупатель', accessor: (r) => r.counterparty_name },
            { header: 'Сумма', accessor: (r) => money(r.total, r.currency) },
            {
              header: 'Статус',
              accessor: (r) => (
                <div>
                  <Chip>{labels[r.status]}</Chip>
                  <div className="text-xs text-muted">
                    {r.historical ? 'Перенесена · ' : ''}
                    {r.archived ? 'Архив' : ''}
                  </div>
                </div>
              ),
            },
          ]}
        />
      )}
      <div className="flex items-center justify-between text-sm">
        <span>Документов: {total}</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!page || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={(page + 1) * 50 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
      <Drawer open={!!selected} title={selected ? 'Заказ № ' + selected.number : ''} onClose={close}>
        {selected && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">
              {selected.counterparty_name} · {selected.organization_name}
            </p>
            <p>
              {labels[selected.status]} · {labels[selected.fulfillment]} ·{' '}
              {money(selected.total, selected.currency)}
            </p>
            <div className="flex flex-wrap gap-2">
              {edit && !selected.archived && selected.status !== 'cancelled' && (
                <Button variant="secondary" disabled={busy} onClick={() => setEditing(selected)}>
                  Изменить заказ
                </Button>
              )}
              {edit && !selected.archived && selected.status === 'draft' && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(async () =>
                      setSelected(
                        await call<Order>('/orders/' + selected.id + '/confirm', 'POST', {
                          version: selected.version,
                        }),
                      ),
                    )
                  }
                >
                  Подтвердить заказ
                </Button>
              )}
              {edit &&
                !selected.archived &&
                selected.status === 'confirmed' &&
                selected.lines.some((l) => l.remaining_quantity > 0) && (
                  <Button onClick={() => setShipping(selected)}>Создать отгрузку</Button>
                )}
              {edit && !selected.archived && selected.status !== 'cancelled' && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setCancel({ kind: 'orders', row: selected })}
                >
                  Отменить заказ
                </Button>
              )}
              {full && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () =>
                      setSelected(
                        await call<Order>('/orders/' + selected.id + '/archive', 'POST', {
                          version: selected.version,
                          archived: !selected.archived,
                        }),
                      ),
                    )
                  }
                >
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
            </div>
            <p>
              Срок: {selected.expected_at || 'не указан'} · Адрес: {selected.address || 'не указан'}
            </p>
            {selected.note && <p className="whitespace-pre-wrap">{selected.note}</p>}
            {selected.source_id && (
              <p className="rounded-md bg-surface-muted p-3 text-muted">
                История перенесена без повторной выдачи товара. Оплачено до переноса:{' '}
                {money(selected.opening_paid, selected.currency)}. Оплата после переноса и новые счета будут
                подключены отдельно.{selected.source_state && ' Исходный статус: ' + selected.source_state}
              </p>
            )}
            <div className="space-y-2">
              {selected.lines.map((l, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <p className="font-medium">
                    {l.title} {!l.stock_tracked && '· Услуга'}
                  </p>
                  <p>
                    {qty(l.quantity)} {l.unit} × {money(l.unit_price, selected.currency)} ={' '}
                    {money(l.line_total, selected.currency)}
                  </p>
                  <p className="text-muted">
                    Выдано: {qty(l.shipped_quantity)} · Осталось: {qty(l.remaining_quantity)} · В резерве:{' '}
                    {qty(l.reserved_quantity)}
                  </p>
                  {stockEdit &&
                    !selected.archived &&
                    selected.status === 'confirmed' &&
                    l.stock_tracked &&
                    l.material_id &&
                    l.remaining_quantity > l.reserved_quantity && (
                      <ReserveLine
                        order={selected}
                        line={l}
                        index={i}
                        onSaved={async () => {
                          setSelected(await call<Order>('/orders/' + selected.id))
                          refresh()
                        }}
                      />
                    )}
                </div>
              ))}
            </div>
            {!!selected.shipments?.length && (
              <div>
                <h3 className="font-medium">Отгрузки по заказу</h3>
                {selected.shipments.map((s) => (
                  <button
                    key={s.id}
                    className="mt-2 block text-accent underline"
                    onClick={() => void openShip(s)}
                  >
                    № {s.number} · {labels[s.status]}
                    {s.historical ? ' · Перенесена' : ''}
                  </button>
                ))}
              </div>
            )}
            <History events={selected.events} />
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Drawer>
      <Drawer
        open={!!selectedShip}
        title={selectedShip ? 'Отгрузка № ' + selectedShip.number : ''}
        onClose={close}
      >
        {selectedShip && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">
              {selectedShip.counterparty_name} · {selectedShip.organization_name}
            </p>
            <p>
              {labels[selectedShip.status]} · {money(selectedShip.total, selectedShip.currency)}
            </p>
            <p>
              {new Date(selectedShip.occurred_at).toLocaleString('ru-RU')} · Получатель:{' '}
              {selectedShip.received_by || 'не указан'}
            </p>
            <p>{selectedShip.address}</p>
            <p className="whitespace-pre-wrap">{selectedShip.note}</p>
            {selectedShip.order_id && (
              <Link className="text-accent underline" to={'/sales?order=' + selectedShip.order_id}>
                Открыть заказ
              </Link>
            )}
            {selectedShip.historical && (
              <p className="rounded-md bg-surface-muted p-3 text-muted">
                Перенесённая история. Остатки уже учтены при переносе. Повторное проведение и отмена этого
                документа заблокированы.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {stockEdit &&
                !selectedShip.historical &&
                !selectedShip.archived &&
                selectedShip.status === 'draft' && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async () =>
                        setSelectedShip(
                          await call<Shipment>('/shipments/' + selectedShip.id + '/post', 'POST', {
                            request_id: (postKeys.current[selectedShip.id + ':' + selectedShip.version] ??=
                              crypto.randomUUID()),
                            version: selectedShip.version,
                            order_version: selectedShip.order_version,
                          }),
                        ),
                      )
                    }
                  >
                    Провести отгрузку
                  </Button>
                )}
              {((selectedShip.status === 'draft' && edit) || (full && stockFull)) &&
                !selectedShip.historical &&
                !selectedShip.archived &&
                selectedShip.status !== 'cancelled' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setCancel({ kind: 'shipments', row: selectedShip })}
                  >
                    Отменить отгрузку
                  </Button>
                )}
              {full && selectedShip.status !== 'draft' && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () =>
                      setSelectedShip(
                        await call<Shipment>('/shipments/' + selectedShip.id + '/archive', 'POST', {
                          version: selectedShip.version,
                          archived: !selectedShip.archived,
                        }),
                      ),
                    )
                  }
                >
                  {selectedShip.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
            </div>
            <Lines lines={selectedShip.lines} currency={selectedShip.currency} />
            {selectedShip.operation_id && (
              <Link className="block text-accent underline" to="/warehouse?tab=history">
                Отпуск со склада № {selectedShip.operation_id}
              </Link>
            )}
            {selectedShip.cancel_operation_id && (
              <p>Встречное оприходование № {selectedShip.cancel_operation_id}</p>
            )}
            {selectedShip.cancellation_note && <p>Причина отмены: {selectedShip.cancellation_note}</p>}
            <History events={selectedShip.events} />
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Drawer>
      {editing && (
        <OrderEditor
          row={editing === true ? null : editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null)
            setSelected(r)
            refresh()
          }}
          onBuyer={(c) =>
            setCatalog((v) => ({
              ...v,
              counterparties: [...v.counterparties.filter((x) => x.id !== c.id), c],
            }))
          }
        />
      )}
      {shipping && (
        <ShipmentEditor
          order={shipping}
          onClose={() => {
            setShipping(null)
            if (params.has('ship')) {
              const next = new URLSearchParams(params)
              next.delete('ship')
              setParams(next)
            }
          }}
          onSaved={(r) => {
            setShipping(null)
            setSelected(null)
            setSelectedShip(r)
            refresh()
          }}
        />
      )}
      {cancel && (
        <CancelDialog
          kind={cancel.kind}
          row={cancel.row}
          onClose={() => setCancel(null)}
          onSaved={(r) => {
            if (cancel.kind === 'orders') setSelected(r as Order)
            else setSelectedShip(r as Shipment)
            setCancel(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function Lines({ lines, currency }: { lines: Line[]; currency: string }) {
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="rounded-md border border-border p-3">
          <p>{l.title}</p>
          <p>
            {qty(l.quantity)} {l.unit} × {money(l.unit_price, currency)} = {money(l.line_total, currency)}
          </p>
        </div>
      ))}
    </div>
  )
}
function History({ events }: { events?: SalesEvent[] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">История документа</h3>
      {events?.length ? (
        events.map((e) => (
          <div key={e.id} className="border-t border-border pt-2">
            <p>{eventLabels[e.kind] || e.kind}</p>
            <p className="text-xs text-muted">
              {new Date(e.created_at).toLocaleString('ru-RU')} · {e.actor_name || 'Сотрудник #' + e.actor_id}
              {typeof e.data.note === 'string' ? ' · ' + e.data.note : ''}
            </p>
          </div>
        ))
      ) : (
        <p className="text-muted">Перенесённая история хранится в исходном документе.</p>
      )}
    </div>
  )
}

function ReserveLine({
  order,
  line,
  index,
  onSaved,
}: {
  order: Order
  line: Line
  index: number
  onSaved: () => Promise<void>
}) {
  const [quantity, setQuantity] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID())
  const q = number(quantity),
    max = line.remaining_quantity - line.reserved_quantity
  async function save() {
    setBusy(true)
    setError('')
    try {
      await apiRequest({
        section: 'warehouse',
        path: '/reservations',
        method: 'POST',
        body: {
          request_id: key,
          material_id: line.material_id,
          quantity: quantity.replace(',', '.'),
          sales_order_id: order.id,
          sales_line: index,
        },
      })
      setQuantity('')
      setKey(crypto.randomUUID())
      await onSaved()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={'Резерв строки ' + index}
          disabled={busy}
          className="w-36"
          inputMode="decimal"
          placeholder={'До ' + qty(max)}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value)
            setKey(crypto.randomUUID())
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || !Number.isFinite(q) || q <= 0 || q > max}
          onClick={() => void save()}
        >
          В резерв
        </Button>
        <Link
          className="self-center text-xs text-accent underline"
          to={'/warehouse?tab=reservations&material=' + line.material_id}
        >
          Посмотреть резервы
        </Link>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

type EditLine = {
  material_id: string
  title: string
  unit: string
  stock_tracked: boolean
  quantity: string
  unit_price: string
  search: string
}
function OrderEditor({
  row,
  catalog,
  onClose,
  onSaved,
  onBuyer,
}: {
  row: Order | null
  catalog: Catalog
  onClose: () => void
  onSaved: (r: Order) => void
  onBuyer: (c: Catalog['counterparties'][number]) => void
}) {
  const [cp, setCp] = useState(String(row?.counterparty_id || '')),
    [org, setOrg] = useState(String(row?.organization_id || catalog.organizations[0]?.id || '')),
    [search, setSearch] = useState('')
  const [when, setWhen] = useState(row?.expected_at || ''),
    [address, setAddress] = useState(row?.address || ''),
    [note, setNote] = useState(row?.note || '')
  const [lines, setLines] = useState<EditLine[]>(
    row?.lines.map((l) => ({
      ...l,
      material_id: String(l.material_id || ''),
      quantity: String(l.quantity),
      unit_price: String(l.unit_price),
      search: '',
    })) || [
      {
        material_id: '',
        title: '',
        unit: '',
        stock_tracked: true,
        quantity: '1',
        unit_price: '',
        search: '',
      },
    ],
  )
  const [buyer, setBuyer] = useState(false),
    [buyerName, setBuyerName] = useState(''),
    [buyerInn, setBuyerInn] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID())
  const frozen = !!row?.financial_fields_locked
  const valid =
    cp &&
    org &&
    (frozen ||
      (lines.length > 0 &&
        lines.every(
          (l) =>
            Number.isFinite(number(l.quantity)) &&
            number(l.quantity) > 0 &&
            l.unit_price.trim() &&
            Number.isFinite(number(l.unit_price)) &&
            number(l.unit_price) >= 0 &&
            (l.stock_tracked ? l.material_id : l.title.trim() && l.unit.trim()),
        )))
  function changed() {
    setKey(crypto.randomUUID())
    setError('')
  }
  function changeLine(i: number, fields: Partial<EditLine>) {
    changed()
    setLines((v) => v.map((l, n) => (n === i ? { ...l, ...fields } : l)))
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      const fields = {
        expected_at: when || null,
        address,
        note,
        ...(!frozen
          ? {
              counterparty_id: Number(cp),
              organization_id: Number(org),
              lines: lines.map((l) => ({
                material_id: l.stock_tracked ? Number(l.material_id) : null,
                title: l.title,
                unit: l.unit,
                stock_tracked: l.stock_tracked,
                quantity: l.quantity.replace(',', '.'),
                unit_price: l.unit_price.replace(',', '.'),
              })),
            }
          : {}),
      }
      onSaved(
        await call<Order>(row ? '/orders/' + row.id : '/orders', row ? 'PATCH' : 'POST', {
          ...fields,
          ...(row ? { version: row.version } : { request_id: key }),
        }),
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function saveBuyer() {
    setBusy(true)
    setError('')
    try {
      const c = await call<Catalog['counterparties'][number]>('/buyers', 'POST', {
        name: buyerName,
        inn: buyerInn || null,
      })
      onBuyer(c)
      setCp(String(c.id))
      setBuyer(false)
      changed()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const choices = catalog.counterparties
    .filter(
      (c) =>
        (c.active || String(c.id) === cp) &&
        (String(c.id) === cp || (c.name + ' ' + c.inn).toLowerCase().includes(search.toLowerCase())),
    )
    .slice(0, 100)
  return (
    <Modal
      open
      title={row ? 'Изменение заказа' : 'Новый заказ покупателя'}
      width="max-w-4xl"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !valid || buyer} onClick={() => void save()}>
            Сохранить заказ
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {frozen ? (
          <p className="text-muted">
            У заказа есть история, резерв или отгрузка. Состав, цены и стороны сохранены; можно уточнить срок,
            адрес и комментарий.
          </p>
        ) : (
          <>
            <Input
              placeholder="Найти покупателя по имени или ИНН"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Field label="Покупатель">
              <Select
                aria-label="Покупатель заказа"
                value={cp}
                disabled={busy}
                onChange={(e) => {
                  changed()
                  setCp(e.target.value)
                }}
              >
                <option value="">Выберите покупателя</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.inn ? ' · ' + c.inn : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" size="sm" onClick={() => setBuyer((v) => !v)}>
              Добавить покупателя
            </Button>
            {buyer && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <Input
                  aria-label="Имя нового покупателя"
                  placeholder="Имя или название"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
                <Input
                  aria-label="ИНН нового покупателя"
                  placeholder="ИНН, если есть"
                  value={buyerInn}
                  onChange={(e) => setBuyerInn(e.target.value)}
                />
                <Button size="sm" disabled={busy || !buyerName.trim()} onClick={() => void saveBuyer()}>
                  Сохранить покупателя
                </Button>
              </div>
            )}
            <Field label="Организация">
              <Select
                aria-label="Организация заказа"
                value={org}
                disabled={busy}
                onChange={(e) => {
                  changed()
                  setOrg(e.target.value)
                }}
              >
                <option value="">Выберите организацию</option>
                {catalog.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            {lines.map((l, i) => {
              const options = catalog.materials
                .filter(
                  (m) =>
                    String(m.id) === l.material_id ||
                    (m.title + ' ' + m.code + ' ' + m.warehouse)
                      .toLowerCase()
                      .includes(l.search.toLowerCase()),
                )
                .sort(
                  (a, b) => Number(String(b.id) === l.material_id) - Number(String(a.id) === l.material_id),
                )
                .slice(0, 60)
              const material = catalog.materials.find((m) => String(m.id) === l.material_id)
              return (
                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {l.stock_tracked ? 'Товар' : 'Услуга'} {i + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        changed()
                        setLines((v) => v.filter((_, n) => n !== i))
                      }}
                    >
                      Убрать строку
                    </Button>
                  </div>
                  {l.stock_tracked ? (
                    <>
                      <Input
                        aria-label={'Поиск товара ' + i}
                        placeholder="Найти товар или склад"
                        value={l.search}
                        onChange={(e) => changeLine(i, { search: e.target.value })}
                      />
                      <Select
                        aria-label={'Товар заказа ' + i}
                        value={l.material_id}
                        disabled={busy}
                        onChange={(e) => changeLine(i, { material_id: e.target.value })}
                      >
                        <option value="">Выберите товар</option>
                        {options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} · {m.code} · {m.warehouse}
                          </option>
                        ))}
                      </Select>
                      {material && (
                        <p className="text-xs text-muted">
                          Свободно сейчас: {qty(material.available_quantity)} {material.unit}. Заказ можно
                          оформить до поступления товара.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        aria-label={'Название услуги ' + i}
                        placeholder="Название услуги"
                        value={l.title}
                        onChange={(e) => changeLine(i, { title: e.target.value })}
                      />
                      <Input
                        aria-label={'Единица услуги ' + i}
                        placeholder="Единица учёта"
                        value={l.unit}
                        onChange={(e) => changeLine(i, { unit: e.target.value })}
                      />
                    </>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label="Количество">
                      <Input
                        aria-label={'Количество заказа ' + i}
                        inputMode="decimal"
                        value={l.quantity}
                        disabled={busy}
                        onChange={(e) => changeLine(i, { quantity: e.target.value })}
                      />
                    </Field>
                    <Field label="Цена к оплате за единицу, ₽">
                      <Input
                        aria-label={'Цена заказа ' + i}
                        inputMode="decimal"
                        value={l.unit_price}
                        disabled={busy}
                        onChange={(e) => changeLine(i, { unit_price: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  changed()
                  setLines((v) => [
                    ...v,
                    {
                      material_id: '',
                      title: '',
                      unit: '',
                      stock_tracked: true,
                      quantity: '1',
                      unit_price: '',
                      search: '',
                    },
                  ])
                }}
              >
                Добавить товар
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  changed()
                  setLines((v) => [
                    ...v,
                    {
                      material_id: '',
                      title: '',
                      unit: 'усл',
                      stock_tracked: false,
                      quantity: '1',
                      unit_price: '',
                      search: '',
                    },
                  ])
                }}
              >
                Добавить услугу
              </Button>
            </div>
          </>
        )}
        <Field label="Плановая дата отгрузки">
          <Input
            aria-label="Срок заказа"
            type="date"
            value={when}
            disabled={busy}
            onChange={(e) => {
              changed()
              setWhen(e.target.value)
            }}
          />
        </Field>
        <Field label="Адрес доставки">
          <Input
            aria-label="Адрес заказа"
            value={address}
            maxLength={1000}
            disabled={busy}
            onChange={(e) => {
              changed()
              setAddress(e.target.value)
            }}
          />
        </Field>
        <Field label="Комментарий">
          <Textarea
            aria-label="Комментарий заказа"
            value={note}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => {
              changed()
              setNote(e.target.value)
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function ShipmentEditor({
  order,
  onClose,
  onSaved,
}: {
  order: Order
  onClose: () => void
  onSaved: (r: Shipment) => void
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>({}),
    [received, setReceived] = useState(''),
    [when, setWhen] = useState(localNowInput),
    [address, setAddress] = useState(order.address),
    [note, setNote] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID())
  const selected = order.lines
    .map((l, i) => ({ l, i, q: number(quantities[i] || '0') }))
    .filter((x) => x.q > 0)
  const valid =
    received.trim() &&
    when &&
    selected.length > 0 &&
    selected.every((x) => Number.isFinite(x.q) && x.q <= x.l.remaining_quantity) &&
    Object.values(quantities).every((q) => !q.trim() || (Number.isFinite(number(q)) && number(q) >= 0))
  function changed() {
    setKey(crypto.randomUUID())
    setError('')
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      onSaved(
        await call<Shipment>('/shipments', 'POST', {
          request_id: key,
          order_id: order.id,
          order_version: order.version,
          occurred_at: localInputToIso(when),
          received_by: received,
          address,
          note,
          lines: selected.map((x) => ({ order_line: x.i, quantity: quantities[x.i].replace(',', '.') })),
        }),
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title="Новая отгрузка"
      width="max-w-3xl"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !valid} onClick={() => void save()}>
            Сохранить черновик
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          Заказ № {order.number} · {order.counterparty_name}
        </p>
        <p className="text-muted">
          Укажите фактическое количество. Товар спишется после проведения; тогда система повторно проверит
          остаток заказа и чужие резервы.
        </p>
        {order.lines.map(
          (l, i) =>
            l.remaining_quantity > 0 && (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="font-medium">{l.title}</p>
                <p className="mb-2 text-xs text-muted">
                  Осталось отгрузить: {qty(l.remaining_quantity)} {l.unit} · В резерве:{' '}
                  {qty(l.reserved_quantity)}
                </p>
                <Input
                  aria-label={'Количество отгрузки ' + i}
                  inputMode="decimal"
                  placeholder="0"
                  value={quantities[i] || ''}
                  disabled={busy}
                  onChange={(e) => {
                    changed()
                    setQuantities((v) => ({ ...v, [i]: e.target.value }))
                  }}
                />
              </div>
            ),
        )}
        <Field label="Получатель">
          <Input
            aria-label="Получатель отгрузки"
            value={received}
            maxLength={255}
            disabled={busy}
            onChange={(e) => {
              changed()
              setReceived(e.target.value)
            }}
          />
        </Field>
        <Field label="Дата выдачи">
          <Input
            aria-label="Дата отгрузки"
            type="datetime-local"
            value={when}
            max={localNowInput()}
            disabled={busy}
            onChange={(e) => {
              changed()
              setWhen(e.target.value)
            }}
          />
        </Field>
        <Field label="Адрес">
          <Input
            value={address}
            maxLength={1000}
            disabled={busy}
            onChange={(e) => {
              changed()
              setAddress(e.target.value)
            }}
          />
        </Field>
        <Field label="Комментарий">
          <Textarea
            value={note}
            maxLength={500}
            disabled={busy}
            onChange={(e) => {
              changed()
              setNote(e.target.value)
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function CancelDialog({
  kind,
  row,
  onClose,
  onSaved,
}: {
  kind: 'orders' | 'shipments'
  row: Order | Shipment
  onClose: () => void
  onSaved: (r: Order | Shipment) => void
}) {
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID())
  async function save() {
    setBusy(true)
    setError('')
    try {
      onSaved(
        await call<Order | Shipment>(`/${kind}/${row.id}/cancel`, 'POST', {
          request_id: key,
          version: row.version,
          note,
        }),
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={kind === 'orders' ? 'Отмена заказа' : 'Отмена отгрузки'}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Закрыть
          </Button>
          <Button disabled={busy || !note.trim()} onClick={() => void save()}>
            Подтвердить отмену
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          {kind === 'shipments' && row.status === 'posted'
            ? 'Товар вернётся встречной складской операцией. Исполнение заказа уменьшится; погашенные резервы сохранят историю. Деньги не меняются.'
            : 'Документ останется в истории с причиной отмены.'}
        </p>
        <Field label="Причина отмены">
          <Textarea
            aria-label="Причина отмены продажи"
            value={note}
            maxLength={500}
            disabled={busy}
            onChange={(e) => {
              setNote(e.target.value)
              setKey(crypto.randomUUID())
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
