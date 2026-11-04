import { useEffect, useState } from 'react'
import { useQueryChoice } from '@/shared/lib/useQueryChoice'
import { Link } from 'react-router-dom'
import { Plus, Users, Archive, Pencil, Download, Columns3, List } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Input, Select, Textarea, Field } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { CrmTaskClientBlock } from './CrmTaskClientBlock'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import * as api from './api'
import { Catalog, Entry, Kind, History } from './api'
import { LeadControl } from './LeadControl'
import { CrmBoard } from './CrmBoard'
import { CrmRecordCard } from './CrmRecordCard'
import { CrmTasksTable } from './CrmTasksTable'
import { TaskPriorityFilter } from '@/tasks/components/TaskPriorityFilter'
import type { TaskPriority } from '@/tasks/types'
import { CrmDateFilter, CrmDateSelection } from './CrmDateFilter'
import { crmDateQuery, crmSourceDateLabel } from './dates'

const labels: Record<Kind, string> = {
  deal: 'Сделки',
  contact: 'Контакты',
  company: 'Компании',
  task: 'Задачи',
  pipeline: 'Воронки',
  stage: 'Этапы',
  inquiry: 'Входящие',
}
const single: Record<Kind, string> = {
  deal: 'Сделка',
  contact: 'Контакт',
  company: 'Компания',
  task: 'Задача',
  pipeline: 'Воронка',
  stage: 'Этап',
  inquiry: 'Входящая заявка',
}
const money = (n: unknown) => Number(n ?? 0).toLocaleString('ru-RU') + ' ₽'
const localTime = (s: unknown) => {
  if (!s) return ''
  const d = new Date(String(s))
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const date = (s: unknown) => (s ? new Date(String(s)).toLocaleString('ru-RU') : 'Срок не указан')
const tabs: { key: Kind; label: string }[] = ['inquiry', 'deal', 'contact', 'company', 'task'].map((k) => ({
  key: k as Kind,
  label: labels[k as Kind],
}))

export function CrmPage() {
  const [catalog, setCatalog] = useState<Catalog>({ pipelines: [], stages: [], users: [], counts: {} })
  const [kind, setKind] = useQueryChoice<Kind>(
    'tab',
    ['inquiry', 'deal', 'contact', 'company', 'task', 'pipeline', 'stage'],
    'deal',
  )
  const [pipeline, setPipeline] = useQueryChoice('pipeline', catalog.pipelines.map(p => String(p.id)), '')
  const [view, setView] = useQueryChoice('view', ['board', 'list'] as const, 'board')
  const isBoard = kind === 'deal' && view === 'board'
  const boardPipeline = pipeline || String(catalog.pipelines[0]?.id || '')
  const [stage, setStage] = useState('')
  const [archive, setArchive] = useState('active')
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('')
  const [priority, setPriority] = useState<TaskPriority | ''>('')
  const [dates, setDates] = useState<CrmDateSelection>({ from: '', to: '', unknown: false })
  const [spam, setSpam] = useState<api.SpamFilter>('normal')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ total: number; items: Entry[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [history, setHistory] = useState<History>({ total: 0, items: [] })
  const [note, setNote] = useState('')
  const [attached, setAttached] = useState<{ total: number; items: SourceFile[] }>({ total: 0, items: [] })
  const [editing, setEditing] = useState<{ entry?: Entry; kind: Kind; inquiry?: Entry; related?: Entry; initialData?: Record<string, unknown>; initialName?: string } | null>(null)
  const [showControl, setShowControl] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fileLibrary, setFileLibrary] = useState(false)
  const level = useAccessLevel('clients')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  useEffect(() => {
    setOffset(0)
    setStage('')
    setSelected(null)
    setOwner('')
    setPriority('')
    setDates({ from: '', to: '', unknown: false })
    setSpam('normal')
  }, [kind])
  useEffect(() => {
    if (isBoard) return
    const interval = window.setInterval(() => { if (!document.hidden) setRevision(v=>v+1) }, 60000)
    return () => window.clearInterval(interval)
  }, [isBoard])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('entry')
    if (id && /^\d+$/.test(id)) apiRequest<Entry>({section:'crm',path:`/entries/${id}`}).then(open).catch(e=>setError(e.message))
  }, [])
  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [revision])
  useEffect(() => {
    if (isBoard) return
    let current = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      api
        .list(kind, {
          query,
          archive,
          owner_id: owner === '' ? undefined : Number(owner),
          priority: kind === 'task' && priority ? priority : undefined,
          ...(['deal', 'inquiry'].includes(kind) ? crmDateQuery(dates.from, dates.to, dates.unknown) : {}),
          spam: ['deal', 'inquiry'].includes(kind) ? spam : undefined,
          pipeline_id: kind === 'deal' && pipeline ? Number(pipeline) : undefined,
          stage_id: kind === 'deal' && stage ? Number(stage) : undefined,
          offset,
        })
        .then((r) => {
          if (current) setResult(r)
        })
        .catch((e) => {
          if (current) setError(e.message)
        })
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 200)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [kind, query, archive, owner, priority, dates, spam, pipeline, stage, offset, revision, isBoard])
  const refreshHistory = (entry: Entry, offset = 0) =>
    api
      .history(entry.id, offset)
      .then((h) =>
        setHistory((prev) => (offset ? { total: h.total, items: [...prev.items, ...h.items] } : h)),
      )
      .catch((e) => setError(e.message))
  const open = (entry: Entry) => {
    setSelected(entry)
    setHistory({ total: 0, items: [] })
    setAttached({ total: 0, items: [] })
    setNote('')
    if (['deal', 'inquiry', 'contact', 'company'].includes(entry.kind)) return
    refreshHistory(entry)
    apiRequest<{ total: number; items: SourceFile[] }>({ section: 'crm', path: `/entries/${entry.id}/files` })
      .then(setAttached)
      .catch((e) => setError(e.message))
  }
  const update = async (entry: Entry, fields: Parameters<typeof api.patch>[1]) => {
    setBusy(true)
    setError('')
    try {
      const next = await api.patch(entry, fields)
      setSelected(next)
      setRevision((v) => v + 1)
      refreshHistory(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }
  const selectedStage = catalog.stages.find((s) => s.id === selected?.data.stage_id)
  const acceptInquiry = async (inquiry: Entry, targetStage?: Entry, targetPipeline?: string) => {
    setError('')
    if (inquiry.data.is_spam === true) {
      setError('Сначала уберите отметку «Спам» в карточке заявки.')
      return
    }
    try {
      // Imported inquiries can wrap an existing unsorted deal. Keep its commercial data.
      const linked = inquiry.data.deal_id ? await apiRequest<Entry>({ section: 'crm', path: `/entries/${inquiry.data.deal_id}` }) : null
      if (linked && (linked.kind !== 'deal' || linked.archived)) throw new Error('Связанная сделка недоступна для принятия. Проверьте её историю.')
      const pid = Number(targetStage?.data.pipeline_id || targetPipeline || inquiry.data.pipeline_id || boardPipeline)
      const currentStage = catalog.stages.find(s => s.id === linked?.data.stage_id && s.data.pipeline_id === pid)
      const firstStage = catalog.stages.filter(s => s.data.pipeline_id === pid && s.data.outcome === 'open').sort((a,b) => Number(a.data.sort)-Number(b.data.sort))[0]
      setEditing({ kind: 'deal', inquiry,
        initialName: linked?.name || String(inquiry.data.contact_name || inquiry.name),
        initialData: { amount: 0, currency: 'RUB', ...linked?.data, pipeline_id: pid, stage_id: (targetStage || currentStage || firstStage)?.id, is_unsorted: false },
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось открыть заявку') }
  }
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-medium text-ink">CRM</h1>
          <p className="mt-1 text-[13px] text-muted">
            Сделки по этапам, контакты и следующие действия.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setFileLibrary(true)}>
            Файлы
          </Button>
          {canFull && (
            <Button
              variant="secondary"
              onClick={() => {
                setKind('pipeline')
                setOffset(0)
              }}
            >
              Воронки и этапы
            </Button>
          )}
          {canEdit && kind !== 'inquiry' && (
            <Button onClick={() => setEditing({ kind, initialData: kind === 'deal' && boardPipeline ? { pipeline_id: Number(boardPipeline), stage_id: catalog.stages.filter(s => String(s.data.pipeline_id) === boardPipeline && s.data.outcome === 'open').sort((a, b) => Number(a.data.sort) - Number(b.data.sort))[0]?.id, amount: 0, currency: 'RUB' } : undefined })}>
              <Plus size={16} />
              {single[kind]}
            </Button>
          )}
        </div>
      </div>
      <Tabs<Kind>
        tabs={
          (canFull ? [...tabs, { key: 'pipeline' as Kind, label: 'Воронки' }, { key: 'stage' as Kind, label: 'Этапы' }] : tabs).map(t => ({ ...t, label: catalog.counts[t.key] === undefined ? t.label : `${t.label} · ${catalog.counts[t.key].toLocaleString('ru-RU')}` }))
        }
        activeKey={kind}
        onChange={(k) => {
          setKind(k)
          setOffset(0)
          setStage('')
        }}
      />
      {kind === 'deal' && <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Вид сделок" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          <Button size="sm" variant={view === 'board' ? 'primary' : 'ghost'} aria-pressed={view === 'board'} onClick={() => setView('board')}><Columns3 size={16} />Канбан</Button>
          <Button size="sm" variant={view === 'list' ? 'primary' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />Список</Button>
        </div>
        <Button size="sm" variant="secondary" aria-expanded={showControl} onClick={() => setShowControl(value => !value)}>Контроль следующих шагов</Button>
      </div>}
      {showControl && <div className="mt-4"><LeadControl revision={revision} canEdit={canEdit} canFull={canFull} onOpen={open} onTask={related=>setEditing({kind:'task',related})}/></div>}
      <div className="my-4 flex flex-wrap gap-2">
        <Input
          aria-label="Поиск в продажах"
          className="min-w-48 flex-1"
          placeholder="Название, телефон, почта…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOffset(0)
          }}
        />
        {['deal', 'inquiry', 'task'].includes(kind) && <Select aria-label="Фильтр по ответственному" className="sm:max-w-64" value={owner}
          onChange={e => { setOwner(e.target.value); setOffset(0) }}>
          <option value="">Все ответственные</option>
          <option value="0">Без ответственного</option>
          {catalog.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
        </Select>}
        {kind === 'task' && <TaskPriorityFilter value={priority} onChange={value => { setPriority(value); setOffset(0) }} className="sm:max-w-56" />}
        {['deal', 'inquiry'].includes(kind) && <Select aria-label="Фильтр спама" className="sm:max-w-52" value={spam}
          onChange={event => { setSpam(event.target.value as api.SpamFilter); setOffset(0) }}>
          <option value="normal">Без спама</option>
          <option value="spam">Только спам</option>
          <option value="all">Все, включая спам</option>
        </Select>}
        {kind === 'deal' && (
          <>
            {!isBoard && <Select
              aria-label="Воронка"
              className="sm:max-w-64"
              value={pipeline}
              onChange={(e) => {
                setPipeline(e.target.value)
                setStage('')
                setOffset(0)
              }}
            >
              <option value="">Все воронки</option>
              {catalog.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>}
            <Select
              aria-label="Этап"
              className="sm:max-w-64"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">Все этапы</option>
              {catalog.stages
                .filter((s) => !(isBoard ? boardPipeline : pipeline) || s.data.pipeline_id === Number(isBoard ? boardPipeline : pipeline))
                .sort((a, b) => Number(a.data.sort) - Number(b.data.sort))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </>
        )}
        <Select
          aria-label="Архив продаж"
          className="sm:max-w-44"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value)
            setOffset(0)
          }}
        >
          <option value="active">Действующие</option>
          <option value="archived">Архив</option>
          <option value="all">Все записи</option>
        </Select>
      </div>
      {['deal', 'inquiry'].includes(kind) && <div className="mb-4 rounded-xl border border-border bg-surface p-3">
        <CrmDateFilter dateFrom={dates.from} dateTo={dates.to} dateUnknown={dates.unknown} onChange={value => { setDates(value); setOffset(0) }} />
        {(dates.from || dates.to || dates.unknown) && <Button size="sm" variant="ghost" onClick={() => { setDates({ from: '', to: '', unknown: false }); setOffset(0) }}>Сбросить даты</Button>}
      </div>}
      {error && (
        <p role="alert" className="my-3 text-danger">
          {error}
        </p>
      )}
      {isBoard ? <CrmBoard catalog={catalog} pipeline={boardPipeline} stage={stage} query={query} archive={archive} owner={owner}
        dateFrom={dates.from} dateTo={dates.to} dateUnknown={dates.unknown} spam={spam}
        revision={revision} canEdit={canEdit} onPipeline={id => { setPipeline(id); setStage('') }} onOpen={open}
        onCreate={target => setEditing({ kind: 'deal', initialData: { pipeline_id: target.data.pipeline_id, stage_id: target.id, amount: 0, currency: 'RUB' } })}
        onTask={related => setEditing({ kind: 'task', related })} onAccept={acceptInquiry} onChanged={() => setRevision(value => value + 1)} onList={() => setView('list')} /> : <>{kind === 'task' ? <CrmTasksTable
          rows={result.items} catalog={catalog} loading={loading} canEdit={canEdit} onOpen={open}
          onEdit={entry => setEditing({ entry, kind: 'task' })} onReload={() => setRevision(value => value + 1)}
          onChanged={entry => { setResult(previous => ({ ...previous, items: previous.items.map(item => item.id === entry.id ? entry : item) })); setRevision(value => value + 1) }}
        /> : <DataTable<Entry>
        rows={result.items}
        loading={loading}
        keyOf={(r) => String(r.id)}
        onRowClick={open}
        columns={[
          {
            header: 'Название',
            accessor: (r) => (
              <div className="font-medium">
                {r.name}
                {r.kind === 'inquiry' && r.data.is_spam === true && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Спам</span>}
                {r.archived && <span className="ml-2 text-xs text-muted">Архив</span>}
              </div>
            ),
          },
          {
            header: kind === 'deal' ? 'Этап' : 'Контакт / срок',
            accessor: (r) =>
              kind === 'deal' ? (
                <Chip tone="neutral">
                  {catalog.stages.find((s) => s.id === r.data.stage_id)?.name ?? '—'}
                </Chip>
              ) : (
                String(r.data.phone || r.data.email || '—')
              ),
          },
          {
            header: kind === 'deal' ? 'Бюджет' : 'Статус',
            accessor: (r) =>
              kind === 'deal' ? (
                money(r.data.amount)
              ) : r.archived ? (
                'В архиве'
              ) : (
                'Действует'
              ),
          },
          ...(['deal', 'inquiry'].includes(kind) ? [{ header: 'Дата заявки', accessor: (r: Entry) => crmSourceDateLabel(r) }] : []),
          {
            header: 'Ответственный',
            accessor: (r) =>
              catalog.users.find((u) => u.id === (r.effective_owner_id ?? r.data.responsible_user_id))?.name ?? 'Не назначен',
          },
        ]}
      />}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">
          {result.total ? offset + 1 : 0}–{Math.min(offset + 50, result.total)} из{' '}
          {result.total.toLocaleString('ru-RU')}
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
            disabled={offset + 50 >= result.total || loading}
            onClick={() => setOffset((v) => v + 50)}
          >
            Далее
          </Button>
        </div>
      </div>
      </>}
      {selected && ['deal', 'inquiry', 'contact', 'company'].includes(selected.kind) && <CrmRecordCard
        key={`${selected.id}:${selected.version}`} entry={selected} catalog={catalog} canEdit={canEdit} canFull={canFull}
        onClose={() => setSelected(null)} onOpen={open}
        onEdit={entry => setEditing({ entry, kind: entry.kind })}
        onTask={related => setEditing({ kind: 'task', related })} onAccept={acceptInquiry}
        onChanged={entry => { setSelected(entry); setRevision(value => value + 1) }} />}
      <Drawer
        open={!!selected && !['deal', 'inquiry', 'contact', 'company'].includes(selected.kind)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected?.archived ? 'Архивная запись' : selectedStage?.name}
      >
        {selected && !['deal', 'inquiry', 'contact', 'company'].includes(selected.kind) && (
          <div className="space-y-5 text-[13px]">
            <div className="flex flex-wrap gap-2">
              {canEdit && selected.kind==='deal' && !selected.archived && <Button size="sm" variant="secondary" onClick={()=>setEditing({kind:'task',related:selected})}>Назначить следующий шаг</Button>}
              {!!selected.board_task_id && <Link to="/tasks" className="inline-flex items-center rounded-full border border-border px-3 py-2 font-medium text-accent">Общий список задач</Link>}
              {selected.kind==='task' && !!selected.data.entity_id && <Button size="sm" variant="secondary" onClick={()=>apiRequest<Entry>({section:'crm',path:`/entries/${selected.data.entity_id}`}).then(open).catch(e=>setError(e.message))}>Связанная карточка</Button>}
              {canEdit && selected.kind !== 'inquiry' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing({ entry: selected, kind: selected.kind })}
                >
                  <Pencil size={14} />
                  Редактировать
                </Button>
              )}
              {canEdit && selected.kind === 'inquiry' && !selected.archived && (
                <Button size="sm" onClick={() => void acceptInquiry(selected)}>
                  Принять в работу
                </Button>
              )}
              {canFull && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => update(selected, { archived: !selected.archived })}
                >
                  <Archive size={14} />
                  {selected.archived ? 'Вернуть из архива' : 'В архив'}
                </Button>
              )}
              {canEdit && selected.kind === 'task' && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => update(selected, { data: { completed: !selected.data.completed } })}
                >
                  {selected.data.completed ? 'Открыть заново' : 'Выполнить задачу'}
                </Button>
              )}
            </div>
            {selected.kind==='task' && <div className="space-y-2"><p className="whitespace-pre-wrap">{String(selected.data.description||'')}</p>{!!selected.data.result&&<p className="whitespace-pre-wrap">Результат: {String(selected.data.result)}</p>}</div>}
            {selected.kind === 'task' && <CrmTaskClientBlock entityId={Number(selected.data.entity_id) || null} canMessage={canEdit && !selected.archived} onOpenCRM={open} />}
            {selected.kind === 'deal' && (
              <div className="rounded-xl bg-surface-muted p-4">
                <p className="text-lg font-medium">{money(selected.data.amount)}</p>
                <p className="mt-1 text-muted">
                  {catalog.pipelines.find((p) => p.id === selected.data.pipeline_id)?.name} ·{' '}
                  {selectedStage?.name}
                </p>
                {selected.data.loss_reason ? (
                  <p className="mt-2">Причина отказа: {String(selected.data.loss_reason)}</p>
                ) : null}
              </div>
            )}
            {['contact', 'company', 'inquiry'].includes(selected.kind) && (
              <div className="space-y-2">
                <p>Телефон: {String(selected.data.phone || '—')}</p>
                <p>Почта: {String(selected.data.email || '—')}</p>
              </div>
            )}
            {selected.kind === 'task' && (
              <div>
                <p>{date(selected.data.due_at)}</p>
                <p className="mt-2 whitespace-pre-wrap">{String(selected.data.result || '')}</p>
              </div>
            )}
            {canEdit && (
              <div>
                <h3 className="mb-2 font-medium">Добавить заметку</h3>
                <Textarea
                  aria-label="Текст заметки"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Результат разговора, договорённость, следующий шаг…"
                  rows={3}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={busy || !note.trim()}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await api.note(selected.id, note)
                      setNote('')
                      refreshHistory(selected)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Ошибка')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Сохранить заметку
                </Button>
              </div>
            )}
            <div>
              <h3 className="mb-2 font-medium">Файлы · {attached.total}</h3>
              {attached.items.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant="secondary"
                  className="mb-2 mr-2"
                  onClick={() =>
                    downloadFile('crm', `/files/${f.id}/download`, f.name).catch((e) => setError(e.message))
                  }
                >
                  <Download size={14} />
                  {f.name}
                </Button>
              ))}
            </div>
            <div>
              <h3 className="mb-3 font-medium">История · {history.total}</h3>
              <div className="space-y-3">
                {history.items.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs text-muted">
                      {date(h.created_at)} · {h.source === 'soborum' ? 'Соборум' : 'История amoCRM'}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{h.text}</p>
                  </div>
                ))}
              </div>
              {history.items.length < history.total && (
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() => refreshHistory(selected, history.items.length)}
                >
                  Ещё записи
                </Button>
              )}
            </div>
            {!!(selected.data.custom_fields as unknown[] | undefined)?.length && (
              <details>
                <summary className="cursor-pointer text-muted">Дополнительные поля</summary>
                <div className="mt-2 space-y-2">
                  {(
                    selected.data.custom_fields as { field_name?: string; values?: { value: unknown }[] }[]
                  ).map((f, i) => (
                    <p key={i}>
                      <span className="text-muted">{f.field_name}: </span>
                      {f.values?.map((v) => String(v.value)).join(', ')}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Drawer>
      {fileLibrary && <FilesLibrary onClose={() => setFileLibrary(false)} />}
      {editing && (
        <Editor
          kind={editing.kind}
          entry={editing.entry}
          inquiry={editing.inquiry}
          related={editing.related}
          initialData={editing.initialData}
          initialName={editing.initialName}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(entry) => {
            setEditing(null)
            setRevision((v) => v + 1)
            open(entry)
          }}
        />
      )}
    </div>
  )
}

function Editor({
  kind,
  entry,
  inquiry,
  related,
  initialData,
  initialName,
  catalog,
  onClose,
  onSaved,
}: {
  kind: Kind
  entry?: Entry
  inquiry?: Entry
  related?: Entry
  initialData?: Record<string, unknown>
  initialName?: string
  catalog: Catalog
  onClose: () => void
  onSaved: (entry: Entry) => void
}) {
  const [name, setName] = useState(entry?.name ?? initialName ?? inquiry?.name ?? (related?'Связаться: '+related.name:''))
  const first = catalog.pipelines[0]?.id
  const [data, setData] = useState<Record<string, unknown>>(
    entry?.data ?? initialData ?? (related ? {entity_id:related.id,responsible_user_id:related.data.responsible_user_id||null,due_at:new Date(Date.now()+24*3600000).toISOString()} : undefined) ??
      (kind === 'deal'
        ? {
            pipeline_id: first,
            stage_id: catalog.stages.find((s) => s.data.pipeline_id === first && s.data.outcome === 'open')
              ?.id,
            amount: 0,
            currency: 'RUB',
          }
        : kind === 'stage'
          ? { pipeline_id: first, outcome: 'open', color: '#dbeafe', sort: 0 }
          : {}),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contacts, setContacts] = useState<Entry[]>([])
  const put = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }))
  useEffect(() => {
    if (kind !== 'deal' || !contactQuery.trim()) {
      setContacts([])
      return
    }
    let current = true
    const timer = setTimeout(
      () =>
        api.list('contact', { query: contactQuery, limit: 20 }).then((r) => {
          if (current) setContacts(r.items)
        }),
      250,
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [contactQuery, kind])
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      onSaved(
        inquiry
          ? await api.accept(inquiry.id, name, data)
          : entry
            ? await api.patch(entry, { name, data })
            : await api.create(kind, name, data),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`${entry ? 'Изменить' : 'Создать'} · ${single[kind]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={busy || !name.trim()} onClick={save}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Название" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {['contact', 'company'].includes(kind) && (
          <>
            <Field label="Телефон">
              <Input value={String(data.phone ?? '')} onChange={(e) => put('phone', e.target.value)} />
            </Field>
            <Field label="Почта">
              <Input
                type="email"
                value={String(data.email ?? '')}
                onChange={(e) => put('email', e.target.value)}
              />
            </Field>
          </>
        )}
        {['deal', 'stage'].includes(kind) && (
          <Field label="Воронка" required>
            <Select
              value={String(data.pipeline_id ?? '')}
              onChange={(e) => {
                const pid = Number(e.target.value)
                setData((d) => ({
                  ...d,
                  pipeline_id: pid,
                  ...(kind === 'deal'
                    ? {
                        stage_id: catalog.stages.find(
                          (s) => s.data.pipeline_id === pid && s.data.outcome === 'open',
                        )?.id,
                      }
                    : {}),
                }))
              }}
            >
              <option value="" disabled>
                Выберите воронку
              </option>
              {catalog.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'deal' && (
          <>
            <Field label="Этап" required>
              <Select
                value={String(data.stage_id ?? '')}
                onChange={(e) => put('stage_id', Number(e.target.value))}
              >
                {catalog.stages
                  .filter((s) => s.data.pipeline_id === data.pipeline_id)
                  .sort((a, b) => Number(a.data.sort) - Number(b.data.sort))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Бюджет, ₽">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={String(data.amount ?? 0)}
                onChange={(e) => put('amount', Number(e.target.value))}
              />
            </Field>
            {catalog.stages.find((s) => s.id === data.stage_id)?.data.outcome === 'lost' && (
              <Field label="Причина отказа" required>
                <Textarea
                  value={String(data.loss_reason ?? '')}
                  onChange={(e) => put('loss_reason', e.target.value)}
                />
              </Field>
            )}
            <Field label="Привязать контакт">
              <Input
                placeholder="Найти по имени или телефону"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
              />
            </Field>
            {contacts.map((c) => (
              <button
                key={c.id}
                className="block w-full rounded-lg border border-border p-2 text-left text-sm"
                onClick={() => {
                  put('contact_ids', [c.id])
                  setContactQuery(c.name)
                  setContacts([])
                }}
              >
                <Users size={14} className="mr-2 inline" />
                {c.name} · {String(c.data.phone ?? '')}
              </button>
            ))}
            {Array.isArray(data.contact_ids) && data.contact_ids.length > 0 && (
              <p className="text-xs text-muted">Привязано контактов: {data.contact_ids.length}</p>
            )}
          </>
        )}
        {kind === 'task' && (
          <>
            <Field label="Описание задачи"><Textarea aria-label="Описание задачи" value={String(data.description??'')} onChange={e=>put('description',e.target.value)}/></Field>
            <Field label="Срок">
              <Input
                type="datetime-local"
                value={localTime(data.due_at)}
                onChange={(e) =>
                  put('due_at', e.target.value ? new Date(e.target.value).toISOString() : null)
                }
              />
            </Field>
            <Field label="Результат">
              <Textarea value={String(data.result ?? '')} onChange={(e) => put('result', e.target.value)} />
            </Field>
          </>
        )}
        {['deal', 'contact', 'company', 'task'].includes(kind) && (
          <Field label="Ответственный">
            <Select
              value={String(data.responsible_user_id ?? '')}
              onChange={(e) => put('responsible_user_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Не назначен</option>
              {catalog.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === 'stage' && (
          <>
            <Field label="Результат этапа">
              <Select value={String(data.outcome ?? 'open')} onChange={(e) => put('outcome', e.target.value)}>
                <option value="open">В работе</option>
                <option value="won">Успешно завершено</option>
                <option value="lost">Отказ</option>
              </Select>
            </Field>
            <Field label="Порядок">
              <Input
                type="number"
                value={String(data.sort ?? 0)}
                onChange={(e) => put('sort', Number(e.target.value))}
              />
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

type SourceFile = { id: number; name: string; size: number; archived: boolean }
function FilesLibrary({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<{ total: number; items: SourceFile[] }>({ total: 0, items: [] })
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const timer = setTimeout(
      () =>
        apiRequest<{ total: number; items: SourceFile[] }>({
          section: 'crm',
          path: '/files',
          query: { query, offset },
        })
          .then((r) => {
            if (current) setResult(r)
          })
          .catch((e) => setError(e.message)),
      150,
    )
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query, offset])
  return (
    <Modal open onClose={onClose} title="Файлы компании" width="max-w-3xl">
      <Input
        aria-label="Поиск файла"
        className="mb-3"
        placeholder="Название файла…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOffset(0)
        }}
      />
      {error && (
        <p role="alert" className="mb-2 text-danger">
          {error}
        </p>
      )}
      <DataTable<SourceFile>
        rows={result.items}
        keyOf={(r) => String(r.id)}
        columns={[
          {
            header: 'Файл',
            accessor: (r) => (
              <span>
                {r.name}
                {r.archived ? ' · Архив' : ''}
              </span>
            ),
          },
          {
            header: 'Размер',
            accessor: (r) =>
              (r.size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' МБ',
          },
          {
            header: '',
            accessor: (r) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadFile('crm', `/files/${r.id}/download`, r.name).catch((e) => setError(e.message))
                }
              >
                <Download size={14} />
                Скачать
              </Button>
            ),
          },
        ]}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">Всего файлов: {result.total}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!offset}
            onClick={() => setOffset((v) => Math.max(0, v - 50))}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={offset + 50 >= result.total}
            onClick={() => setOffset((v) => v + 50)}
          >
            Далее
          </Button>
        </div>
      </div>
    </Modal>
  )
}
