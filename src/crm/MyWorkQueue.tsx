import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3, RefreshCw } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'

type Bucket = 'overdue' | 'today' | 'no_deadline' | 'no_next_step' | 'upcoming'
type QueueItem = { id: number; kind: 'task' | 'deal'; title: string; bucket: Bucket; due_at: string | null; deadline_invalid: boolean; related: { id: number; kind: string; name: string; archived: boolean } | null }
type Report = { owner_id: number; checked_at: string; timezone: string; total: number; offset: number; counts: Record<Bucket, number>; items: QueueItem[] }
const labels: Record<Bucket, string> = { overdue: 'Просрочено', today: 'Сегодня', no_deadline: 'Без срока', no_next_step: 'Без следующего шага', upcoming: 'Позже' }
const href = (kind: string, id: number) => `/crm?tab=${encodeURIComponent(kind)}&entry=${id}`
const date = (value: string) => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' })

export function MyWorkQueue() {
  const current = useAuthStore(s => s.current)
  const canView = useAuthStore(s => s.hasAccess('crm'))
  const [bucket, setBucket] = useState<Bucket | ''>('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setRevision(value => value + 1) }
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => {
    if (!canView || !current) { setLoading(false); setReport(null); return }
    let active = true
    setLoading(true); setError(''); setReport(null)
    apiRequest<Report>({ section: 'crm', path: '/my-work', query: { bucket: bucket || undefined, offset, limit: 10 } })
      .then(value => { if (active) { if (value.owner_id !== current.id) throw new Error('Очередь не соответствует вашей учётной записи. Обновите страницу.'); setReport(value) } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Не удалось проверить задачи.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canView, current?.id, bucket, offset, revision])

  return <section aria-label="Мои следующие действия" className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 size={20} className="text-brand" />Мои следующие действия</h2><p className="mt-1 text-sm text-muted">Ваши задачи и ваши сделки без открытой задачи. Сроки по Москве.</p></div>
      {canView && <Button size="sm" variant="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />Обновить очередь</Button>}
    </div>
    {!canView ? <p className="mt-4 text-sm text-muted">Для очереди нужен доступ к CRM.</p> : <>
      <div role="group" aria-label="Фильтр моих действий" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {(['', ...Object.keys(labels)] as (Bucket | '')[]).map(key => <button key={key} type="button" aria-pressed={bucket === key} onClick={() => { setBucket(key); setOffset(0) }} className={`min-h-16 rounded-xl border px-3 py-2 text-left text-sm ${bucket === key ? 'border-brand bg-brand/5 text-brand' : 'border-border text-muted hover:bg-surface-muted'}`}>
          <span className="block">{key ? labels[key] : 'Все действия'}</span><span className={`mt-1 block text-lg font-semibold ${key === 'overdue' && report?.counts.overdue ? 'text-danger' : 'text-ink'}`}>{report ? key ? report.counts[key] : Object.values(report.counts).reduce((a,b) => a+b,0) : '—'}</span>
        </button>)}
      </div>
      {loading ? <p role="status" className="py-8 text-center text-sm text-muted">Проверяем задачи и следующие шаги…</p> : error ? <div role="alert" className="mt-4 rounded-xl border border-danger/20 bg-red-50 p-4 text-sm text-danger"><p>{error}</p><button className="mt-2 min-h-11 underline" onClick={() => setRevision(value => value + 1)}>Повторить загрузку очереди</button></div> : report && <>
        {report.items.length ? <ol className="mt-4 divide-y divide-border">{report.items.map(item => <li key={`${item.kind}-${item.id}`} className="py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 ${item.bucket === 'overdue' ? 'bg-red-50 text-danger' : item.bucket === 'no_deadline' || item.bucket === 'no_next_step' ? 'bg-amber-50 text-amber-800' : 'bg-surface-muted text-muted'}`}>{labels[item.bucket]}</span><span className="text-muted">{item.kind === 'task' ? 'Задача' : 'Сделка'} №{item.id}</span>{item.due_at && <time className="font-medium text-ink" dateTime={item.due_at}>{date(item.due_at)}</time>}</div>
          <Link to={href(item.kind, item.id)} className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-ink hover:text-brand"><span className="min-w-0 break-words">{item.title}</span><ArrowUpRight size={17} className="shrink-0 text-brand" /></Link>
          {item.related && <Link to={href(item.related.kind, item.related.id)} className="inline-flex min-h-11 items-center break-words text-sm text-brand hover:underline">Карточка: {item.related.name}{item.related.archived ? ' · в архиве' : ''}</Link>}
          {item.bucket === 'no_next_step' && <p className="mt-1 text-sm text-muted">Откройте сделку и назначьте действие, исполнителя и срок.</p>}
          {item.deadline_invalid && <p className="mt-1 text-sm text-danger">Сохранённый срок некорректен — проверьте задачу.</p>}
        </li>)}</ol> : <p className="py-8 text-center text-sm text-muted">{offset ? 'На этой странице действий больше нет. Вернитесь назад.' : bucket ? 'В этой группе действий нет.' : 'Открытых задач и сделок без следующего шага не найдено.'}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted"><span>Проверено {date(report.checked_at)} · найдено {report.total}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 10))}>Назад</Button><Button size="sm" variant="secondary" disabled={offset + report.items.length >= report.total} onClick={() => setOffset(value => value + 10)}>Далее</Button></div></div>
      </>}
    </>}
  </section>
}
