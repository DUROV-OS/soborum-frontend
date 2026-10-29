import { useCallback, useEffect, useState } from 'react'
import { useQueryChoice } from '@/shared/lib/useQueryChoice'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { DataTable } from '@/shared/ui/DataTable'
import { Chip } from '@/shared/ui/Chip'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useWarehouseStore } from '../store'
import * as api from '../documents'
import { localInputToIso, localNowInput } from './OperationLinesEditor'

const message = (e: unknown) => (e instanceof Error ? e.message : 'Не удалось выполнить действие')
const qty = (value: string) => value.trim().replace(',', '.')
const number = (value: string | number | null | undefined) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const PAGE = 40

export function StockDocumentsPanel() {
  const level = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(level, 'edit'),
    canFull = accessLevelAtLeast(level, 'full')
  const [kind, setKind] = useQueryChoice<api.StockDocumentKind | ''>(
    'kind',
    ['', 'transfer', 'inventory'],
    '',
  )
  const [archive, setArchive] = useState('active')
  const [page, setPage] = useState(0)
  const [list, setList] = useState<{ total: number; items: api.StockDocument[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState<api.StockDocumentKind | null>(null)
  const [selected, setSelected] = useState<api.StockDocument | null>(null)
  useEffect(() => {
    setPage(0)
    setSelected(null)
  }, [kind])
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setList(await api.listStockDocuments({ kind: kind || undefined, archive, offset: page * 50 }))
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }, [kind, archive, page])
  useEffect(() => {
    void load()
  }, [load])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Вид складского документа"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind)
            setPage(0)
          }}
          className="w-full sm:w-56"
        >
          <option value="">Все документы</option>
          <option value="transfer">Перемещения</option>
          <option value="inventory">Инвентаризации</option>
        </Select>
        <Select
          aria-label="Архив складских документов"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setPage(0)
          }}
          className="w-full sm:w-44"
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
        <Button variant="secondary" onClick={() => void load()}>
          Обновить
        </Button>
        {canEdit && (
          <>
            <Button onClick={() => setCreating('transfer')}>Переместить</Button>
            <Button variant="secondary" onClick={() => setCreating('inventory')}>
              Начать инвентаризацию
            </Button>
          </>
        )}
      </div>
      <p className="text-[13px] text-muted">
        Черновики сохраняют состав и учётный остаток. Остатки меняются при проведении. История МойСклада уже
        учтена в начальных остатках.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <DataTable
        rows={error ? [] : list.items}
        loading={loading}
        keyOf={(r) => String(r.id)}
        onRowClick={setSelected}
        columns={[
          {
            header: 'Документ',
            accessor: (r) => (
              <div>
                <div className="font-medium">
                  {api.KIND_LABEL[r.kind]} № {r.number}
                </div>
                <div className="text-xs text-muted">{new Date(r.occurred_at).toLocaleString('ru-RU')}</div>
              </div>
            ),
          },
          {
            header: 'Склад',
            accessor: (r) => (
              <div>
                {r.warehouse}
                {r.target_warehouse && <div className="text-xs text-muted">→ {r.target_warehouse}</div>}
              </div>
            ),
          },
          { header: 'Позиций', accessor: (r) => r.lines.length, align: 'right' },
          {
            header: 'Статус',
            accessor: (r) => (
              <Chip tone={r.status === 'posted' ? 'success' : 'neutral'}>
                {r.archived ? 'Архив · ' : ''}
                {api.STATUS_LABEL[r.status]}
              </Chip>
            ),
          },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">Документов: {error ? '—' : list.total}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={!page} onClick={() => setPage((v) => v - 1)}>
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={(page + 1) * 50 >= list.total}
            onClick={() => setPage((v) => v + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
      {creating && (
        <CreateDocument
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={(row) => {
            setCreating(null)
            setSelected(row)
            void load()
          }}
        />
      )}
      {selected && (
        <DocumentDetail
          key={selected.id}
          initial={selected}
          canEdit={canEdit}
          canFull={canFull}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}

function CreateDocument({
  kind,
  onClose,
  onSaved,
}: {
  kind: api.StockDocumentKind
  onClose: () => void
  onSaved: (r: api.StockDocument) => void
}) {
  const materials = useWarehouseStore((s) => s.materials)
  const warehouses = Array.from(new Set(materials.map((m) => m.warehouse))).sort()
  const [warehouse, setWarehouse] = useState(warehouses[0] || '')
  const [target, setTarget] = useState(warehouses[1] || '')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState('')
  const [ids, setIds] = useState<number[]>([])
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [page, setPage] = useState(0)
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(localNowInput)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const available = materials.filter((m) => m.warehouse === warehouse && !m.is_archived)
  const choices = available
    .filter(
      (m) => !ids.includes(m.id) && (m.title + ' ' + m.code).toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 80)
  const selected = ids.map((id) => materials.find((m) => m.id === id)!).filter(Boolean)
  function changed() {
    setRequestId(crypto.randomUUID())
    setError('')
  }
  function setQuantity(id: number, value: string) {
    changed()
    setQuantities((v) => ({ ...v, [id]: value }))
  }
  async function save() {
    const occurredAt = localInputToIso(when)
    if (!occurredAt) {
      setError('Укажите дату и время')
      return
    }
    setSaving(true)
    setError('')
    try {
      const row = await api.createStockDocument({
        request_id: requestId,
        kind,
        warehouse,
        target_warehouse: kind === 'transfer' ? target : undefined,
        occurred_at: occurredAt,
        note,
        lines: ids.map((id) => ({
          material_id: id,
          quantity: quantities[id]?.trim() ? qty(quantities[id]) : null,
        })),
      })
      onSaved(row)
    } catch (e) {
      setError(message(e))
    } finally {
      setSaving(false)
    }
  }
  const valid =
    ids.length > 0 &&
    (!(kind === 'transfer') ||
      (target !== warehouse && ids.every((id) => Number(qty(quantities[id] || '')) > 0)))
  return (
    <Modal
      open
      title={kind === 'transfer' ? 'Новое перемещение' : 'Новая инвентаризация'}
      onClose={() => {
        if (!saving) onClose()
      }}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void save()} disabled={saving || !valid}>
            {saving ? 'Сохранение…' : 'Сохранить черновик'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {kind === 'transfer'
            ? 'Материалы уйдут с одного склада и поступят на другой при проведении. Для новой позиции будет создана карточка с тем же кодом и единицей.'
            : 'Выберите позиции для пересчёта. Система сохранит учётные остатки; затем внесите фактическое количество, включая нулевые остатки.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Склад">
            <Select
              aria-label="Склад документа"
              value={warehouse}
              disabled={saving}
              onChange={(e) => {
                changed()
                setWarehouse(e.target.value)
                setIds([])
                setPage(0)
              }}
            >
              {warehouses.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </Select>
          </Field>
          {kind === 'transfer' ? (
            <Field label="Склад назначения">
              <Select
                aria-label="Склад назначения"
                value={target}
                disabled={saving}
                onChange={(e) => {
                  changed()
                  setTarget(e.target.value)
                }}
              >
                {warehouses.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Дата и время">
            <Input
              aria-label="Дата складского документа"
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
          <Field label="Основание">
            <Input
              aria-label="Основание складского документа"
              value={note}
              maxLength={1000}
              disabled={saving}
              onChange={(e) => {
                changed()
                setNote(e.target.value)
              }}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Найти материал по названию или коду"
            className="sm:max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            aria-label="Добавить материал в документ"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="min-w-0 flex-1"
          >
            <option value="">Выберите материал</option>
            {choices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.code}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={saving || !picked || ids.includes(Number(picked))}
            onClick={() => {
              changed()
              setIds((v) => [...v, Number(picked)])
              setPicked('')
            }}
          >
            Добавить
          </Button>
        </div>
        {kind === 'inventory' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={saving || !available.length}
            onClick={() => {
              changed()
              setIds(available.map((m) => m.id))
              setPage(0)
            }}
          >
            Весь склад · {available.length} позиций
          </Button>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Материал</th>
                <th>Учётный остаток</th>
                <th>{kind === 'transfer' ? 'Переместить' : 'Факт (можно заполнить позже)'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {selected.slice(page * PAGE, (page + 1) * PAGE).map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    {m.title}
                    <div className="text-xs text-muted">
                      {m.code} · {m.unit}
                    </div>
                  </td>
                  <td className="pr-2">{number(m.quantity_in_stock)}</td>
                  <td>
                    <Input
                      aria-label={'Количество · ' + m.code}
                      className="min-w-[100px]"
                      inputMode="decimal"
                      disabled={saving}
                      value={quantities[m.id] || ''}
                      onChange={(e) => setQuantity(m.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        changed()
                        setIds((v) => v.filter((id) => id !== m.id))
                        setPage(0)
                      }}
                    >
                      Убрать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LinePager count={ids.length} page={page} onChange={setPage} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function DocumentDetail({
  initial,
  canEdit,
  canFull,
  onClose,
  onChanged,
}: {
  initial: api.StockDocument
  canEdit: boolean
  canFull: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [row, setRow] = useState(initial)
  const [note, setNote] = useState(initial.note)
  const [values, setValues] = useState(initial.lines.map((l) => l.quantity ?? ''))
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<'post' | 'recount' | 'archive' | null>(null)
  const [postKey, setPostKey] = useState(() => crypto.randomUUID())
  const editable = canEdit && !row.archived && row.status === 'draft'
  const dirty = note !== row.note || values.some((v, i) => v !== (row.lines[i].quantity ?? ''))
  function accept(next: api.StockDocument) {
    setRow(next)
    setNote(next.note)
    setValues(next.lines.map((l) => l.quantity ?? ''))
    onChanged()
  }
  async function run(action: () => Promise<api.StockDocument>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      accept(await action())
      setNotice(success)
      setConfirm(null)
    } catch (e) {
      setError(message(e))
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }
  async function post() {
    await run(async () => {
      const next = await api.postStockDocument(row, postKey)
      await useWarehouseStore.getState().load()
      useWarehouseStore.setState((s) => ({ operationsVersion: s.operationsVersion + 1 }))
      return next
    }, 'Документ проведён. Остатки обновлены.')
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose()
      }}
      title={api.KIND_LABEL[row.kind] + ' № ' + row.number}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Закрыть
          </Button>
          {editable && (
            <Button
              variant="secondary"
              disabled={busy || !dirty}
              onClick={() =>
                void run(
                  () =>
                    api.updateStockDocument(
                      row,
                      note,
                      row.lines.map((l, i) => ({
                        material_id: l.material_id!,
                        quantity: values[i].trim() ? qty(values[i]) : null,
                      })),
                    ),
                  'Черновик сохранён',
                )
              }
            >
              Сохранить
            </Button>
          )}
          {editable && (row.kind === 'transfer' || canFull) && (
            <Button
              disabled={busy || dirty || !note.trim() || row.lines.some((l) => l.quantity == null)}
              onClick={() => setConfirm('post')}
            >
              Провести
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chip tone={row.status === 'posted' ? 'success' : 'neutral'}>
            {row.archived ? 'Архив · ' : ''}
            {api.STATUS_LABEL[row.status]}
          </Chip>
          <span className="text-sm text-muted">{new Date(row.occurred_at).toLocaleString('ru-RU')}</span>
        </div>
        <p className="text-sm">
          {row.warehouse}
          {row.target_warehouse ? ' → ' + row.target_warehouse : ''}
        </p>
        {row.status === 'historical' && (
          <p className="rounded-md bg-surface-muted p-3 text-sm">
            Перенесённый документ МойСклада. Его движения уже включены в начальные остатки; повторное
            проведение недоступно.{row.source_state ? ' Статус источника: ' + row.source_state + '.' : ''}
          </p>
        )}
        {row.status === 'draft' && row.kind === 'inventory' && (
          <p className="text-sm text-muted">
            Сравните учётное и фактическое количество. Проведение исправит только разницу. При движении после
            начала пересчёта потребуется переснять остатки и пересчитать позиции.
          </p>
        )}
        <Field label="Основание">
          <Input
            aria-label="Основание документа"
            value={note}
            maxLength={1000}
            readOnly={!editable}
            disabled={busy}
            onChange={(e) => {
              setNote(e.target.value)
              setPostKey(crypto.randomUUID())
            }}
          />
        </Field>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2">Материал</th>
                {row.kind === 'inventory' && <th className="px-3">Учёт</th>}
                <th>{row.kind === 'inventory' ? 'Факт' : 'Количество'}</th>
                <th className="px-3">{row.kind === 'inventory' ? 'Разница' : 'Ед.'}</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.slice(page * PAGE, (page + 1) * PAGE).map((l, offset) => {
                const i = page * PAGE + offset
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-3">
                      {l.title}
                      <div className="text-xs text-muted">
                        {l.code} · {l.unit}
                      </div>
                    </td>
                    {row.kind === 'inventory' && (
                      <td className="px-3 tabular">{number(l.expected_quantity)}</td>
                    )}
                    <td>
                      {editable ? (
                        <Input
                          className="min-w-[100px]"
                          inputMode="decimal"
                          aria-label={'Факт · ' + l.code}
                          disabled={busy}
                          value={values[i]}
                          onChange={(e) => {
                            setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))
                            setPostKey(crypto.randomUUID())
                          }}
                        />
                      ) : (
                        number(l.quantity)
                      )}
                    </td>
                    <td className="px-3 tabular">
                      {row.kind === 'inventory'
                        ? values[i].trim() && l.expected_quantity != null
                          ? number(Number(qty(values[i])) - Number(l.expected_quantity))
                          : '—'
                        : l.unit}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <LinePager count={row.lines.length} page={page} onChange={setPage} />
        {dirty && <p className="text-sm text-muted">Перед проведением сохраните изменения.</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => api.getStockDocument(row.id), 'Документ перечитан')}
          >
            Перечитать документ
          </Button>
          {editable && row.kind === 'inventory' && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm('recount')}>
              Переснять остатки
            </Button>
          )}
          {canFull && (
            <Button size="sm" variant="ghost" disabled={busy || dirty} onClick={() => setConfirm('archive')}>
              {row.archived ? 'Вернуть из архива' : 'В архив'}
            </Button>
          )}
        </div>
        {confirm && (
          <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
            <p>
              {confirm === 'post'
                ? 'Провести документ? Остатки изменятся, строки станут недоступны для правки.'
                : confirm === 'recount'
                  ? 'Переснять текущие учётные остатки? Все введённые фактические количества будут очищены для повторного пересчёта.'
                  : row.archived
                    ? 'Вернуть документ из архива?'
                    : 'Архивировать документ? Его проведённые движения останутся в учёте.'}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void (confirm === 'post'
                    ? post()
                    : confirm === 'recount'
                      ? run(
                          () => api.recountStockDocument(row),
                          'Остатки пересняты. Внесите фактический пересчёт.',
                        )
                      : run(() => api.archiveStockDocument(row), 'Архив обновлён'))
                }
              >
                Подтвердить
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>
                Отмена
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-accent">
            {notice}
          </p>
        )}
      </div>
    </Modal>
  )
}

function LinePager({
  count,
  page,
  onChange,
}: {
  count: number
  page: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>
        Позиций: {count}
        {count > PAGE ? ` · ${page * PAGE + 1}–${Math.min((page + 1) * PAGE, count)}` : ''}
      </span>
      {count > PAGE && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={!page} onClick={() => onChange(page - 1)}>
            Предыдущие позиции
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={(page + 1) * PAGE >= count}
            onClick={() => onChange(page + 1)}
          >
            Следующие позиции
          </Button>
        </div>
      )}
    </div>
  )
}
