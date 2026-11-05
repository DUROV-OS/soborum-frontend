import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Building2, Check, Clock3, Download, FileText, Mail, MessageSquare, Pencil, Phone, Search, UserRound } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import * as api from './api'
import type { Catalog, Entry, History } from './api'
import { CrmPhoneActions } from './CrmPhoneActions'
import { CrmChatLinks } from '@/max/components/CrmChatLinks'
import { crmSourceDateLabel } from './dates'
import { ContextPanel } from '@/costing/ContextPanel'
import { asObject, CrmSalesDetails } from './CrmSalesFields'
import { CrmImportReview } from './CrmImportReview'

type Props = {
  entry: Entry
  catalog: Catalog
  canEdit: boolean
  canFull: boolean
  onClose: () => void
  onOpen: (entry: Entry) => void
  onEdit: (entry: Entry) => void
  onTask: (entry: Entry) => void
  onAccept: (entry: Entry) => void
  onChanged: (entry: Entry) => void
}
type SourceFile = { id: number; name: string; size?: number; archived?: boolean }
type Page<T> = { items: T[]; total: number; offset: number }
type Event = History['items'][number]
type EventKind = 'all' | 'notes' | 'calls' | 'mail' | 'changes'
const eventLabels: Record<EventKind, string> = { all: 'Все', notes: 'Заметки', calls: 'Звонки', mail: 'Письма', changes: 'Изменения' }
const kindLabels: Record<Entry['kind'], string> = { deal: 'Сделка', inquiry: 'Новая заявка', contact: 'Контакт', company: 'Компания', task: 'Задача', pipeline: 'Воронка', stage: 'Этап' }
const fieldLabels: Record<string, string> = {
  name: 'Название', archived: 'Архив', pipeline_id: 'Воронка', stage_id: 'Этап', amount: 'Бюджет', currency: 'Валюта',
  responsible_user_id: 'Ответственный', contact_ids: 'Контакты', company_id: 'Компания', phone: 'Телефон', email: 'Email',
  loss_reason: 'Причина отказа', custom_fields: 'Дополнительные поля', due_at: 'Срок', completed: 'Задача выполнена',
  result: 'Результат', description: 'Описание', task_type: 'Тип задачи', entity_id: 'Связанная карточка',
  source_name: 'Источник', contact_name: 'Имя клиента', reason: 'Комментарий', is_unsorted: 'Ожидает принятия', is_spam: 'Спам',
  deal_id: 'Связанная сделка', accepted_deal_id: 'Принятая сделка', client_id: 'ID клиента', client_request_id: 'ID заявки сайта',
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const id = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const text = (value: unknown): string => {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  if (Array.isArray(value)) return value.map(text).join(', ')
  if (typeof value === 'object') {
    const record = object(value)
    if ('value' in record) return text(record.value)
    return Object.entries(record).map(([key, item]) => `${fieldLabels[key] || key}: ${text(item)}`).join('; ')
  }
  return String(value)
}
const plain = (value: unknown) => text(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, '')
const date = (value: unknown) => {
  if (!value) return 'Срок не указан'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}
const getEntry = (entryId: number) => apiRequest<Entry>({ section: 'crm', path: `/entries/${entryId}` })
const getFiles = (entryId: number, offset = 0) => apiRequest<{ total: number; items: SourceFile[] }>({ section: 'crm', path: `/entries/${entryId}/files`, query: { offset } })
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие. Повторите попытку.'
const eventKind = (event: Event): EventKind => {
  const type = String(event.details.note_type || '')
  if (type.startsWith('call_')) return 'calls'
  if (type.includes('mail')) return 'mail'
  if (event.details.before || event.details.after || event.details.data || event.details.responsible_user_id || event.id.startsWith('website-')) return 'changes'
  if (type && !['common', 'extended_service_message'].includes(type)) return 'changes'
  return 'notes'
}
const dedupe = <T,>(values: T[], key: (item: T) => string | number) => Array.from(new Map(values.map(item => [key(item), item])).values())

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] gap-3 py-2 text-[13px]"><dt className="text-muted">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-ink">{children}</dd></div>
}
function CustomFields({ value }: { value: unknown }) {
  if (!Array.isArray(value) || !value.length) return null
  return <dl className="divide-y divide-border/50">{value.map((item, index) => {
    const field = object(item)
    return <Detail key={`${field.field_id || field.id || index}`} label={String(field.field_name || field.name || field.field_code || `Поле ${field.field_id || index + 1}`)}>{text(field.values ?? field.value ?? item)}</Detail>
  })}</dl>
}
function ContactLinks({ data, name, canMessage }: { data: Record<string, unknown>; name: string; canMessage: boolean }) {
  return <div className="space-y-1 text-[13px]">
    {[...new Set([data.phone, asObject(data.customer).phone_2, asObject(data.customer).phone_3])].filter((value): value is string => typeof value === 'string' && !!value.trim()).map(phone => <CrmPhoneActions key={phone} phone={phone} name={name} canMessage={canMessage} />)}
    {typeof data.email === 'string' && data.email.trim() && <a className="flex items-start gap-2 break-all text-brand hover:underline" href={`mailto:${encodeURIComponent(data.email)}`}><Mail size={14} className="mt-0.5 shrink-0" />{data.email}</a>}
  </div>
}
function readableField(key: string, value: unknown, catalog: Catalog, related: Entry[]) {
  if (key === 'pipeline_id') return catalog.pipelines.find(item => item.id === id(value))?.name || text(value)
  if (key === 'stage_id') return catalog.stages.find(item => item.id === id(value))?.name || text(value)
  if (key === 'responsible_user_id') return catalog.users.find(item => item.id === id(value))?.name || (value ? `Пользователь #${value}` : 'Не назначен')
  if (key === 'company_id' || key === 'entity_id') return related.find(item => item.id === id(value))?.name || text(value)
  if (key === 'contact_ids' && Array.isArray(value)) return value.map(item => related.find(entry => entry.id === id(item))?.name || `#${item}`).join(', ') || '—'
  if (key === 'due_at') return value ? date(value) : '—'
  if (key === 'custom_fields' && Array.isArray(value)) return value.map(item => {
    const field = object(item)
    return `${field.field_name || field.name || field.field_code || `Поле ${field.field_id || ''}`}: ${text(field.values ?? field.value)}`
  }).join('\n') || '—'
  return text(value)
}
function EventContent({ event, catalog, related }: { event: Event; catalog: Catalog; related: Entry[] }) {
  const params = object(event.details.params)
  const before = object(event.details.before)
  const after = object(event.details.after)
  const beforeData = object(before.data ?? before.payload)
  const afterData = object(after.payload ?? after.data)
  const changes = [
    ...['name', 'archived'].filter(key => key in after && JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({ key, old: before[key], next: after[key] })),
    ...Object.keys(afterData).filter(key => JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])).map(key => ({ key, old: beforeData[key], next: afterData[key] })),
  ]
  const kind = eventKind(event)
  if (kind === 'calls') return <div className="space-y-2">
    <p className="font-medium">{event.details.note_type === 'call_in' ? 'Входящий звонок' : 'Исходящий звонок'}</p>
    <dl>{[['Номер', params.phone], ['Длительность', params.duration != null ? `${params.duration} сек.` : null], ['Статус', params.call_status ?? params.status], ['Результат', params.call_result], ['Сервис', params.service]].filter(([, value]) => value != null && value !== '').map(([label, value]) => <Detail key={String(label)} label={String(label)}>{plain(value)}</Detail>)}</dl>
    {params.text != null && <p className="whitespace-pre-wrap break-words">{plain(params.text)}</p>}
  </div>
  if (kind === 'mail') return <div className="space-y-2">
    <p className="font-medium">{params.subject ? plain(params.subject) : 'Письмо'}</p>
    {Boolean(params.from || params.to) && <dl>{params.from != null && <Detail label="От">{plain(params.from)}</Detail>}{params.to != null && <Detail label="Кому">{plain(params.to)}</Detail>}</dl>}
    <p className="whitespace-pre-wrap break-words">{plain(params.content_summary ?? params.text ?? params.content ?? event.text)}</p>
  </div>
  return <div className="space-y-2"><p className="whitespace-pre-wrap break-words">{plain(event.text)}</p>
    {changes.length > 0 && <dl className="divide-y divide-border/50">{changes.map(change => <Detail key={change.key} label={fieldLabels[change.key] || change.key}><span className="text-muted line-through">{readableField(change.key, change.old, catalog, related)}</span><span aria-label="изменено на" className="mx-2 text-muted">→</span><span>{readableField(change.key, change.next, catalog, related)}</span></Detail>)}</dl>}
    {event.details.responsible_user_id != null && <p className="text-muted">{readableField('responsible_user_id', event.details.responsible_user_id, catalog, related)}</p>}
  </div>
}

