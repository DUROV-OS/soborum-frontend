import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, PackageCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import * as api from './controlApi'
import { useWarehouseStore } from './store'
import { formatQuantity, queueState, stockQuantities } from './queueState'

const message = (error: unknown) => error instanceof Error ? error.message : 'Не удалось загрузить данные'
const PAGE_SIZE = 8

function StockAnomalies({ rows, onCount, onMaterial }: {
  rows: api.Queue['stock_anomalies']; onCount: () => void; onMaterial: (id: number) => Promise<void>
}) {
  const [query, setQuery] = useState(''), [kind, setKind] = useState('all'), [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState(true), [error, setError] = useState(''), [opening, setOpening] = useState<number | null>(null)
  const filtered = rows.filter(row => `${row.title} ${row.material_id}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
    .filter(row => kind === 'all' || (kind === 'stock' ? row.stock < 0 : row.stock >= 0 && row.available < 0))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), current = Math.min(page, pages - 1)
  async function open(id: number) {
    setOpening(id); setError('')
    try { await onMaterial(id) } catch (err) { setError(message(err)) } finally { setOpening(null) }
  }
  if (!rows.length) return null
  return <section aria-label="Сверка складских остатков" className="rounded-xl border border-warning/40 bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-semibold">Требуется сверка остатков: {rows.length} поз.</h3><p className="mt-1 text-xs text-muted">Отрицательный остаток: {rows.filter(r => r.stock < 0).length} · Резервы превышают остаток: {rows.filter(r => r.stock >= 0 && r.available < 0).length}</p></div>
      <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls="stock-anomaly-list" onClick={() => setExpanded(v => !v)}>{expanded ? 'Свернуть список' : 'Показать список'}</Button>
    </div>
    <p className="mt-3 text-sm text-muted">Здесь учётные остатки, а не результат физического пересчёта. Откройте товар и историю движений, проверьте приход и выдачу. Подтверждённое расхождение оформите документом пересчёта.</p>
    {expanded && <div id="stock-anomaly-list" className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_260px]"><Input aria-label="Поиск товара для сверки" placeholder="Название или номер материала" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }}/><Select aria-label="Причина сверки" value={kind} onChange={e => { setKind(e.target.value); setPage(0) }}><option value="all">Все причины</option><option value="stock">Отрицательный остаток</option><option value="reserve">Превышение резервов</option></Select></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="divide-y divide-border">{filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map(row => {
        const qty = stockQuantities(row.stock, row.available)
        return <article key={row.material_id} className="py-3 first:pt-0">
          <button className="max-w-full break-words text-left text-sm font-semibold text-brand-dark underline-offset-2 hover:underline" disabled={opening !== null} onClick={() => void open(row.material_id)}>{row.title}</button>
          <p className="mt-1 text-xs text-warning">№{row.material_id} · {row.stock < 0 ? 'Отрицательный учётный остаток' : 'Резервы превышают остаток'}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted">Учётный остаток</dt><dd className={`mt-1 tabular-nums font-semibold ${row.stock < 0 ? 'text-danger' : ''}`}>{formatQuantity(row.stock)} {row.unit}</dd></div><div><dt className="text-muted">В резерве</dt><dd className="mt-1 tabular-nums">{formatQuantity(qty.reserved)} {row.unit}</dd></div><div><dt className="text-muted">Свободно к выдаче</dt><dd className="mt-1 tabular-nums">{formatQuantity(qty.issuable)} {row.unit}</dd></div></dl>
        </article>
      })}</div>
      {filtered.length === 0 && <p className="text-sm text-muted">По этому фильтру товаров нет.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-muted">Найдено: {filtered.length} · Страница {current + 1} из {pages}</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Назад</Button><Button size="sm" variant="secondary" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Далее</Button></div></div>
    </div>}
    <Button size="sm" variant="secondary" className="mt-4" onClick={onCount}>Открыть пересчёт</Button>
  </section>
}

export function WarehouseQueue({ onIssue, onRequests, onCount, onMaterial }: {
  onIssue: (id: number) => void; onRequests: () => void; onCount: () => void; onMaterial: (id: number) => Promise<void>
}) {
  const [data, setData] = useState<api.Queue | null>(null), [error, setError] = useState(''), [query, setQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const operationsVersion = useWarehouseStore(s => s.operationsVersion)
  useEffect(() => {
    let active = true
    setData(null); setError('')
    api.getQueue().then(value => { if (active) setData(value) }).catch(err => { if (active) setError(message(err)) })
    return () => { active = false }
  }, [operationsVersion, revision])
  const houses = data?.houses.filter(h => `${h.house_name} ${h.house_model_title || ''} ${h.client_name || ''} ${h.production_id}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) || []
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Выдача в производство</h2><p className="mt-1 text-sm text-muted">Согласование → частичная выдача → документированный возврат</p></div><Button variant="secondary" size="sm" onClick={() => setRevision(v => v + 1)}>Обновить очередь</Button></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{[
      { title: 'Нет состава техкарты', value: data?.houses.filter(h => queueState(h) === 'missing_norm').length, icon: ClipboardCheck },
      { title: 'Ждут согласования', value: data?.houses.filter(h => queueState(h) === 'approval').length, icon: ClipboardCheck },
      { title: 'Можно комплектовать', value: data?.houses.filter(h => queueState(h) === 'issuing' && h.available_positions > 0).length, icon: PackageCheck },
      { title: 'Есть нехватка', value: data?.houses.filter(h => h.remaining_positions > 0 && h.shortage_positions > 0).length, icon: RotateCcw },
    ].map(card => <div key={card.title} className="min-w-0 rounded-xl border border-border bg-surface p-3 sm:p-4"><card.icon size={18} className="text-brand-dark"/><p className="mt-3 text-2xl font-semibold">{card.value ?? '—'}</p><p className="mt-1 text-xs text-muted">{card.title}</p></div>)}</div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Input aria-label="Поиск дома в очереди" placeholder="Найти дом, клиента или номер производства" value={query} onChange={e => setQuery(e.target.value)}/>
    {!data && !error && <p role="status" className="text-sm text-muted">Загружаем очередь…</p>}
    {data && houses.length === 0 && <p className="text-sm text-muted">Подходящих домов нет.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{houses.map(h => {
      const state = queueState(h)
      return <article key={h.production_id} className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{h.house_name}{h.house_model_title && h.house_model_title !== h.house_name ? ` · ${h.house_model_title}` : ''}</h3><p className="mt-1 text-xs text-muted">Производство №{h.production_id}{h.client_name ? ` · ${h.client_name}` : ''}</p></div>{h.control.approved && state !== 'missing_norm' && <CheckCircle2 aria-label="Норматив согласован" size={18} className="shrink-0 text-success"/>}</div>
        <p className={`mt-3 text-sm ${state === 'missing_norm' || state === 'check' ? 'text-warning' : ''}`}>{state === 'missing_norm' ? 'В техкарте нет материалов к выдаче. Начальнику производства нужно проверить состав и количества.' : state === 'completed' ? 'По согласованному нормативу выдача завершена' : state === 'check' ? 'Нет позиций к выдаче. Требуется проверка норматива и истории выдач.' : `Осталось выдать: ${h.remaining_positions} поз. · Доступно сейчас: ${h.available_positions} поз.`}</p>
        <p className="mt-2 text-xs text-muted">{h.control.approved ? `Норматив согласован${h.control.responsible?.name ? `: ${h.control.responsible.name}` : ''}` : h.control.reason || 'Требуется согласование начальника производства'}</p>
        {h.remaining_positions > 0 && h.shortage_positions > 0 && <p className="mt-2 text-xs text-warning">Нехватка: {h.shortage_positions} поз.{state === 'issuing' ? ' Доступные материалы можно выдать отдельно.' : ''}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{data?.can_edit && <Button size="sm" disabled={state !== 'issuing' || h.available_positions <= 0} onClick={() => onIssue(h.production_id)}>Комплектовать</Button>}{h.requested_positions > 0 && <Button size="sm" variant="secondary" onClick={onRequests}>Заявки: {h.requested_positions} поз.</Button>}{h.control.document && <Button size="sm" variant="ghost" onClick={() => void api.downloadProof(h.control.document!).catch(err => setError(message(err)))}>Документ</Button>}</div>
      </article>
    })}</div>
    {data && <StockAnomalies rows={data.stock_anomalies} onCount={onCount} onMaterial={onMaterial}/>}
  </div>
}
