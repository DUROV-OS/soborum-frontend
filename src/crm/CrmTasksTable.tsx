import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import * as api from './api'
import type { Catalog, Entry } from './api'

type Props = {
  rows: Entry[]
  catalog: Catalog
  loading: boolean
  canEdit: boolean
  onOpen: (entry: Entry) => void
  onEdit: (task: Entry) => void
  onChanged: (updated: Entry) => void
  onReload: () => void
}
type Related = { entry: Entry; error?: never } | { entry?: never; error: string }

function id(value: unknown): number | null {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}
function contactIds(entry: Entry): number[] {
  if (entry.kind !== 'deal') return []
  const contacts = Array.isArray(entry.data.contact_ids)
    ? entry.data.contact_ids.map(id).filter((value): value is number => value !== null)
    : []
  const company = id(entry.data.company_id)
  return [...new Set(contacts.length ? contacts : company ? [company] : [])]
}
function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}
function dueDate(value: unknown): string {
  if (!value) return 'Срок не указан'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? 'Срок не указан' : date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

/** CRM references only: related records never require access to ERP clients or costs. */
export function CrmTasksTable({ rows, catalog, loading, canEdit, onOpen, onEdit, onChanged, onReload }: Props) {
  const [related, setRelated] = useState<Map<number, Related>>(new Map())
  const [retry, setRetry] = useState(0)
  const [saved, setSaved] = useState<Map<number, Entry>>(new Map())
  const [pending, setPending] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<Record<number, string>>({})
  const mounted = useRef(true)
  const saving = useRef(new Set<number>())
  const cache = useRef(new Map<number, { entry: Entry; at: number }>())
  const inFlight = useRef(new Map<number, Promise<Related>>())
  const limiter = useRef({ active: 0, waiting: [] as (() => void)[] })
  const tasks = rows.filter(row => row.kind === 'task').map(row => {
    const updated = saved.get(row.id)
    return updated && updated.version > row.version ? updated : row
  })
  const relatedKey = [...new Set(tasks.map(task => id(task.data.entity_id)).filter((value): value is number => value !== null))].sort((a, b) => a - b).join(',')

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const load = useCallback((entryId: number): Promise<Related> => {
    const cached = cache.current.get(entryId)
    if (cached && Date.now() - cached.at < 60000) return Promise.resolve({ entry: cached.entry })
    const running = inFlight.current.get(entryId)
    if (running) return running
    const promise = (async (): Promise<Related> => {
      if (limiter.current.active < 3) limiter.current.active += 1
      else await new Promise<void>(resolve => limiter.current.waiting.push(resolve))
      try {
        const entry = await apiRequest<Entry>({ section: 'crm', path: `/entries/${entryId}`, timeoutMs: 15000 })
        cache.current.set(entryId, { entry, at: Date.now() })
        // Keep a session-local, bounded cache while navigating task pages.
        if (cache.current.size > 500) cache.current.delete(cache.current.keys().next().value!)
        return { entry }
      } catch (error) {
        return { error: error instanceof ApiError && (error.status === 403 || error.status === 404)
          ? 'Карточка недоступна' : 'Не удалось загрузить карточку' }
      } finally {
        const next = limiter.current.waiting.shift()
        if (next) next()
        else limiter.current.active -= 1
        inFlight.current.delete(entryId)
      }
    })()
    inFlight.current.set(entryId, promise)
    return promise
  }, [])

  useEffect(() => {
    let current = true
    const ids = relatedKey ? relatedKey.split(',').map(Number) : []
    const initial = new Map<number, Related>()
    for (const entryId of ids) {
      const cached = cache.current.get(entryId)
      if (cached && Date.now() - cached.at < 60000) initial.set(entryId, { entry: cached.entry })
    }
    setRelated(initial)
    async function resolve() {
      await Promise.all(ids.map(async entryId => {
        const value = await load(entryId)
        if (!current) return
        setRelated(previous => new Map(previous).set(entryId, value))
        if (!value.entry) return
        await Promise.all(contactIds(value.entry).map(async contactId => {
          const contact = await load(contactId)
          if (current) setRelated(previous => new Map(previous).set(contactId, contact))
        }))
      }))
    }
    void resolve()
    return () => { current = false }
  }, [relatedKey, retry, load])

  async function update(task: Entry, data: Record<string, unknown>) {
    if (!canEdit || task.archived || saving.current.has(task.id)) return
    saving.current.add(task.id)
    setPending(new Set(saving.current))
    setErrors(previous => ({ ...previous, [task.id]: '' }))
    try {
      const updated = await api.patch(task, { data })
      if (!mounted.current) return
      setSaved(previous => new Map(previous).set(task.id, updated))
      onChanged(updated)
    } catch (error) {
      if (!mounted.current) return
      const conflict = error instanceof ApiError && error.status === 409
      setErrors(previous => ({ ...previous, [task.id]: conflict
        ? 'Задача уже изменена. Загружаем актуальные данные; повторите действие.'
        : error instanceof Error ? error.message : 'Не удалось сохранить задачу' }))
      if (conflict) onReload()
    } finally {
      saving.current.delete(task.id)
      if (mounted.current) setPending(new Set(saving.current))
    }
  }

  function client(entry: Entry) {
    const phone = text(entry.data.phone)
    const dial = phone.replace(/[^\d+*#,;]/g, '')
    const name = entry.kind === 'inquiry' ? text(entry.data.contact_name) || entry.name : entry.name
    return <div key={entry.id} className="space-y-1">
      <button type="button" className="block text-left text-brand hover:underline" onClick={() => onOpen(entry)}>{name || 'Открыть карточку'}</button>
      {phone ? dial && /\d/.test(dial)
        ? <a className="block whitespace-nowrap text-ink hover:text-brand hover:underline" href={`tel:${dial}`}>{phone}</a>
        : <span className="block text-muted">{phone}</span>
        : <span className="block text-xs text-muted">Телефон не указан</span>}
    </div>
  }

  function relation(task: Entry) {
    const entryId = id(task.data.entity_id)
    if (!entryId) return <span className="text-muted">Не привязана</span>
    const value = related.get(entryId)
    if (!value) return <span className="text-muted" role="status">Загрузка клиента…</span>
    if (!value.entry) return <div className="space-y-1 text-muted"><span>{value.error}</span><button type="button" className="block text-brand hover:underline" onClick={() => setRetry(value => value + 1)}>Повторить загрузку</button></div>
    const entry = value.entry
    if (entry.kind !== 'deal') return client(entry)
    const contacts = contactIds(entry)
    return <div className="space-y-2">
      <button type="button" className="block text-left font-medium text-brand hover:underline" onClick={() => onOpen(entry)}>{entry.name || 'Открыть сделку'}</button>
      {contacts.length ? contacts.map(contactId => {
        const contact = related.get(contactId)
        return contact?.entry ? client(contact.entry) : <div key={contactId} className="text-xs text-muted">
          {contact?.error || 'Загрузка контакта…'}
          {contact?.error && <button type="button" className="ml-2 text-brand hover:underline" onClick={() => setRetry(value => value + 1)}>Повторить загрузку</button>}
        </div>
      }) : <span className="text-xs text-muted">Клиент не привязан</span>}
    </div>
  }

  return <div className="overflow-x-auto rounded-md border border-border bg-surface" aria-busy={loading}>
    <table className="w-full text-left text-[13px]" aria-label="Задачи CRM">
      <thead><tr className="border-b border-border bg-surface-muted">
        {['Задача', 'Клиент / телефон', 'Ответственный', 'Срок', 'Статус', 'Действия'].map(label => <th key={label} className="px-4 py-2.5 font-medium text-muted">{label}</th>)}
      </tr></thead>
      <tbody>{tasks.map(task => {
        const editable = canEdit && !task.archived
        const ownerId = id(task.data.responsible_user_id)
        const owner = catalog.users.find(user => user.id === ownerId)
        const overdue = !task.data.completed && task.data.due_at && new Date(String(task.data.due_at)).getTime() < Date.now()
        return <tr key={task.id} data-task-id={task.id} aria-busy={pending.has(task.id)} className="border-b border-border align-top last:border-0">
          <td className="min-w-48 px-4 py-3">
            <button type="button" className="text-left font-medium hover:text-brand hover:underline" onClick={() => onOpen(task)}>{task.name}</button>
            {task.archived && <div className="mt-1 text-xs text-muted">Архив</div>}
            {errors[task.id] && <p role="alert" className="mt-2 max-w-xs text-danger">{errors[task.id]}</p>}
          </td>
          <td className="min-w-52 px-4 py-3">{relation(task)}</td>
          <td className="min-w-48 px-4 py-3">{editable ? <select
            aria-label={`Ответственный: ${task.name}`}
            className="w-full rounded-md border border-border bg-surface p-2 text-[13px] disabled:opacity-60"
            disabled={pending.has(task.id)} value={ownerId ?? ''}
            onChange={event => void update(task, { responsible_user_id: event.target.value ? Number(event.target.value) : null })}
          >
            <option value="">Не назначен</option>
            {ownerId && !owner && <option value={ownerId}>Пользователь #{ownerId}</option>}
            {catalog.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select> : <span>{owner?.name || (ownerId ? `Пользователь #${ownerId}` : 'Не назначен')}</span>}
          {pending.has(task.id) && <p className="mt-1 text-xs text-muted" role="status">Сохранение…</p>}</td>
          <td className={`whitespace-nowrap px-4 py-3 ${overdue ? 'text-danger' : ''}`}>{dueDate(task.data.due_at)}</td>
          <td className="whitespace-nowrap px-4 py-3"><Chip tone={task.data.completed ? 'success' : 'neutral'}>{task.data.completed ? 'Выполнена' : 'Открыта'}</Chip></td>
          <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
            {editable ? <>
              <Button size="sm" variant="secondary" disabled={pending.has(task.id)} onClick={() => onEdit(task)}>Изменить</Button>
              <Button size="sm" variant="ghost" disabled={pending.has(task.id)} onClick={() => void update(task, { completed: !task.data.completed })}>{task.data.completed ? 'Возобновить' : 'Выполнить'}</Button>
            </> : <Button size="sm" variant="ghost" onClick={() => onOpen(task)}>Открыть</Button>}
          </div></td>
        </tr>
      })}
      {!tasks.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">{loading ? 'Загрузка…' : 'Нет задач'}</td></tr>}
      </tbody>
    </table>
  </div>
}
