import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, GripVertical, Plus, RefreshCw, UserRound } from 'lucide-react'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import * as api from './api'
import type { Catalog, Entry } from './api'
import { CrmInboxColumn } from './CrmInboxColumn'

const PAGE_SIZE = 25
type Column = { items: Entry[]; total: number; offset: number; loading: boolean; error: string }
type Transfer = { entry: Entry; pipeline: string; stage: string; reason: string }
const emptyColumn = (): Column => ({ items: [], total: 0, offset: 0, loading: true, error: '' })
const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось загрузить сделки'
const amount = (entry: Entry) => `${Number(entry.data.amount || 0).toLocaleString('ru-RU')} ${entry.data.currency === 'RUB' || !entry.data.currency ? '₽' : String(entry.data.currency)}`

export function CrmBoard({ catalog, pipeline, stage, query, archive, owner, revision, canEdit, onPipeline, onOpen, onCreate, onTask, onAccept, onChanged, onList }: {
  catalog: Catalog; pipeline: string; stage: string; query: string; archive: string; owner: string; revision: number; canEdit: boolean
  onPipeline: (id: string) => void; onOpen: (entry: Entry) => void; onCreate: (stage: Entry) => void
  onTask: (entry: Entry) => void; onChanged: () => void; onList: () => void
  onAccept: (entry: Entry, targetStage?: Entry, targetPipeline?: string) => void
}) {
  const stages = useMemo(() => catalog.stages.filter(s => String(s.data.pipeline_id) === pipeline && (!stage || String(s.id) === stage))
    .sort((a, b) => Number(a.data.sort) - Number(b.data.sort) || a.id - b.id), [catalog.stages, pipeline, stage])
  const stageKey = stages.map(s => s.id).join(',')
  const newStage = catalog.stages.filter(s => String(s.data.pipeline_id) === pipeline && s.data.outcome === 'open').sort((a,b) => Number(a.data.sort)-Number(b.data.sort) || a.id-b.id)[0]
  const [columns, setColumns] = useState<Record<number, Column>>({})
  const [total, setTotal] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState<number | null>(null)
  const [transfer, setTransfer] = useState<Transfer | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [over, setOver] = useState('')
  const [inboxCount, setInboxCount] = useState<number | null>(null)
  const [summary, setSummary] = useState<api.KanbanSummary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const dragged = useRef<Entry | null>(null)
  const generation = useRef(0)
  const saving = useRef(false)
  const pageLoads = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    setSummary(null); setSummaryError(false)
    if (!pipeline) return
    const timer = window.setTimeout(() => {
      api.kanbanSummary({ pipeline_id: Number(pipeline), query, archive, owner_id: owner === '' ? undefined : Number(owner) }).then(result => {
        if (!Array.isArray(result.columns)) throw new Error('Неверный ответ сводки')
        if (!cancelled) setSummary(result)
      }).catch(() => { if (!cancelled) setSummaryError(true) })
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [pipeline, query, archive, owner, revision, reload])

  useEffect(() => {
    const run = ++generation.current
    let cancelled = false
    setColumns(Object.fromEntries(stages.map(s => [s.id, emptyColumn()])))
    setTotal(null)
    if (!pipeline) return
    // Count and page each stage independently: a busy first column must not hide other stages.
    const timer = window.setTimeout(async () => {
      const base = { query, archive, pipeline_id: Number(pipeline), owner_id: owner === '' ? undefined : Number(owner) }
      api.list('deal', { ...base, stage_id: stage ? Number(stage) : undefined, limit: 1 })
        .then(r => { if (!cancelled) setTotal(r.total) }).catch(() => {})
      const queue = [...stages]
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length && !cancelled) {
          const current = queue.shift()!
          try {
            const data = await api.list('deal', { ...base, stage_id: current.id, limit: PAGE_SIZE })
            if (!cancelled && generation.current === run) setColumns(previous => ({ ...previous,
              [current.id]: { ...data, offset: data.items.length, loading: false, error: '' } }))
          } catch (e) {
            if (!cancelled && generation.current === run) setColumns(previous => ({ ...previous,
              [current.id]: { ...emptyColumn(), loading: false, error: message(e) } }))
          }
        }
      }))
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer); generation.current++ }
    // Stage metadata changes do not discard a loaded page unless the IDs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, stage, stageKey, query, archive, owner, revision, reload])

  const loadMore = async (id: number) => {
    const column = columns[id], run = generation.current, key = `${run}:${id}`
    if (!column || column.loading || pageLoads.current.has(key)) return
    pageLoads.current.add(key)
    setColumns(previous => ({ ...previous, [id]: { ...column, loading: true, error: '' } }))
    try {
      const data = await api.list('deal', { query, archive, owner_id: owner === '' ? undefined : Number(owner), pipeline_id: Number(pipeline), stage_id: id, limit: PAGE_SIZE, offset: column.offset })
      if (generation.current === run) setColumns(previous => ({ ...previous, [id]: {
        total: data.total, offset: column.offset + data.items.length, loading: false, error: '',
        items: [...new Map([...column.items, ...data.items].map(item => [item.id, item])).values()],
      } }))
    } catch (e) {
      if (generation.current === run) setColumns(previous => ({ ...previous, [id]: { ...column, loading: false, error: message(e) } }))
    } finally { pageLoads.current.delete(key) }
  }

  const startTransfer = (entry: Entry, targetPipeline = String(entry.data.pipeline_id), targetStage = '') => {
    if (!canEdit || entry.archived || saving.current) return
    if (entry.kind === 'inquiry') { onAccept(entry, undefined, targetPipeline); return }
    setError(''); setNotice('')
    setTransfer({ entry, pipeline: targetPipeline, stage: targetStage, reason: '' })
  }
  const move = async (entry: Entry, target: Entry, reason = '') => {
    if (!canEdit || entry.archived || saving.current || entry.data.stage_id === target.id) return
    saving.current = true; setBusy(entry.id); setError(''); setNotice('')
    try {
      await api.patch(entry, { data: {
        pipeline_id: Number(target.data.pipeline_id), stage_id: target.id,
        ...(target.data.outcome === 'lost' ? { loss_reason: reason.trim() } : {}),
      } })
      setTransfer(null)
      setNotice(`«${entry.name}» → ${catalog.pipelines.find(p => p.id === target.data.pipeline_id)?.name} / ${target.name}`)
      if (String(target.data.pipeline_id) !== pipeline) onPipeline(String(target.data.pipeline_id))
      setReload(value => value + 1); onChanged()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setTransfer(null); setReload(value => value + 1)
        setError('Карточку уже изменил другой сотрудник. Доска обновлена. Повторите перенос с актуальными данными.')
      } else setError(`Перенос не сохранён. ${message(e)}`)
    } finally { saving.current = false; setBusy(null) }
  }
  const dropOnStage = (target: Entry) => {
    const entry = dragged.current
    dragged.current = null; setOver('')
    if (!entry || entry.data.stage_id === target.id) return
    if (entry.kind === 'inquiry') { onAccept(entry, target); return }
    if (target.data.outcome === 'lost' || target.data.outcome === 'won') startTransfer(entry, String(target.data.pipeline_id), String(target.id))
    else void move(entry, target)
  }
  const target = catalog.stages.find(s => String(s.id) === transfer?.stage && String(s.data.pipeline_id) === transfer?.pipeline)
  const allLoaded = stages.every(s => columns[s.id] && !columns[s.id].loading && !columns[s.id].error)
  const visibleTotal = stages.reduce((sum, s) => sum + (columns[s.id]?.total || 0), 0)
  const missing = allLoaded && total !== null ? total - visibleTotal : 0
  return <section aria-label="Канбан сделок" aria-busy={stages.some(s => !columns[s.id] || columns[s.id].loading)} data-pipeline-id={pipeline} className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted">{canEdit ? 'Перетащите карточку в другой этап или на название другой воронки.' : 'Доступен просмотр сделок.'}</p>
      <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />Обновить доску</Button>
    </div>
    <div aria-label="Воронки продаж" className="mb-4 flex gap-2 overflow-x-auto pb-2">
      {catalog.pipelines.map(p => <button key={p.id} type="button" aria-pressed={String(p.id) === pipeline}
        className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${over === `pipeline-${p.id}` ? 'border-brand bg-brand/10 ring-2 ring-brand/30' : String(p.id) === pipeline ? 'border-brand bg-brand text-white' : 'border-border bg-surface text-ink'}`}
        onClick={() => { if (!saving.current) onPipeline(String(p.id)) }}
        onDragOver={e => { if (dragged.current && canEdit && !saving.current) { e.preventDefault(); setOver(`pipeline-${p.id}`) } }}
        onDragLeave={() => setOver('')}
        onDrop={e => { e.preventDefault(); const entry = dragged.current; dragged.current = null; setOver(''); if (entry) startTransfer(entry, String(p.id)) }}>
        {p.name}
      </button>)}
    </div>
    {notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && !transfer && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-danger">{error}</p>}
    {missing > 0 && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">На скрытых или архивных этапах ещё {missing} сделок. <button className="font-medium underline" onClick={onList}>Открыть полный список</button></p>}
    {!pipeline ? <p className="rounded-xl border border-border p-6 text-sm text-muted">Добавьте воронку в разделе «Воронки и этапы».</p>
      : stages.length === 0 ? <p className="rounded-xl border border-border p-6 text-sm text-muted">В этой воронке нет доступных этапов. Их можно добавить в разделе «Воронки и этапы».</p>
      : <div className="flex max-w-full items-start gap-3 overflow-x-auto pb-5" tabIndex={0} aria-label="Этапы воронки">
        {stages.map(s => {
          const column = columns[s.id] || emptyColumn()
          const includesInbox = s.id === newStage?.id
          const count = column.total + (includesInbox ? inboxCount || 0 : 0)
          const sums = summary?.columns.find(item => item.stage_id === s.id)
          return <section key={s.id} aria-label={`Этап: ${s.name}`} data-stage-id={s.id}
            className={`w-[280px] shrink-0 overflow-hidden rounded-xl border bg-slate-50 ${over === `stage-${s.id}` ? 'border-brand ring-2 ring-brand/30' : 'border-border'}`}
            onDragOver={e => { if (dragged.current && canEdit && !saving.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(`stage-${s.id}`) } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver('') }}
            onDrop={e => { e.preventDefault(); dropOnStage(s) }}>
            <div className="border-t-4 px-3 pb-3 pt-3" style={{ borderTopColor: /^#[\da-f]{6}$/i.test(String(s.data.color)) ? String(s.data.color) : '#cbd5e1' }}>
              <div className="flex items-start gap-2"><h2 className="min-w-0 flex-1 text-sm font-semibold text-ink">{s.name}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted" aria-label={`Всего карточек: ${count}`} data-column-total={count}>{(column.loading && !column.items.length) || (includesInbox && inboxCount === null) ? '…' : column.error && !column.items.length ? '—' : count}</span></div>
              <div className="mt-2 text-xs" aria-label={`Бюджет этапа: ${s.name}`} data-stage-budget={s.id}>
                {summaryError ? <span className="text-danger">Не удалось загрузить сумму</span> : !summary ? <span className="text-muted">Считаем сумму…</span>
                  : <><p className="font-semibold text-ink">{sums && Object.keys(sums.amounts).length ? Object.entries(sums.amounts).map(([currency, value]) => `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${currency === 'RUB' ? '₽' : currency}`).join(' · ') : '0 ₽'}</p>
                    {!!sums?.unpriced_count && <p className="mt-1 text-muted">Без бюджета: {sums.unpriced_count}</p>}</>}
              </div>
              {canEdit && archive === 'active' && s.data.outcome !== 'lost' && s.data.outcome !== 'won' && <button type="button" className="mt-2 flex items-center gap-1 text-xs font-medium text-brand" onClick={() => onCreate(s)}><Plus size={14} />Добавить сделку</button>}
            </div>
            <div className="max-h-[66vh] min-h-48 space-y-2 overflow-y-auto px-2 pb-3">
              {includesInbox && <CrmInboxColumn catalog={catalog} pipeline={pipeline} query={query} archive={archive} owner={owner} revision={revision + reload} canEdit={canEdit && busy === null}
                onCount={setInboxCount} onOpen={onOpen} onAccept={entry => onAccept(entry)} onDragStart={entry => { dragged.current = entry }} onDragEnd={() => { dragged.current = null; setOver('') }} />}
              {column.items.map(entry => <article key={entry.id} data-deal-id={entry.id}
                draggable={canEdit && !entry.archived && busy === null}
                onDragStart={e => { if (!canEdit || entry.archived || saving.current) { e.preventDefault(); return } dragged.current = entry; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(entry.id)) }}
                onDragEnd={() => { dragged.current = null; setOver('') }}
                className={`rounded-lg border border-border bg-white p-3 shadow-sm ${busy === entry.id ? 'opacity-50' : canEdit && !entry.archived ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                <div className="flex items-start gap-1"><button type="button" className="min-w-0 flex-1 break-words text-left text-sm font-medium text-ink hover:text-brand" onClick={() => onOpen(entry)}>{entry.name}</button><GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" /></div>
                <p className="mt-3 text-[15px] font-semibold text-ink">{amount(entry)}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><UserRound size={13} className="shrink-0" />{catalog.users.find(u => u.id === entry.data.responsible_user_id)?.name || 'Ответственный не назначен'}</p>
                {entry.archived && <p className="mt-2 text-xs text-muted">В архиве</p>}
                {canEdit && !entry.archived && <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                  {s.data.outcome !== 'won' && s.data.outcome !== 'lost' && <button type="button" className="min-h-8 font-medium text-brand" onClick={() => onTask(entry)}>Следующий шаг</button>}
                  <button type="button" aria-label={`Переместить: ${entry.name}`} className="flex min-h-8 items-center gap-1 text-muted hover:text-brand" disabled={busy !== null} onClick={() => startTransfer(entry)}><ArrowRightLeft size={13} />Переместить</button>
                </div>}
              </article>)}
              {column.loading && <p role="status" className="p-3 text-xs text-muted">Загружаем сделки…</p>}
              {column.error && <div role="alert" className="p-3 text-xs text-danger"><p>{column.error}</p><button className="mt-2 underline" onClick={() => void loadMore(s.id)}>Повторить загрузку</button></div>}
              {!column.loading && !column.error && !column.total && (!includesInbox || inboxCount === 0) && <p className="px-2 py-8 text-center text-xs text-muted">{query || owner !== '' ? 'По этому запросу сделок нет' : canEdit ? 'Перетащите сюда сделку' : 'Нет сделок'}</p>}
              {column.offset < column.total && <button type="button" disabled={column.loading} className="min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium" onClick={() => void loadMore(s.id)}>Показать ещё · {column.items.length} из {column.total}</button>}
            </div>
          </section>
        })}
      </div>}
    <Modal open={!!transfer} onClose={() => { if (!saving.current) { setTransfer(null); setError('') } }} title="Переместить сделку"
      footer={<><Button variant="secondary" disabled={busy !== null} onClick={() => { setTransfer(null); setError('') }}>Отмена</Button><Button disabled={busy !== null || !target || target.id === transfer?.entry.data.stage_id || (target.data.outcome === 'lost' && !transfer?.reason.trim())}
        onClick={() => { if (transfer && target) void move(transfer.entry, target, transfer.reason) }}>{busy !== null ? 'Сохраняем…' : 'Переместить'}</Button></>}>
      {transfer && <div className="space-y-4"><p className="font-medium">{transfer.entry.name}</p>
        <Field label="Воронка назначения"><Select aria-label="Воронка назначения" value={transfer.pipeline} disabled={busy !== null} onChange={e => setTransfer({ ...transfer, pipeline: e.target.value, stage: '', reason: '' })}>{catalog.pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Этап назначения"><Select aria-label="Этап назначения" value={transfer.stage} disabled={busy !== null} onChange={e => setTransfer({ ...transfer, stage: e.target.value, reason: '' })}><option value="">Выберите этап</option>{catalog.stages.filter(s => String(s.data.pipeline_id) === transfer.pipeline).sort((a, b) => Number(a.data.sort) - Number(b.data.sort)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        {target?.data.outcome === 'lost' && <Field label="Причина отказа"><Textarea aria-label="Причина отказа" value={transfer.reason} maxLength={2000} disabled={busy !== null} onChange={e => setTransfer({ ...transfer, reason: e.target.value })} placeholder="Укажите фактическую причину отказа" /></Field>}
        {(target?.data.outcome === 'won' || target?.data.outcome === 'lost') && <p className="text-sm text-muted">Автоматические контрольные задачи будут закрыты. Остальные задачи по сделке проверьте отдельно.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>}
    </Modal>
  </section>
}