export function CrmRecordCard({ entry, catalog, canEdit, canFull, onClose, onOpen, onEdit, onTask, onAccept, onChanged }: Props) {
  const [record, setRecord] = useState(entry)
  const [linked, setLinked] = useState<Entry | null>(null)
  const [related, setRelated] = useState<Entry[]>([])
  const [histories, setHistories] = useState<Record<number, Page<Event>>>({})
  const [files, setFiles] = useState<Record<number, Page<SourceFile>>>({})
  const [tasks, setTasks] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [revision, setRevision] = useState(0)
  const [mobileTab, setMobileTab] = useState<'data' | 'history'>('data')
  const [filter, setFilter] = useState<EventKind>('all')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [taskResults, setTaskResults] = useState<Record<number, string>>({})
  const [pipeline, setPipeline] = useState('')
  const [stage, setStage] = useState('')
  const [lossReason, setLossReason] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    setRecord(entry); setLinked(null); setRelated([]); setHistories({}); setFiles({}); setTasks([])
    setNote(''); setTaskResults({}); setMobileTab('data'); setFilter('all'); setSearch(''); setBusy('')
  }, [entry.id])

  useEffect(() => {
    const ticket = ++generation.current
    const current = () => generation.current === ticket
    setLoading(true); setError(''); setHistories({}); setFiles({}); setTasks([]); setRelated([])
    void (async () => {
      const problems: string[] = []
      const fresh = await getEntry(entry.id)
      let deal: Entry | null = null
      const linkedId = fresh.kind === 'inquiry' ? id(fresh.data.accepted_deal_id) || id(fresh.data.deal_id) : null
      if (linkedId && linkedId !== fresh.id) {
        try { const candidate = await getEntry(linkedId); if (candidate.kind === 'deal') deal = candidate }
        catch (error) { problems.push(`Связанная сделка: ${errorMessage(error)}`) }
      }
      if (!current()) return
      setRecord(fresh); setLinked(deal)
      setPipeline(String(fresh.data.pipeline_id || '')); setStage(String(fresh.data.stage_id || '')); setLossReason(String(fresh.data.loss_reason || ''))
      const sources = deal ? [fresh, deal] : [fresh]
      const sourceIds = new Set(sources.map(item => item.id))
      const contactIds = sources.flatMap(item => Array.isArray(item.data.contact_ids) ? item.data.contact_ids.map(id).filter((value): value is number => value !== null) : [])
      const companyIds = sources.map(item => id(item.data.company_id)).filter((value): value is number => value !== null)
      const relatedIds = [...new Set([...contactIds, ...companyIds])].filter(value => !sourceIds.has(value))
      const relatedWork = (async () => {
        const found = await Promise.allSettled(relatedIds.map(getEntry))
        const records = found.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
        found.forEach(result => { if (result.status === 'rejected') problems.push(`Контакт или компания: ${errorMessage(result.reason)}`) })
        const extraCompanies = [...new Set(records.filter(item => item.kind === 'contact').map(item => id(item.data.company_id)).filter((value): value is number => value !== null))].filter(value => !relatedIds.includes(value) && !sourceIds.has(value))
        const extra = await Promise.allSettled(extraCompanies.map(getEntry))
        extra.forEach(result => { if (result.status === 'fulfilled') records.push(result.value); else problems.push(`Компания контакта: ${errorMessage(result.reason)}`) })
        if (current()) setRelated(records)
      })()
      const historyWork = Promise.all(sources.map(async item => {
        try {
          const result = await api.history(item.id)
          if (current()) setHistories(value => ({ ...value, [item.id]: { ...result, offset: result.items.length } }))
        } catch (error) { problems.push(`История «${item.name}»: ${errorMessage(error)}`) }
      }))
      const fileWork = Promise.all(sources.map(async item => {
        try {
          const result = await getFiles(item.id)
          if (current()) setFiles(value => ({ ...value, [item.id]: { ...result, offset: result.items.length } }))
        } catch (error) { problems.push(`Файлы «${item.name}»: ${errorMessage(error)}`) }
      }))
      const taskWork = (async () => {
        const matches: Entry[] = fresh.kind === 'task' ? [fresh] : []
        let offset = 0
        let total = Infinity
        while (offset < total && current()) {
          const result = await api.list('task', { archive: 'active', limit: 100, offset })
          matches.push(...result.items.filter(task => sourceIds.has(Number(task.data.entity_id))))
          total = result.total
          if (!result.items.length && offset < total) throw new Error('Список задач загружен не полностью. Обновите карточку.')
          if (!result.items.length) break
          offset += result.items.length
        }
        if (current()) setTasks(dedupe(matches, item => item.id))
      })().catch(error => { problems.push(`Задачи: ${errorMessage(error)}`) })
      await Promise.all([relatedWork, historyWork, fileWork, taskWork])
      if (current() && problems.length) setError(problems.join('\n'))
    })().catch(error => { if (current()) setError(errorMessage(error)) }).finally(() => { if (current()) setLoading(false) })
    return () => { if (current()) generation.current++ }
  }, [entry.id, entry.version, revision])

  const commercial = record.kind === 'inquiry' ? linked : record.kind === 'deal' ? record : null
  const sources = linked ? [record, linked] : [record]
  const events = useMemo(() => dedupe(Object.values(histories).flatMap(page => page.items), item => `${item.source}:${item.id}`).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [histories])
  const visibleEvents = events.filter(event => (filter === 'all' || eventKind(event) === filter) && (!search.trim() || `${event.text} ${JSON.stringify(event.details)}`.toLocaleLowerCase('ru-RU').includes(search.trim().toLocaleLowerCase('ru-RU'))))
  const attachments = dedupe(Object.values(files).flatMap(page => page.items), item => item.id)
  const remainingHistory = Object.entries(histories).filter(([, page]) => page.offset < page.total)
  const remainingFiles = Object.entries(files).filter(([, page]) => page.offset < page.total)
  const openTasks = tasks.filter(task => !task.data.completed).sort((a, b) => String(a.data.due_at || '9999').localeCompare(String(b.data.due_at || '9999')))
  const completedTasks = tasks.filter(task => task.data.completed)
  const selectedStage = catalog.stages.find(item => item.id === id(commercial?.data.stage_id))
  const owner = commercial?.data.responsible_user_id ?? record.data.responsible_user_id
  const inquiryContactCovered = record.kind === 'inquiry' && related.some(item => item.kind === 'contact' &&
    ['contact_name', 'phone', 'email'].some(key => Boolean(record.data[key])) &&
    ['contact_name', 'phone', 'email'].every(key => {
      if (!record.data[key]) return true
      const normalize = (value: unknown) => key === 'phone' ? String(value || '').replace(/\D/g, '') : String(value || '').trim().toLocaleLowerCase('ru-RU')
      return normalize(record.data[key]) === normalize(key === 'contact_name' ? item.name : item.data[key])
    }))
  const stageOptions = catalog.stages.filter(item => item.data.pipeline_id === Number(pipeline)).sort((a, b) => Number(a.data.sort || 0) - Number(b.data.sort || 0))
  const stageChanged = record.kind === 'deal' && (pipeline !== String(record.data.pipeline_id || '') || stage !== String(record.data.stage_id || ''))
  const needsReason = stageChanged && catalog.stages.find(item => item.id === Number(stage))?.data.outcome === 'lost'
  const actionable = canEdit && !record.archived && !loading && !busy

  async function mutate(key: string, work: () => Promise<Entry | void>) {
    const ticket = generation.current
    if (busy || loading) return
    setBusy(key); setError('')
    try {
      const updated = await work()
      if (ticket !== generation.current) return
      if (updated && updated.id === record.id) { setRecord(updated); onChanged(updated) }
      if (key === 'note') setNote('')
      setRevision(value => value + 1)
    } catch (error) { if (ticket === generation.current) setError(errorMessage(error)) }
    finally { if (ticket === generation.current) setBusy('') }
  }
  async function loadMore(kind: 'history' | 'files') {
    const ticket = generation.current
    if (busy || loading) return
    setBusy(kind); setError('')
    const pages = kind === 'history' ? remainingHistory : remainingFiles
    const results = await Promise.allSettled(pages.map(async ([key, page]) => {
      const sourceId = Number(key)
      if (kind === 'history') {
        const result = await api.history(sourceId, page.offset)
        if (!result.items.length && page.offset < result.total) throw new Error('Не удалось загрузить следующую страницу истории. Повторите попытку.')
        if (ticket === generation.current) setHistories(current => ({ ...current, [sourceId]: { total: result.total, offset: page.offset + result.items.length, items: dedupe([...(current[sourceId]?.items || []), ...result.items], item => `${item.source}:${item.id}`) } }))
      } else {
        const result = await getFiles(sourceId, page.offset)
        if (!result.items.length && page.offset < result.total) throw new Error('Не удалось загрузить следующую страницу файлов. Повторите попытку.')
        if (ticket === generation.current) setFiles(current => ({ ...current, [sourceId]: { total: result.total, offset: page.offset + result.items.length, items: dedupe([...(current[sourceId]?.items || []), ...result.items], item => item.id) } }))
      }
    }))
    if (ticket !== generation.current) return
    setBusy('')
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failures.length) setError(failures.map(result => errorMessage(result.reason)).join('\n'))
  }
  const taskCard = (task: Entry) => <div key={task.id} className={`rounded-lg border p-3 ${task.data.completed ? 'border-border bg-surface' : 'border-amber-200 bg-amber-50/60'}`}>
    <div className="flex items-start justify-between gap-3"><button className="min-w-0 break-words text-left text-[13px] font-medium hover:text-brand" onClick={() => onOpen(task)}>{task.name}</button>{task.data.completed ? <Check size={16} className="shrink-0 text-green-700" /> : <Clock3 size={16} className="shrink-0 text-amber-700" />}</div>
    <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted"><span className={!task.data.completed && task.data.due_at && Date.parse(String(task.data.due_at)) < Date.now() ? 'text-danger' : ''}>{date(task.data.due_at)}</span><span>{readableField('responsible_user_id', task.data.responsible_user_id, catalog, related)}</span><span>{text(task.data.task_type)}</span></div>
    {task.data.description != null && task.data.description !== '' && <p className="mt-2 whitespace-pre-wrap break-words text-[13px]">{text(task.data.description)}</p>}
    {Boolean(task.data.completed) && task.data.result != null && <p className="mt-2 whitespace-pre-wrap break-words text-[13px]"><span className="text-muted">Результат: </span>{text(task.data.result)}</p>}
    {canEdit && !task.archived && !task.data.completed && <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={event => {
      event.preventDefault()
      if (!taskResults[task.id]?.trim()) return
      void mutate(`task-${task.id}`, async () => { const updated = await api.patch(task, { data: { completed: true, result: taskResults[task.id].trim() } }); return updated.id === record.id ? updated : await getEntry(record.id) })
    }}><Input aria-label={`Результат задачи ${task.name}`} placeholder="Результат выполнения" required maxLength={5000} value={taskResults[task.id] || ''} onChange={event => setTaskResults(value => ({ ...value, [task.id]: event.target.value }))} /><Button size="sm" type="submit" variant="secondary" disabled={!actionable || !taskResults[task.id]?.trim()} className="shrink-0">Завершить</Button></form>}
  </div>

  return <Drawer open onClose={onClose} title={record.id === entry.id ? record.name : entry.name} subtitle={<span className="break-all">{kindLabels[entry.kind]} · №{entry.id}{entry.source_id ? ` · Источник #${entry.source_id}` : ''}{record.archived ? ' · В архиве' : ''}</span>} width="max-w-[1280px] [&>div:first-child>div]:min-w-0 [&>div:first-child>button]:shrink-0 [&_h2]:break-words" bodyClassName="flex-1 min-h-0 overflow-hidden">
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-border md:hidden" role="tablist" aria-label="Раздел карточки">{([['data', 'Данные'], ['history', 'История']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={mobileTab === value} className={`flex-1 border-b-2 px-4 py-3 text-sm ${mobileTab === value ? 'border-brand text-brand' : 'border-transparent text-muted'}`} onClick={() => setMobileTab(value)}>{label}</button>)}</div>
      {error && <div role="alert" className="max-h-32 shrink-0 overflow-y-auto border-b border-danger/20 bg-red-50 px-5 py-3 text-[13px] text-danger"><p className="whitespace-pre-wrap">{error}</p><button className="mt-1 underline" disabled={!!busy} onClick={() => setRevision(value => value + 1)}>Обновить карточку</button></div>}
      {loading && <div role="status" className="shrink-0 border-b border-border px-5 py-2 text-[12px] text-muted">Загрузка карточки и истории…</div>}
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside aria-label="Данные карточки" className={`${mobileTab === 'data' ? 'block' : 'hidden'} min-h-0 w-full shrink-0 overflow-y-auto overscroll-contain border-r border-border bg-surface md:block md:w-[360px]`}>
          <div className="space-y-5 p-5">
            {record.kind === 'deal' && <ContextPanel kind="deal" id={record.id} />}
            <div className="flex flex-wrap gap-2">
              {canEdit && record.kind !== 'inquiry' && <Button size="sm" variant="secondary" disabled={!actionable} onClick={() => onEdit(record)}><Pencil size={14} />Редактировать</Button>}
              {canEdit && record.kind === 'inquiry' && !record.data.accepted_deal_id && record.data.is_spam !== true && <Button size="sm" disabled={!actionable} onClick={() => onAccept(record)}>Взять в работу</Button>}
              {canEdit && record.kind === 'inquiry' && !record.data.accepted_deal_id && !record.archived && <Button size="sm" variant="secondary" disabled={!actionable}
                onClick={() => void mutate('spam', () => api.patch(record, { data: { is_spam: record.data.is_spam !== true } }))}>
                {record.data.is_spam === true ? 'Убрать отметку «Спам»' : 'Пометить как спам'}
              </Button>}
              {canFull && <Button size="sm" variant="ghost" disabled={loading || !!busy} aria-label={record.archived ? 'Вернуть из архива' : 'В архив'} onClick={() => void mutate('archive', () => api.patch(record, { archived: !record.archived }))}><Archive size={14} />{record.archived ? 'Вернуть' : 'В архив'}</Button>}
            </div>
            {record.kind === 'inquiry' && record.data.is_spam === true && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">
              <span className="font-semibold">Спам.</span> Заявка исключена из обычного списка.{canEdit && !record.archived && !record.data.accepted_deal_id ? ' Отметку можно убрать в этой карточке.' : ''}
            </p>}
            {(commercial || record.kind === 'inquiry') && <section aria-label="Сделка" className="space-y-3">
              <div className="flex items-center justify-between gap-2"><h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted">{record.kind === 'inquiry' ? 'Новая заявка' : 'Сделка'}</h3>{commercial && <span className="text-lg font-semibold">{Number(commercial.data.amount || 0).toLocaleString('ru-RU')} <span className="text-[13px] font-normal text-muted">{text(commercial.data.currency || 'RUB')}</span></span>}</div>
              {record.kind === 'deal' ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (stageChanged && (!needsReason || lossReason.trim())) void mutate('stage', () => api.patch(record, { data: { pipeline_id: Number(pipeline), stage_id: Number(stage), ...(needsReason ? { loss_reason: lossReason.trim() } : {}) } })) }}>
                <Field label="Воронка"><Select aria-label="Воронка сделки" value={pipeline} disabled={!actionable} onChange={event => { const next = event.target.value; setPipeline(next); const first = catalog.stages.filter(item => item.data.pipeline_id === Number(next) && item.data.outcome === 'open').sort((a, b) => Number(a.data.sort || 0) - Number(b.data.sort || 0))[0]; setStage(String(first?.id || '')) }}><option value="" disabled>Выберите воронку</option>{!catalog.pipelines.some(item => String(item.id) === pipeline) && pipeline && <option value={pipeline}>Воронка #{pipeline}</option>}{catalog.pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
                <Field label="Этап"><div className="rounded-md border-l-4" style={{ borderLeftColor: /^#[\da-f]{6}$/i.test(String(selectedStage?.data.color)) ? String(selectedStage?.data.color) : '#94a3b8' }}><Select aria-label="Этап сделки" value={stage} disabled={!actionable} onChange={event => setStage(event.target.value)}><option value="" disabled>Выберите этап</option>{!stageOptions.some(item => String(item.id) === stage) && stage && <option value={stage}>Этап #{stage}</option>}{stageOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div></Field>
                {needsReason && <Field label="Причина отказа" required><Textarea rows={2} required value={lossReason} maxLength={2000} onChange={event => setLossReason(event.target.value)} /></Field>}
                {stageChanged && <Button size="sm" type="submit" disabled={!actionable || !pipeline || !stage || (needsReason && !lossReason.trim())}>Сохранить этап</Button>}
              </form> : <div className="space-y-2 rounded-lg bg-surface-muted p-3 text-[13px]"><p>{catalog.pipelines.find(item => item.id === id(record.data.pipeline_id ?? commercial?.data.pipeline_id))?.name || 'Воронка не выбрана'}</p><p className="font-medium">{record.data.accepted_deal_id ? 'Заявка принята в работу' : 'Новая заявка'}</p><p className="text-[12px] text-muted">{record.data.accepted_deal_id ? 'Откройте связанную сделку для дальнейшей работы.' : 'Назначьте ответственного и этап кнопкой «Взять в работу».'}</p>{record.data.accepted_deal_id && linked ? <button className="text-brand hover:underline" onClick={() => onOpen(linked)}>Открыть сделку</button> : null}</div>}
              <dl><Detail label="Дата заявки">{crmSourceDateLabel(record)}</Detail><Detail label="Ответственный">{readableField('responsible_user_id', owner, catalog, related)}</Detail>{commercial?.data.loss_reason ? <Detail label="Причина отказа">{text(commercial.data.loss_reason)}</Detail> : null}{record.data.source_name ? <Detail label="Источник">{text(record.data.source_name)}</Detail> : null}{record.data.reason ? <Detail label="Комментарий">{text(record.data.reason)}</Detail> : null}</dl>
            </section>}
            {(record.kind === 'contact' || record.kind === 'company' || (record.kind === 'inquiry' && !inquiryContactCovered)) && <section className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-[13px] font-semibold"><UserRound size={16} />{record.kind === 'inquiry' ? String(record.data.contact_name || 'Контакт заявки') : kindLabels[record.kind]}</h3><ContactLinks data={record.data} name={String(record.data.contact_name || record.name)} canMessage={canEdit && !record.archived} />{record.kind !== 'inquiry' && <dl><Detail label="Ответственный">{readableField('responsible_user_id', record.data.responsible_user_id, catalog, related)}</Detail></dl>}</section>}
            {['contact', 'company'].includes(record.kind) && <div className="border-t border-border pt-4"><CrmChatLinks entryId={record.id} canEdit={canEdit && !record.archived} /></div>}
            {related.filter(item => ['contact', 'company'].includes(item.kind)).map(item => <section key={item.id} className="space-y-3 border-t border-border pt-4"><div className="flex items-start gap-2">{item.kind === 'company' ? <Building2 size={16} className="mt-0.5 shrink-0 text-muted" /> : <UserRound size={16} className="mt-0.5 shrink-0 text-muted" />}<div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-muted">{kindLabels[item.kind]}</p><button className="break-words text-left text-[14px] font-medium text-brand hover:underline" onClick={() => onOpen(item)}>{item.name}</button></div>{canEdit && !item.archived && <button aria-label={`Редактировать ${item.name}`} className="ml-auto shrink-0 rounded p-1 text-muted hover:bg-surface-muted" disabled={loading || !!busy} onClick={() => onEdit(item)}><Pencil size={14} /></button>}</div><ContactLinks data={item.data} name={item.name} canMessage={canEdit && !record.archived && !item.archived} /><CrmSalesDetails data={item.data} customerOnly /><CustomFields value={item.data.custom_fields} /></section>)}
            <CrmSalesDetails data={(commercial || record).data} />
            {Array.isArray((commercial || record).data.custom_fields) && ((commercial || record).data.custom_fields as unknown[]).length > 0 && <section className="border-t border-border pt-4"><h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Дополнительные поля</h3><CustomFields value={(commercial || record).data.custom_fields} /></section>}
            {record.kind === 'task' && <dl className="border-t border-border pt-4">{['task_type', 'due_at', 'description', 'completed', 'result'].filter(key => record.data[key] != null).map(key => <Detail key={key} label={fieldLabels[key]}>{readableField(key, record.data[key], catalog, related)}</Detail>)}</dl>}
            <section className="border-t border-border pt-4"><h3 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><FileText size={15} />Файлы <span>{attachments.length}</span></h3>{attachments.length ? <ul className="space-y-2">{attachments.map(file => <li key={file.id}><button className="flex w-full items-start gap-2 rounded-md p-2 text-left text-[13px] text-brand hover:bg-surface-muted" disabled={!!busy} onClick={() => { const ticket = generation.current; void downloadFile('crm', `/files/${file.id}/download`, file.name).catch(error => { if (ticket === generation.current) setError(errorMessage(error)) }) }}><Download size={15} className="mt-0.5 shrink-0" /><span className="min-w-0 break-all">{file.name}{file.size != null && <span className="mt-0.5 block text-[11px] text-muted">{(file.size / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КБ{file.archived ? ' · Архив' : ''}</span>}</span></button><CrmImportReview sourceId={file.id} filename={file.name} /></li>)}</ul> : <p className="text-[13px] text-muted">{loading ? 'Загрузка файлов…' : 'Прикреплённых файлов нет'}</p>}{remainingFiles.length > 0 && <Button size="sm" variant="ghost" disabled={!!busy || loading} onClick={() => void loadMore('files')}>Загрузить ещё файлы</Button>}</section>
          </div>
        </aside>
        <section aria-label="История работы с клиентом" className={`${mobileTab === 'history' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col bg-slate-50 md:flex`}>
          <div className="shrink-0 space-y-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">История работы с клиентом</h3>{canEdit && !record.archived && ['deal', 'inquiry', 'contact', 'company'].includes(record.kind) && <Button size="sm" variant="secondary" disabled={!actionable} onClick={() => onTask(record)}><Clock3 size={14} />Назначить следующий шаг</Button>}</div>
            <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-muted" /><Input className="pl-9" aria-label="Поиск по загруженной истории" placeholder="Поиск по загруженной истории" value={search} onChange={event => setSearch(event.target.value)} /></div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Фильтр истории">{(Object.keys(eventLabels) as EventKind[]).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-[12px] ${filter === value ? 'bg-brand text-white' : 'text-muted hover:bg-surface-muted'}`}>{eventLabels[value]}</button>)}</div>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
            <section aria-label="Задачи по карточке" className="space-y-2"><h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted">Следующий шаг{openTasks.length ? ` · ${openTasks.length}` : ''}</h4>{openTasks.length ? openTasks.map(taskCard) : <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-[13px] text-muted">{loading ? 'Загрузка задач…' : 'Открытых задач нет'}</div>}{completedTasks.length > 0 && <details><summary className="cursor-pointer py-2 text-[12px] text-muted">Выполненные задачи · {completedTasks.length}</summary><div className="space-y-2">{completedTasks.map(taskCard)}</div></details>}</section>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted"><span>События · {visibleEvents.length}{search || filter !== 'all' ? ` из ${events.length} загруженных` : ''}</span>{remainingHistory.length > 0 && <span>Загружена часть истории · фильтр по загруженным событиям</span>}</div>
            {visibleEvents.length ? <ol className="space-y-3">{visibleEvents.map(event => {
              const kind = eventKind(event)
              const Icon = kind === 'calls' ? Phone : kind === 'mail' ? Mail : kind === 'changes' ? Pencil : MessageSquare
              return <li key={`${event.source}:${event.id}`} className="flex min-w-0 gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted"><Icon size={13} /></span><article className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-3 text-[13px]"><header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted"><span>{eventLabels[kind]} · {event.source === 'amocrm' ? 'amoCRM' : 'Durov OS'}</span><time dateTime={event.created_at}>{date(event.created_at)}</time></header><EventContent event={event} catalog={catalog} related={[...related, ...sources]} />{event.source === 'amocrm' && event.source_record_id != null && <CrmImportReview sourceId={event.source_record_id} />}</article></li>
            })}</ol> : <p className="py-6 text-center text-[13px] text-muted">{loading ? 'Загрузка истории…' : search || filter !== 'all' ? 'Среди загруженных событий совпадений нет' : 'История пока пуста'}</p>}
            {remainingHistory.length > 0 && <Button className="w-full" variant="secondary" size="sm" disabled={!!busy || loading} onClick={() => void loadMore('history')}>Загрузить ещё события ({Object.values(histories).reduce((sum, page) => sum + Math.max(0, page.total - page.offset), 0)} осталось)</Button>}
          </div>
          {canEdit && !record.archived && <form className="shrink-0 space-y-2 border-t border-border bg-surface p-4 sm:px-5" onSubmit={event => { event.preventDefault(); const value = note.trim(); if (value) void mutate('note', async () => { await api.note(record.id, value) }) }}><h4 className="flex items-center gap-2 text-[13px] font-medium"><MessageSquare size={15} />Добавить заметку</h4><Textarea aria-label="Текст заметки" placeholder="Заметка для коллег по этой карточке" maxLength={20000} rows={2} value={note} onChange={event => setNote(event.target.value)} /><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted">Внутренняя заметка · клиенту не отправляется</span><Button type="submit" size="sm" disabled={!actionable || !note.trim()}>{busy === 'note' ? 'Сохранение…' : 'Сохранить заметку'}</Button></div></form>}
        </section>
      </div>
    </div>
  </Drawer>
}
