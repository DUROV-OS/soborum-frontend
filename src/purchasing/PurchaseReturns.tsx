import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Drawer } from '@/shared/ui/Drawer'
import { DataTable } from '@/shared/ui/DataTable'
import { localInputToIso, localNowInput } from '@/warehouse/components/OperationLinesEditor'

type Catalog = {
  suppliers: { id: number; name: string }[]
  materials: { id: number; title: string; unit: string; warehouse: string }[]
  accounts: { id: number; name: string }[]
}
type ReturnLine = {
  receipt_line: number
  material_id: number | null
  title: string
  unit: string
  quantity: string
  unit_price: string
}
type Receipt = {
  id: number
  number: string
  status: string
  lines: {
    receipt_line: number
    material_id: number | null
    title: string
    unit: string
    unit_price: number
    returnable_quantity: number
    returned_quantity: number
    stock_tracked: boolean
  }[]
}
type Return = {
  cancelled: boolean
  cancellation_note: string | null
  id: number
  number: string
  receipt_id: number
  receipt_number: string
  supplier_id: number
  occurred_at: string
  note: string
  amount: number
  currency: string
  archived: boolean
  version: number
  lines: ReturnLine[]
  refunded: number
  refund_pending: number
  refund_available: number
  refunds: { id: number; amount: number; status: string }[]
}
const call = <T,>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) =>
  apiRequest<T>({ section: 'purchasing', path, method, body })
