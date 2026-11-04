import { useEffect, useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import * as api from './api'
import type { Catalog, Entry } from './api'

const FETCH_SIZE = 100
const DISPLAY_SIZE = 25
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const title = (entry: Entry) => text(entry.data.contact_name) || text(entry.data.phone) || text(entry.data.email) || entry.name || `Заявка #${entry.id}`

/** Inbox cards retain their inquiry identity and do not imply acceptance or create deals. */
export function CrmInboxColumn({ catalog, pipeline, query, archive, owner, revision, canEdit, onOpen, onAccept, onCount, onDragStart, onDragEnd }: {
  catalog: Catalog
  pipeline: string
  query: string
  archive: string
  owner: string
  revision: number
  canEdit: boolean
  onOpen: (entry: Entry) => void
  onAccept: (entry: Entry) => void
  onCount: (count: number | null) => void
  onDragStart?: (entry: Entry) => void
  onDragEnd?: () => void
}) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [limits, setLimits] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    let failed = false
    setLoading(true)
    setError('')
    setEntries([])
    setLimits({})
    const timer = window.setTimeout(async () => {
      try {
        const first = await api.list('inquiry', { query, archive, owner_id: owner === '' ? undefined : Number(owner), limit: FETCH_SIZE, offset: 0 })
        if (cancelled) return
        const byId = new Map(first.items.map(entry => [entry.id, entry]))
        if (first.items.length !== Math.min(FETCH_SIZE, first.total)) throw new Error('Список входящих изменился. Обновите загрузку.')
        let nextOffset = FETCH_SIZE
        await Promise.all(Array.from({ length: Math.min(3, Math.ceil(Math.max(0, first.total - FETCH_SIZE) / FETCH_SIZE)) }, async () => {
          while (nextOffset < first.total && !cancelled && !failed) {
            const offset = nextOffset
            nextOffset += FETCH_SIZE
            try {
              const page = await api.list('inquiry', { query, archive, owner_id: owner === '' ? undefined : Number(owner), limit: FETCH_SIZE, offset })
              if (cancelled) return
              if (page.total !== first.total || page.items.length !== Math.min(FETCH_SIZE, first.total - offset)) {
                throw new Error('Список входящих изменился. Обновите загрузку.')
              }
              for (const entry of page.items) byId.set(entry.id, entry)
            } catch (cause) {
              failed = true
              throw cause
            }
          }
        }))
        if (cancelled) return
        if (byId.size !== first.total) throw new Error('Список входящих изменился во время загрузки. Повторите загрузку для полной сверки.')
        setEntries([...byId.values()].sort((a, b) => b.id - a.id))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить входящие заявки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, archive, owner, revision, reload])

  const defaultPipeline = catalog.pipelines.find(item => item.name.trim().toLocaleLowerCase('ru-RU') === 'допродажная воронка')?.id ?? catalog.pipelines[0]?.id
  // Website intake may have no assigned funnel yet; display it at the agreed entry point without marking it processed.
  const waiting = useMemo(() => entries.filter(entry => String(entry.data.pipeline_id ?? defaultPipeline) === pipeline && !entry.data.accepted_deal_id), [entries, pipeline, defaultPipeline])
  const limit = limits[pipeline] || DISPLAY_SIZE
  useEffect(() => {
    onCount(loading || error ? null : waiting.length)
  }, [loading, error, waiting.length, onCount])

  return <div aria-label="Новые заявки" aria-busy={loading} data-inbox-scope="pipeline" data-inquiry-queue={pipeline}
    data-total={loading || error ? undefined : waiting.length} className="space-y-2">
        {loading && <p role="status" className="p-3 text-xs text-muted">Загружаем все входящие…</p>}
        {error && <div role="alert" className="p-3 text-xs text-danger"><p>{error}</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => setReload(value => value + 1)}>Повторить загрузку входящих</Button></div>}
        {!loading && !error && waiting.slice(0, limit).map(entry => {
          const name = title(entry)
          const source = text(entry.data.source_name) || (entry.name !== name ? entry.name : '')
          const phone = text(entry.data.phone), email = text(entry.data.email)
          const draggable = canEdit && !entry.archived && !!onDragStart
          return <article key={entry.id} data-inquiry-id={entry.id} draggable={draggable}
            onDragStart={event => {
              if (!draggable) { event.preventDefault(); return }
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(entry.id))
              onDragStart?.(entry)
            }}
            onDragEnd={() => onDragEnd?.()}
            className={`rounded-lg border border-border bg-white p-3 shadow-sm ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
            <div className="flex items-start gap-1"><button type="button" className="min-w-0 flex-1 break-words text-left text-sm font-medium text-ink hover:text-brand" onClick={() => onOpen(entry)}>{name}</button>
              {draggable && <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />}
            </div>
            {source && <p className="mt-2 break-words text-xs text-muted">Источник: {source}</p>}
            {phone && phone !== name && <p className="mt-2 break-words text-xs text-muted">{phone}</p>}
            {email && email !== name && <p className="mt-1 break-words text-xs text-muted">{email}</p>}
            {entry.effective_owner_id != null && <p className="mt-2 text-xs text-muted">{catalog.users.find(user => user.id === entry.effective_owner_id)?.name || `Сотрудник #${entry.effective_owner_id}`}</p>}
            <p className="mt-2 text-xs text-muted">{entry.archived ? 'В архиве' : 'Ожидает обработки'}</p>
            {canEdit && !entry.archived && <button type="button" aria-label={`Взять в работу: ${name}`} className="mt-3 min-h-8 border-t border-border pt-2 text-xs font-medium text-brand" onClick={() => onAccept(entry)}>Взять в работу</button>}
          </article>
        })}
        {!loading && !error && waiting.length > limit && <button type="button" className="min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium" onClick={() => setLimits(previous => ({ ...previous, [pipeline]: limit + DISPLAY_SIZE }))}>Показать ещё заявки · {Math.min(limit, waiting.length)} из {waiting.length}</button>}
    </div>
}
