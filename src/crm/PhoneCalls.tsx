import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, fetchMedia } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'

type Point = { text: string; quote: string }
type Call = {
  id: number; phone: string; direction: string; employee: string; started_at: string | null
  duration: number; status: string; client_id: number | null; crm_entity_id: number | null
  match_status: string; audio_ready: boolean; processing: string; error: string; transcript: string
  segments: { start: number; end: number; text: string }[]
  analysis: { summary?: string; key_points?: Point[]; tasks?: Point[] }
  reviewed_at: string | null
}
const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const states: Record<string, string> = {
  waiting_recording: 'Ожидаем запись от МегаФона', queued: 'В очереди на расшифровку',
  processing: 'Распознаём и анализируем', ready: 'Текст и анализ готовы', error: 'Нужна проверка обработки',
}

export function PhoneCalls({ clientId, entityId, canEdit = false }: {
  clientId?: number; entityId?: number; canEdit?: boolean
}) {
  const [opened, setOpened] = useState(Boolean(clientId || entityId))
  const [unmatched, setUnmatched] = useState(false)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{ total: number; items: Call[] }>({ total: 0, items: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [revision, refresh] = useState(0)
  useEffect(() => {
    if (!opened) return
    let current = true
    setLoading(true)
    const load = () => apiRequest<{ total: number; items: Call[] }>({ section: 'crm', path: '/calls',
      query: { client_id: unmatched ? undefined : clientId, entity_id: unmatched ? undefined : entityId,
        unmatched: unmatched ? 'true' : undefined, offset: page * 20, limit: 20 } })
      .then(r => { if (current) { setResult(r); setError('') } })
      .catch(e => { if (current) setError(e.message) })
      .finally(() => { if (current) setLoading(false) })
    void load()
    const timer = window.setInterval(() => { if (!document.hidden) void load() }, 30000)
    return () => { current = false; window.clearInterval(timer) }
  }, [opened, clientId, entityId, unmatched, page, revision])
  return <section className="rounded-xl border border-border bg-surface p-4 my-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button className="font-medium text-left" onClick={() => setOpened(v => !v)} aria-expanded={opened}>
        {opened ? '▾' : '▸'} {clientId || entityId ? 'Звонки клиента' : 'Звонки компании'}
      </button>
      {opened && <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => refresh(v => v + 1)}>Обновить</Button>
        <Button variant="secondary" size="sm" onClick={() => { setUnmatched(v => !v); setPage(0) }}>
          {unmatched ? 'Показать связанные звонки' : 'Без привязки / спорные номера'}
        </Button>
      </div>}
    </div>
    {opened && <>
      {error && <p role="alert" className="my-3 text-danger">{error}</p>}
      {loading && <p className="my-3 text-muted">Загрузка звонков…</p>}
      {!loading && !error && result.total === 0 && <p className="my-3 text-muted">
        Пока нет звонков. Записи появятся после подключения и загрузки истории МегаФона.
      </p>}
      {result.items.map(call => <CallItem key={`${clientId}-${entityId}-${call.id}`} call={call}
        canEdit={canEdit} clientId={clientId} entityId={entityId} refresh={() => refresh(v => v + 1)} />)}
      {result.total > 20 && <div className="mt-3 flex items-center gap-3">
        <Button size="sm" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Назад</Button>
        <span>{page * 20 + 1}–{Math.min((page + 1) * 20, result.total)} из {result.total}</span>
        <Button size="sm" disabled={(page + 1) * 20 >= result.total} onClick={() => setPage(v => v + 1)}>Далее</Button>
      </div>}
    </>}
  </section>
}

function CallItem({ call, canEdit, clientId, entityId, refresh }: {
  call: Call; canEdit: boolean; clientId?: number; entityId?: number; refresh: () => void
}) {
  const [src, setSrc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const player = useRef<HTMLAudioElement>(null)
  const controller = useRef<AbortController>()
  const objectUrl = useRef('')
  useEffect(() => () => {
    controller.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])
  async function audio() {
    setBusy(true); setError('')
    controller.current?.abort()
    controller.current = new AbortController()
    try {
      const blob = await fetchMedia('crm', `/calls/${call.id}/audio`, controller.current.signal)
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = URL.createObjectURL(blob)
      setSrc(objectUrl.current)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Не удалось открыть запись')
    } finally { setBusy(false) }
  }
  async function action(name: 'review' | 'retry' | 'link') {
    setBusy(true); setError('')
    try {
      await apiRequest({ section: 'crm', path: `/calls/${call.id}/${name}`, method: 'POST',
        body: name === 'link' ? { client_id: clientId ?? null, crm_entity_id: entityId ?? null } : undefined })
      refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить') }
    finally { setBusy(false) }
  }
  return <details className="mt-3 rounded-lg border border-border p-3">
    <summary className="cursor-pointer">
      <span className="font-medium">{call.direction === 'out' ? 'Исходящий' : 'Входящий'} · {call.phone}</span>
      <span className="block text-sm text-muted">{call.started_at ? new Date(call.started_at).toLocaleString('ru-RU') : 'Время уточняется'} · {time(call.duration)} · {states[call.processing] ?? call.processing}</span>
      {call.reviewed_at && <span className="text-sm">Проверено {new Date(call.reviewed_at).toLocaleString('ru-RU')}</span>}
    </summary>
    <div className="mt-3 space-y-3">
      {error && <p role="alert" className="text-danger">{error}</p>}
      {call.employee && <p className="text-sm">Сотрудник: {call.employee}</p>}
      {call.match_status === 'ambiguous' && <p>Номер совпал с несколькими карточками — выберите нужную.</p>}
      {call.match_status === 'unmatched' && <p>Карточка по номеру не найдена.</p>}
      <div className="flex flex-wrap gap-2">
        {call.client_id && <Link className="text-brand underline" to={`/clients/${call.client_id}`}>Карточка клиента</Link>}
        {call.crm_entity_id && <Link className="text-brand underline" to={`/crm?entry=${call.crm_entity_id}`}>Карточка продаж</Link>}
      </div>
      {!src && call.audio_ready && <Button size="sm" disabled={busy} onClick={audio}>Открыть запись</Button>}
      {src && <audio ref={player} className="w-full" controls preload="metadata" src={src} />}
      {call.error && <p className="text-danger">{call.error}</p>}
      {call.analysis.summary && <div><h4 className="font-medium">Краткий анализ ИИ</h4>
        <p className="whitespace-pre-wrap">{call.analysis.summary}</p>
        <p className="text-sm text-muted">Выводы ИИ требуют проверки по записи.</p></div>}
      {(['key_points', 'tasks'] as const).map(key => (call.analysis[key] ?? []).length > 0 &&
        <div key={key}><h4 className="font-medium">{key === 'tasks' ? 'Следующие действия из разговора' : 'Ключевые моменты'}</h4>
          <ul className="space-y-2">{call.analysis[key]!.map((point, i) => <li key={i}>
            <p>{point.text}</p><blockquote className="border-l-2 border-border pl-3 text-sm text-muted">{point.quote}</blockquote>
          </li>)}</ul>
        </div>)}
      {call.transcript && <details><summary className="cursor-pointer font-medium">Полный текст разговора</summary>
        <p className="my-2 text-sm text-muted">Автоматическое распознавание может ошибаться. Время отмечено от начала записи; голоса не определялись.</p>
        {call.segments.length ? call.segments.map((s, i) => <p key={i} className="my-2 whitespace-pre-wrap">
          <button disabled={!src} className="mr-2 text-brand disabled:text-muted" onClick={() => {
            if (player.current) { player.current.currentTime = s.start; void player.current.play() }
          }}>{time(s.start)}</button>{s.text}</p>) : <p className="whitespace-pre-wrap">{call.transcript}</p>}
      </details>}
      {canEdit && <div className="flex flex-wrap gap-2">
        {call.audio_ready && <Button size="sm" disabled={busy} onClick={() => action('review')}>Отметить проверенным</Button>}
        {call.processing === 'error' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => action('retry')}>Повторить обработку</Button>}
        {(clientId || entityId) && (call.match_status === 'ambiguous' || call.match_status === 'unmatched') &&
          <Button size="sm" disabled={busy} onClick={() => action('link')}>Привязать к этой карточке</Button>}
      </div>}
    </div>
  </details>
}