const money = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
const qty = (n: string | number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Не удалось выполнить действие')
const parse = (s: string) => s.trim().replace(',', '.')
const statuses: Record<string, string> = {
  draft: 'На согласовании',
  approved: 'Согласовано',
  posted: 'Получено',
  cancelled: 'Отменено',
}

export function PurchaseReturnsPanel({
  catalog,
  canEdit,
  canArchive,
  canCancel,
}: {
  catalog: Catalog
  canEdit: boolean
  canArchive: boolean
  canCancel: boolean
}) {
  const [archive, setArchive] = useState('active'),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0)
  const [data, setData] = useState<{ total: number; items: Return[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Return | null>(null),
    [refunding, setRefunding] = useState<Return | null>(null)
  const [cancelling, setCancelling] = useState<Return | null>(null)
  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    call<typeof data>(`/returns?archive=${archive}&offset=${page * 50}`)
      .then((d) => {
        if (current) setData(d)
      })
      .catch((e) => {
        if (current) setError(errorText(e))
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [archive, page, revision])
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('return')
    if (id && /^\d+$/.test(id))
      call<Return>('/returns/' + id)
        .then(setSelected)
        .catch((e) => setError(errorText(e)))
  }, [])
  async function refresh(id?: number) {
    setRevision((v) => v + 1)
    if (id) setSelected(await call<Return>('/returns/' + id))
  }
  async function archiveReturn() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      setSelected(
        await call<Return>(`/returns/${selected.id}/archive`, 'POST', {
          version: selected.version,
          archived: !selected.archived,
        }),
      )
      setRevision((v) => v + 1)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted">
        Откройте приёмку, чтобы оформить возврат поставщику. Возврат списывает товар и уменьшает стоимость
        закупки; деньги учитываются отдельной проводкой после согласования.
      </p>
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="Архив возвратов"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setPage(0)
          }}
          className="w-full sm:w-48"
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все</option>
        </Select>
        <Button variant="secondary" onClick={() => void refresh(selected?.id)}>
          Обновить возвраты
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <DataTable
        rows={data.items}
        keyOf={(r) => String(r.id)}
        onRowClick={setSelected}
        loading={loading}
        columns={[
          { header: 'Возврат', accessor: (r) => '№ ' + r.number + (r.cancelled ? ' · Отменён' : '') },
          { header: 'Приёмка', accessor: (r) => '№ ' + r.receipt_number },
          {
            header: 'Поставщик',
            accessor: (r) => catalog.suppliers.find((s) => s.id === r.supplier_id)?.name || '—',
          },
          { header: 'Сумма', accessor: (r) => money(r.amount) },
          { header: 'Деньги получены', accessor: (r) => money(r.refunded) },
          { header: 'Дата', accessor: (r) => new Date(r.occurred_at).toLocaleDateString('ru-RU') },
        ]}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>Возвратов: {data.total}</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!page || loading}
            onClick={() => setPage((v) => v - 1)}
          >
            Назад
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={(page + 1) * 50 >= data.total || loading}
            onClick={() => setPage((v) => v + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
      <Drawer
        open={!!selected}
        title={selected ? 'Возврат № ' + selected.number : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <p>
              {catalog.suppliers.find((s) => s.id === selected.supplier_id)?.name} · Приёмка №{' '}
              {selected.receipt_number}
            </p>
            <p className="text-lg font-medium">
              {money(selected.amount)}
              {selected.archived ? ' · Архив' : ''}
            </p>
            {selected.cancelled && (
              <p className="text-muted">Возврат отменён. {selected.cancellation_note}</p>
            )}
            {!selected.cancelled && (
              <p className="text-muted">
                Товар списан. Архивирование документа сохраняет движения и уменьшение долга.
              </p>
            )}
            <DataTable
              rows={selected.lines}
              keyOf={(l) => String(l.receipt_line)}
              columns={[
                { header: 'Материал', accessor: (l) => l.title },
                { header: 'Возвращено', accessor: (l) => qty(l.quantity) + ' ' + l.unit },
                { header: 'Цена приёмки', accessor: (l) => money(Number(l.unit_price)) },
              ]}
            />
            <p>{selected.note}</p>
            <p>
              Деньги получены: {money(selected.refunded)} · На согласовании: {money(selected.refund_pending)}
            </p>
            {selected.refunds.map((m) => (
              <Link className="block text-accent underline" key={m.id} to={'/accounting?movement=' + m.id}>
                Проводка № {m.id} · {money(m.amount)} · {statuses[m.status] || m.status}
              </Link>
            ))}
            <div className="flex flex-wrap gap-2">
              {canEdit && !selected.archived && !selected.cancelled && selected.refund_available > 0 && (
                <Button onClick={() => setRefunding(selected)}>Оформить получение денег</Button>
              )}
              {canCancel && !selected.archived && !selected.cancelled && (
                <Button variant="secondary" onClick={() => setCancelling(selected)}>
                  Отменить возврат
                </Button>
              )}
              {canArchive && (
                <Button disabled={busy} variant="secondary" onClick={() => void archiveReturn()}>
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
            </div>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Drawer>
      {cancelling && (
        <CancelEditor
          row={cancelling}
          onClose={() => setCancelling(null)}
          onSaved={async () => {
            const id = cancelling.id
            setCancelling(null)
            await refresh(id)
          }}
        />
      )}
      {refunding && (
        <RefundEditor
          row={refunding}
          catalog={catalog}
          onClose={() => setRefunding(null)}
          onSaved={async () => {
            const id = refunding.id
            setRefunding(null)
            await refresh(id)
          }}
        />
      )}
    </div>
  )
}

export function PurchaseReturnEditor({
  receiptId,
  catalog,
  onClose,
  onSaved,
}: {
  receiptId: number
  catalog: Catalog
  onClose: () => void
  onSaved: () => void
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false)
  const [note, setNote] = useState(''),
    [when, setWhen] = useState(localNowInput)
  const [quantities, setQuantities] = useState<Record<number, string>>({}),
    [mappings, setMappings] = useState<Record<number, string>>({})
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [search, setSearch] = useState('')
  useEffect(() => {
    call<Receipt>('/receipts/' + receiptId)
      .then(setReceipt)
      .catch((e) => setError(errorText(e)))
  }, [receiptId])
  function changed() {
    setKey(crypto.randomUUID())
    setError('')
  }
  const lines = receipt?.lines.filter((l) => quantities[l.receipt_line]?.trim()) || []
  const valid =
    lines.length > 0 &&
    note.trim() &&
    lines.every(
      (l) =>
        Number.isFinite(Number(parse(quantities[l.receipt_line]))) &&
        Number(parse(quantities[l.receipt_line])) > 0 &&
        Number(parse(quantities[l.receipt_line])) <= l.returnable_quantity &&
        (!l.stock_tracked || l.material_id || mappings[l.receipt_line]),
    )
  async function submit() {
    const occurred = localInputToIso(when)
    if (!occurred) {
      setError('Укажите дату и время')
      return
    }
    setSaving(true)
    setError('')
    try {
      await call('/returns', 'POST', {
        request_id: key,
        receipt_id: receiptId,
        occurred_at: occurred,
        note,
        lines: lines.map((l) => ({
          receipt_line: l.receipt_line,
          quantity: parse(quantities[l.receipt_line]),
          material_id: l.material_id || Number(mappings[l.receipt_line]) || null,
        })),
      })
      onSaved()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  const amount = lines.reduce((sum, l) => sum + Number(parse(quantities[l.receipt_line])) * l.unit_price, 0)
  return (
    <Modal
      open
      title={receipt ? 'Возврат по приёмке № ' + receipt.number : 'Возврат поставщику'}
      width="max-w-3xl"
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={saving || !valid} onClick={() => void submit()}>
            {saving ? 'Оформление…' : 'Оформить возврат'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Укажите фактически возвращаемое количество. Проведение спишет товар со склада и уменьшит долг по
          связанному заказу. Деньги этим действием не проводятся.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Дата и время">
            <Input
              aria-label="Дата возврата"
              type="datetime-local"
              value={when}
              max={localNowInput()}
              disabled={saving}
              onChange={(e) => {
                changed()
                setWhen(e.target.value)
              }}
            />
          </Field>
          <Field label="Причина возврата" required>
            <Input
              aria-label="Причина возврата"
              value={note}
              maxLength={500}
              disabled={saving}
              onChange={(e) => {
                changed()
                setNote(e.target.value)
              }}
            />
          </Field>
        </div>
        {receipt && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th>Материал</th>
                  <th className="px-3">Можно вернуть</th>
                  <th>Вернуть</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((l) => (
                  <tr className="border-t border-border" key={l.receipt_line}>
                    <td className="py-3 pr-3">
                      {l.title}
                      <div className="text-xs text-muted">
                        {money(l.unit_price)} за {l.unit || 'ед.'}
                      </div>
                      {l.stock_tracked && !l.material_id && (
                        <div className="mt-2 space-y-1">
                          <Input
                            placeholder="Найти складской материал"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <Select
                            aria-label={'Сопоставление строки ' + l.receipt_line}
                            value={mappings[l.receipt_line] || ''}
                            onChange={(e) => {
                              changed()
                              setMappings((v) => ({ ...v, [l.receipt_line]: e.target.value }))
                            }}
                          >
                            <option value="">Выберите карточку</option>
                            {catalog.materials
                              .filter(
                                (m) =>
                                  m.title.toLowerCase().includes(search.toLowerCase()) ||
                                  String(m.id) === mappings[l.receipt_line],
                              )
                              .slice(0, 80)
                              .map((m) => (
                                <option value={m.id} key={m.id}>
                                  {m.title} · {m.warehouse} · {m.unit}
                                </option>
                              ))}
                          </Select>
                        </div>
                      )}
                    </td>
                    <td className="px-3">
                      {qty(l.returnable_quantity)} {l.unit}
                    </td>
                    <td>
                      <Input
                        aria-label={'Вернуть строку ' + l.receipt_line}
                        inputMode="decimal"
                        className="min-w-[100px]"
                        disabled={saving || l.returnable_quantity <= 0}
                        value={quantities[l.receipt_line] || ''}
                        onChange={(e) => {
                          changed()
                          setQuantities((v) => ({ ...v, [l.receipt_line]: e.target.value }))
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="font-medium">Сумма возврата: {money(amount)}</p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function CancelEditor({ row, onClose, onSaved }: { row: Return; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit() {
    setBusy(true)
    setError('')
    try {
      await call(`/returns/${row.id}/cancel`, 'POST', { request_id: key, version: row.version, note })
      onSaved()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title="Отмена возврата поставщику"
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Закрыть
          </Button>
          <Button disabled={busy || !note.trim()} onClick={() => void submit()}>
            Подтвердить отмену
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          Будет создано встречное оприходование товара и восстановлена стоимость заказа. Сначала отмените
          связанные денежные проводки. Исходный документ и движения останутся в истории.
        </p>
        <Field label="Причина отмены">
          <Input
            aria-label="Причина отмены возврата"
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

function RefundEditor({
  row,
  catalog,
  onClose,
  onSaved,
}: {
  row: Return
  catalog: Catalog
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(row.refund_available)),
    [account, setAccount] = useState(String(catalog.accounts[0]?.id || ''))
  const [key, setKey] = useState(() => crypto.randomUUID()),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('')
  async function submit() {
    setSaving(true)
    setError('')
    try {
      await call(`/returns/${row.id}/refunds`, 'POST', {
        request_id: key,
        amount: parse(amount),
        account_id: Number(account),
      })
      onSaved()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      title="Получение денег от поставщика"
      onClose={() => {
        if (!saving) onClose()
      }}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={
              saving ||
              !account ||
              !(Number(parse(amount)) > 0) ||
              Number(parse(amount)) > row.refund_available
            }
            onClick={() => void submit()}
          >
            На согласование
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Создаётся проводка поступления на согласование. Отметьте её проведённой в бухгалтерии после
          подтверждения поступления денег. Остаток: {money(row.refund_available)}.
        </p>
        <Field label="Сумма">
          <Input
            aria-label="Сумма возврата денег"
            inputMode="decimal"
            value={amount}
            disabled={saving}
            onChange={(e) => {
              setAmount(e.target.value)
              setKey(crypto.randomUUID())
            }}
          />
        </Field>
        <Field label="Банковский счёт">
          <Select
            aria-label="Счёт возврата денег"
            value={account}
            disabled={saving}
            onChange={(e) => {
              setAccount(e.target.value)
              setKey(crypto.randomUUID())
            }}
          >
            {catalog.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
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
