import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { Modal } from '@/shared/ui/Modal'
import { Chip } from '@/shared/ui/Chip'
import { useWarehouseStore } from './store'
import { localInputToIso, localNowInput } from './components/OperationLinesEditor'

type Event = {
  id: number
  kind: string
  quantity: number
  actor_id: number
  movement_id: number | null
  note: string
  created_at: string
}
type Reservation = {
  id: number
  material_id: number
  material_title: string
  material_code: string
  warehouse: string
  unit: string
  production_id: number | null
  sales_order_id?: number | null
  purpose: string
  quantity: number
  remaining_quantity: number
  consumed_quantity: number
  released_quantity: number
  available_quantity: number
  available_for_issue: number
  shortage: number
  version: number
  status: string
  archived: boolean
  events?: Event[]
}
type Catalog = {
  houses: { id: number; name: string }[]
  orders: { id: number; name: string; lines: { index: number; material_id: number; capacity: number }[] }[]
  sales_orders?: {
    id: number
    name: string
    lines: { index: number; material_id: number; capacity: number }[]
  }[]
}
const labels: Record<string, string> = {
  active: 'В резерве',
  issued: 'Выдано',
  released: 'Снято',
  closed: 'Закрыт',
  created: 'Зарезервировано',
}
const call = <T,>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) =>
  apiRequest<T>({ section: 'warehouse', path: '/reservations' + path, method, body })
const number = (q: number) => Number(q).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const text = (e: unknown) => (e instanceof Error ? e.message : 'Не удалось выполнить действие')

export function ReservationsPanel({
  materialId,
  createMaterialId,
  onIssueHouse,
  onCreateHandled,
}: {
  materialId?: number
  createMaterialId?: number
  onIssueHouse: (id: number) => void
  onCreateHandled?: () => void
}) {
  const level = useAccessLevel('warehouse'),
    canEdit = accessLevelAtLeast(level, 'edit'),
    canFull = accessLevelAtLeast(level, 'full')
  const [state, setState] = useState('active'),
    [archive, setArchive] = useState('active'),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0)
  const [data, setData] = useState<{ total: number; items: Reservation[] }>({ total: 0, items: [] }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [selected, setSelected] = useState<Reservation | null>(null),
    [creating, setCreating] = useState(!!createMaterialId),
    [action, setAction] = useState<{ row: Reservation; kind: 'release' | 'issue' } | null>(null),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    call<typeof data>(
      `?status=${state}&archive=${archive}&offset=${page * 50}${materialId ? '&material_id=' + materialId : ''}`,
    )
      .then((r) => {
        if (current) setData(r)
      })
      .catch((e) => {
        if (current) setError(text(e))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [state, archive, page, revision, materialId])
  useEffect(() => {
    if (createMaterialId && canEdit) setCreating(true)
  }, [createMaterialId, canEdit])
  async function open(row: Reservation) {
    setSelected(row)
    try {
      setSelected(await call<Reservation>('/' + row.id))
    } catch (e) {
      setError(text(e))
    }
  }
  async function updated(row?: Reservation) {
    if (row) await open(row)
    setRevision((v) => v + 1)
    await useWarehouseStore.getState().load()
  }
  async function archiveRow() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const row = await call<Reservation>('/' + selected.id + '/archive', 'POST', {
        version: selected.version,
        archived: !selected.archived,
      })
      await updated(row)
    } catch (e) {
      setError(text(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Резерв уменьшает свободный остаток и сохраняет товар за назначением. Для дома он используется при
        выдаче по техкарте или заявке; снятие резерва не меняет физический остаток.
      </p>
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="Состояние резерва"
          className="w-full sm:w-44"
          value={state}
          onChange={(e) => {
            setState(e.target.value)
            setPage(0)
          }}
        >
          <option value="active">В резерве</option>
          <option value="closed">Закрытые</option>
          <option value="all">Все состояния</option>
        </Select>
        <Select
          aria-label="Архив резервов"
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
        <Button
          variant="secondary"
          onClick={() => {
            if (selected) void open(selected)
            setRevision((v) => v + 1)
          }}
        >
          Обновить резервы
        </Button>
        {canEdit && <Button onClick={() => setCreating(true)}>Зарезервировать</Button>}
      </div>
      {materialId && (
        <p className="text-sm text-muted">
          Показаны резервы выбранного материала.{' '}
          <Link className="text-accent underline" to="/warehouse?tab=reservations">
            Все материалы
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <DataTable
        rows={error ? [] : data.items}
        keyOf={(r) => String(r.id)}
        loading={loading}
        onRowClick={(r) => void open(r)}
        columns={[
          {
            header: 'Материал',
            accessor: (r) => (
              <div>
                {r.material_title}
                <div className="text-xs text-muted">
                  {r.material_code} · {r.warehouse}
                </div>
              </div>
            ),
          },
          { header: 'Назначение', accessor: (r) => r.purpose },
          { header: 'В резерве', accessor: (r) => number(r.remaining_quantity) + ' ' + r.unit },
          { header: 'Выдано', accessor: (r) => number(r.consumed_quantity) },
          {
            header: 'Статус',
            accessor: (r) => (
              <Chip tone={r.shortage > 0 ? 'danger' : 'neutral'}>
                {r.archived ? 'Архив · ' : ''}
                {r.shortage > 0 ? 'Не обеспечен' : labels[r.status]}
              </Chip>
            ),
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Резервов: {error ? '—' : data.total}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!page || loading}
            onClick={() => setPage((v) => v - 1)}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={(page + 1) * 50 >= data.total || loading}
            onClick={() => setPage((v) => v + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
      <Drawer
        open={!!selected}
        title={selected ? 'Резерв № ' + selected.id : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <p className="font-medium">
              {selected.material_title} · {selected.material_code}
            </p>
            <p>{selected.warehouse}</p>
            <p>{selected.purpose}</p>
            <div className="rounded-md bg-surface-muted p-3">
              <p>
                Зарезервировано изначально: {number(selected.quantity)} {selected.unit}
              </p>
              <p>
                Осталось: {number(selected.remaining_quantity)} · Выдано: {number(selected.consumed_quantity)}{' '}
                · Снято: {number(selected.released_quantity)}
              </p>
            </div>
            {selected.shortage > 0 && (
              <p className="text-danger">
                Общий дефицит резервов этой позиции: {number(selected.shortage)} {selected.unit}. Проверьте
                пересчёт, поставки или снимите неподтверждённый резерв.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {canEdit && !selected.archived && selected.remaining_quantity > 0 && (
                <>
                  <Button variant="secondary" onClick={() => setAction({ row: selected, kind: 'release' })}>
                    Снять резерв
                  </Button>
                  {selected.sales_order_id ? (
                    <Link
                      className="self-center text-accent underline"
                      to={'/sales?order=' + selected.sales_order_id + '&ship=1'}
                    >
                      Оформить отгрузку заказа
                    </Link>
                  ) : selected.production_id ? (
                    <>
                      <Button onClick={() => onIssueHouse(selected.production_id!)}>
                        Выдать по техкарте
                      </Button>
                      <Link className="self-center text-accent underline" to="/warehouse?tab=requests">
                        Заявки производства
                      </Link>
                    </>
                  ) : (
                    <Button
                      disabled={selected.available_for_issue <= 0}
                      onClick={() => setAction({ row: selected, kind: 'issue' })}
                    >
                      Выдать из резерва
                    </Button>
                  )}
                </>
              )}
              {canFull && selected.remaining_quantity === 0 && (
                <Button variant="secondary" disabled={busy} onClick={() => void archiveRow()}>
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
            </div>
            {selected.production_id && (
              <p className="text-muted">
                Выдача дому сохраняет нормативы производства. Резерв погашается автоматически по фактически
                выданному количеству.
              </p>
            )}
            <h3 className="font-medium">История резерва</h3>
            {!selected.events ? (
              <p className="text-muted">Загружаем историю…</p>
            ) : (
              selected.events.map((e) => (
                <div key={e.id} className="border-t border-border py-2">
                  <p>
                    {labels[e.kind] || e.kind} · {number(e.quantity)} {selected.unit}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(e.created_at).toLocaleString('ru-RU')} · {e.note}
                  </p>
                  {e.movement_id && (
                    <Link className="text-accent underline" to="/warehouse?tab=history">
                      Движение склада № {e.movement_id}
                    </Link>
                  )}
                </div>
              ))
            )}
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Drawer>
      {creating && canEdit && (
        <CreateReservation
          initialMaterialId={createMaterialId || materialId}
          onClose={() => {
            setCreating(false)
            onCreateHandled?.()
          }}
          onSaved={async (row) => {
            setCreating(false)
            onCreateHandled?.()
            await updated(row)
          }}
        />
      )}
      {action && (
        <ReservationAction
          row={action.row}
          kind={action.kind}
          onClose={() => setAction(null)}
          onSaved={async (row) => {
            setAction(null)
            if (action.kind === 'issue')
              useWarehouseStore.setState((s) => ({ operationsVersion: s.operationsVersion + 1 }))
            await updated(row)
          }}
        />
      )}
    </div>
  )
}

function CreateReservation({
  initialMaterialId,
  onClose,
  onSaved,
}: {
  initialMaterialId?: number
  onClose: () => void
  onSaved: (r: Reservation) => void
}) {
  const materials = useWarehouseStore((s) => s.materials).filter((m) => !m.is_archived)
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [mode, setMode] = useState('purpose'),
    [materialId, setMaterialId] = useState(String(initialMaterialId || ''))
  const [productionId, setProductionId] = useState(''),
    [sourceId, setSourceId] = useState(''),
    [sourceLine, setSourceLine] = useState(''),
    [purpose, setPurpose] = useState(''),
    [quantity, setQuantity] = useState('')
  const [search, setSearch] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    call<Catalog>('/catalog')
      .then(setCatalog)
      .catch((e) => setError(text(e)))
  }, [])
  const material = materials.find((m) => m.id === Number(materialId)),
    source = (mode === 'sales' ? catalog?.sales_orders : catalog?.orders)?.find(
      (o) => o.id === Number(sourceId),
    ),
    line = source?.lines.find((l) => l.index === Number(sourceLine))
  const q = Number(quantity.replace(',', '.')),
    free = material?.available_quantity ?? material?.quantity_in_stock ?? 0
  const valid =
    material &&
    quantity.trim() &&
    Number.isFinite(q) &&
    q > 0 &&
    q <= free &&
    (material.is_fractional || Number.isInteger(q)) &&
    (mode === 'purpose'
      ? purpose.trim()
      : mode === 'house'
        ? productionId
        : sourceId && sourceLine !== '' && line && q <= line.capacity)
  const choices = [
    ...(material ? [material] : []),
    ...materials.filter(
      (m) =>
        m.id !== material?.id &&
        (m.title + ' ' + m.code + ' ' + m.warehouse).toLowerCase().includes(search.toLowerCase()),
    ),
  ].slice(0, 80)
  function changed() {
    setKey(crypto.randomUUID())
    setError('')
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      const row = await call<Reservation>('', 'POST', {
        request_id: key,
        material_id: Number(materialId),
        quantity: quantity.replace(',', '.'),
        purpose,
        production_id: mode === 'house' ? Number(productionId) : null,
        source_order_id: mode === 'source' ? Number(sourceId) : null,
        source_line: mode === 'source' ? Number(sourceLine) : null,
        sales_order_id: mode === 'sales' ? Number(sourceId) : null,
        sales_line: mode === 'sales' ? Number(sourceLine) : null,
      })
      onSaved(row)
    } catch (e) {
      setError(text(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title="Резерв материала"
      width="max-w-2xl"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !valid} onClick={() => void save()}>
            Зарезервировать
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Резерв сохраняет товар за выбранным назначением. Физический остаток и деньги не меняются.
        </p>
        <Field label="Назначение">
          <Select
            aria-label="Тип назначения резерва"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              changed()
              setMode(e.target.value)
              setSourceId('')
              setSourceLine('')
            }}
          >
            <option value="purpose">Произвольное назначение</option>
            <option value="house">Дом в производстве</option>
            <option value="sales">Заказ покупателя</option>
            {!!catalog?.orders.length && <option value="source">Заказ покупателя из переноса</option>}
          </Select>
        </Field>
        {mode === 'house' && (
          <Field label="Дом">
            <Select
              aria-label="Дом резерва"
              value={productionId}
              disabled={busy || !catalog}
              onChange={(e) => {
                changed()
                setProductionId(e.target.value)
              }}
            >
              <option value="">Выберите дом</option>
              {catalog?.houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(mode === 'source' || mode === 'sales') && (
          <>
            <Field label="Заказ покупателя">
              <Select
                aria-label="Заказ покупателя для резерва"
                value={sourceId}
                disabled={busy || !catalog}
                onChange={(e) => {
                  changed()
                  setSourceId(e.target.value)
                  setSourceLine('')
                  setMaterialId('')
                }}
              >
                <option value="">Выберите заказ</option>
                {(mode === 'sales' ? catalog?.sales_orders : catalog?.orders)?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Строка заказа">
              <Select
                aria-label="Строка заказа для резерва"
                value={sourceLine}
                disabled={busy || !source}
                onChange={(e) => {
                  changed()
                  setSourceLine(e.target.value)
                  setMaterialId(
                    String(source?.lines.find((l) => l.index === Number(e.target.value))?.material_id || ''),
                  )
                }}
              >
                <option value="">Выберите строку</option>
                {source?.lines.map((l) => (
                  <option key={l.index} value={l.index}>
                    {materials.find((m) => m.id === l.material_id)?.title || 'Позиция'} · осталось{' '}
                    {number(l.capacity)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {mode !== 'source' && mode !== 'sales' && (
          <>
            <Input
              placeholder="Найти материал или склад"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Field label="Материал">
              <Select
                aria-label="Материал резерва"
                value={materialId}
                disabled={busy}
                onChange={(e) => {
                  changed()
                  setMaterialId(e.target.value)
                }}
              >
                <option value="">Выберите материал</option>
                {choices.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {m.code} · {m.warehouse}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        {material && (
          <p>
            На складе: {number(material.quantity_in_stock)} {material.unit} · В резерве:{' '}
            {number(material.reserved_quantity || 0)} · Свободно: {number(free)}
          </p>
        )}
        <Field label="Количество">
          <Input
            aria-label="Количество резерва"
            inputMode="decimal"
            value={quantity}
            disabled={busy}
            onChange={(e) => {
              changed()
              setQuantity(e.target.value)
            }}
          />
        </Field>
        <Field label={mode === 'purpose' ? 'Для чего резервируем' : 'Примечание к назначению'}>
          <Input
            aria-label="Назначение резерва"
            value={purpose}
            maxLength={255}
            disabled={busy}
            onChange={(e) => {
              changed()
              setPurpose(e.target.value)
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

function ReservationAction({
  row,
  kind,
  onClose,
  onSaved,
}: {
  row: Reservation
  kind: 'release' | 'issue'
  onClose: () => void
  onSaved: (r: Reservation) => void
}) {
  const limit =
    kind === 'release' ? row.remaining_quantity : Math.min(row.remaining_quantity, row.available_for_issue)
  const [quantity, setQuantity] = useState(String(limit)),
    [note, setNote] = useState(''),
    [received, setReceived] = useState(''),
    [when, setWhen] = useState(localNowInput)
  const [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const q = Number(quantity.replace(',', '.')),
    valid =
      quantity.trim() &&
      Number.isFinite(q) &&
      q > 0 &&
      q <= limit &&
      note.trim() &&
      (kind === 'release' || received.trim())
  function changed() {
    setKey(crypto.randomUUID())
    setError('')
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      const result = await call<Reservation>('/' + row.id + '/' + kind, 'POST', {
        request_id: key,
        version: row.version,
        quantity: quantity.replace(',', '.'),
        note,
        ...(kind === 'issue' ? { received_by: received, occurred_at: localInputToIso(when) } : {}),
      })
      onSaved(result)
    } catch (e) {
      setError(text(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={kind === 'release' ? 'Снятие резерва' : 'Выдача из резерва'}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !valid} onClick={() => void save()}>
            {kind === 'release' ? 'Снять резерв' : 'Оформить выдачу'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          {row.material_title} · {row.purpose}
        </p>
        <p className="text-muted">
          {kind === 'release'
            ? 'Снятое количество снова станет свободным. Товар останется на складе.'
            : 'Будет создан документ отпуска. Физический остаток и резерв уменьшатся вместе.'}{' '}
          Доступно: {number(limit)} {row.unit}.
        </p>
        <Field label="Количество">
          <Input
            aria-label="Количество действия с резервом"
            inputMode="decimal"
            value={quantity}
            disabled={busy}
            onChange={(e) => {
              changed()
              setQuantity(e.target.value)
            }}
          />
        </Field>
        <Field label="Основание">
          <Input
            aria-label="Основание действия с резервом"
            value={note}
            maxLength={500}
            disabled={busy}
            onChange={(e) => {
              changed()
              setNote(e.target.value)
            }}
          />
        </Field>
        {kind === 'issue' && (
          <>
            <Field label="Получатель">
              <Input
                aria-label="Получатель резерва"
                value={received}
                maxLength={255}
                disabled={busy}
                onChange={(e) => {
                  changed()
                  setReceived(e.target.value)
                }}
              />
            </Field>
            <Field label="Дата и время">
              <Input
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
          </>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
