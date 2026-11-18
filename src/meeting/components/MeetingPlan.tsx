import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import type { MeetingAction, MeetingDetailOut, MeetingProcessing } from '../types'

type Person = { id: number; name: string; can_work_tasks: boolean }
const statusLabels = { queued: 'Запись сохранена. Ожидает обработки', transcribing: 'Расшифровываем запись', analyzing: 'Марина готовит протокол и поручения', ready: 'Протокол готов к проверке', error: 'Обработка не завершена' }
const inputClass = 'mt-1 block w-full rounded-md border border-border bg-surface px-2 py-2 text-sm text-ink disabled:bg-surface-muted'
function localTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const iso = (value: string) => value ? new Date(value).toISOString() : null
const editableAction = ({ task_id: _task, event_id: _event, ...a }: MeetingAction) => Object.fromEntries(Object.entries(a).filter(([k]) => !['approved_at', 'approved_by'].includes(k)))

export function MeetingPlan({ meeting, onChange }: { meeting: MeetingDetailOut; onChange: (processing: MeetingProcessing) => void }) {
  const processing = meeting.processing
  const [actions, setActions] = useState<MeetingAction[]>(processing?.actions ?? [])
  const [people, setPeople] = useState<Person[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [slots, setSlots] = useState<Record<string, { start: string; end: string }[]>>({})
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const canApprove = canEdit && accessLevelAtLeast(useAccessLevel('tasks'), 'edit')
  useEffect(() => { setActions(processing?.actions ?? []); setSlots({}) }, [processing?.version])
  useEffect(() => {
    let active = true
    if (canEdit) apiRequest<Person[]>({ section: 'projects', path: '/calendar/people' }).then(p => { if (active) setPeople(p) }).catch(() => { if (active) setError('Не удалось загрузить сотрудников. Обновите страницу.') })
    return () => { active = false }
  }, [canEdit])
  function patch(id: string, changes: Partial<MeetingAction>) {
    setActions(a => a.map(item => item.id === id ? { ...item, ...changes } : item))
    setSlots({}); setNotice('Есть несохранённые изменения')
  }
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие') }
    finally { setBusy(false) }
  }
  async function save() {
    const result = await apiRequest<MeetingProcessing>({ section: 'ai', path: `/meetings/${meeting.id}/plan`, method: 'PUT', body: { version: processing!.version, actions: actions.map(editableAction) } })
    onChange(result)
    return result
  }
  const selected = actions.filter(a => a.selected && !a.task_id)
  const approve = () => run(async () => {
    if (!window.confirm(`Утвердить ${selected.length} поручений и создать задачи сотрудникам? Выбранные интервалы также появятся в календаре.`)) return
    const saved = await save()
    const result = await apiRequest<MeetingProcessing>({ section: 'ai', path: `/meetings/${meeting.id}/plan/approve`, method: 'POST', body: { version: saved.version, request_id: crypto.randomUUID(), action_ids: selected.map(a => a.id) } })
    onChange(result); setNotice('Поручения распределены. Задачи и выбранные интервалы созданы.')
  })
  async function findSlots(id: string) {
    await run(async () => {
      await save()
      const start = new Date(), end = new Date(start.getTime() + 14 * 86400000)
      const result = await apiRequest<{ slots: { start: string; end: string }[] }>({ section: 'ai', path: `/meetings/${meeting.id}/plan/slots`, method: 'POST', body: { action_id: id, start: start.toISOString(), end: end.toISOString() } })
      setSlots(prev => ({ ...prev, [id]: result.slots }))
      if (!result.slots.length) setNotice('В ближайшие 14 дней до срока задачи нет свободного окна. Проверьте срок, длительность и загрузку сотрудника.')
    })
  }
  return <section aria-label="Протокол и план совещания" className="space-y-4 rounded-md border border-border bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-medium">Протокол и план работы</h2>
      <span role="status" className="text-xs text-muted">{processing ? statusLabels[processing.status] : 'Запись сохранена'}</span>
    </div>
    {processing?.error && <p className="text-sm text-danger">{processing.error}</p>}
    {canEdit && meeting.has_audio && meeting.status === 'finished' && (!processing || processing.status === 'error') && <Button size="sm" disabled={busy} onClick={() => void run(async () => {
      const result = await apiRequest<MeetingProcessing>({ section: 'ai', path: `/meetings/${meeting.id}/process`, method: 'POST' }); onChange(result)
    })}>{processing ? 'Повторить обработку' : 'Расшифровать и подготовить протокол'}</Button>}
    {processing?.status === 'ready' && <>
      {!!processing.recommendations?.length && <div className="rounded-md bg-ai-bg p-3 text-sm"><h3 className="mb-2 font-medium">Рекомендации Марины</h3><ul className="list-disc space-y-1 pl-5">{processing.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
      <h3 className="text-sm font-medium">Поручения на проверку · {actions.length}</h3>
      {!actions.length && <p className="text-sm text-muted">В разговоре не обнаружено явных поручений. Решения и открытые вопросы находятся в заметках ниже.</p>}
      {actions.map((a, index) => <div key={a.id} className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-start gap-2"><input aria-label={`Распределить поручение ${index + 1}`} type="checkbox" checked={a.selected} disabled={!canEdit || busy || !!a.task_id} onChange={e => patch(a.id, { selected: e.target.checked })} className="mt-1" /><strong className="min-w-0 flex-1 break-words text-sm">{index + 1}. {a.title}</strong>{a.task_id && <Link className="shrink-0 text-xs text-brand" to={`/tasks?task=${a.task_id}`}>Задача №{a.task_id}</Link>}</div>
        <blockquote className="border-l-2 border-brand/30 pl-3 text-xs text-muted">{a.quote}<div className="mt-1 flex flex-wrap gap-2">{a.source_line_ids.map(id => {
          const line = meeting.transcript.find(line => line.id === id)
          return line && <a key={id} href={`#meeting-line-${id}`} className="text-brand underline" onClick={() => { const audio = document.querySelector('audio'); if (audio) audio.currentTime = line.at_ms / 1000 }}>{Math.floor(line.at_ms / 60000)}:{String(Math.floor(line.at_ms / 1000) % 60).padStart(2, '0')}</a>
        })}</div></blockquote>
        {a.clarification && <p className="text-xs text-amber-800">Нужно уточнить: {a.clarification}</p>}
        <fieldset disabled={!canEdit || busy || !!a.task_id} className="space-y-3">
          <label className="block text-xs text-muted">Поручение<input className={inputClass} value={a.title} maxLength={200} onChange={e => patch(a.id, { title: e.target.value })} /></label>
          <label className="block text-xs text-muted">Ожидаемый результат<textarea className={inputClass} value={a.expected_result} maxLength={2000} onChange={e => patch(a.id, { expected_result: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">{(['assignee_id', 'reviewer_id'] as const).map(field => <label key={field} className="text-xs text-muted">{field === 'assignee_id' ? 'Исполнитель' : 'Кто принимает результат'}<select className={inputClass} value={a[field] ?? ''} onChange={e => patch(a.id, { [field]: e.target.value ? Number(e.target.value) : null })}><option value="">Выберите сотрудника</option>{people.filter(p => p.can_work_tasks).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Срок задачи<input className={inputClass} type="datetime-local" value={localTime(a.deadline)} onChange={e => patch(a.id, { deadline: iso(e.target.value) })} /></label><label className="text-xs text-muted">Время на работу, минут<input className={inputClass} type="number" min={5} max={480} step={5} value={a.duration_minutes ?? ''} onChange={e => patch(a.id, { duration_minutes: e.target.value ? Number(e.target.value) : null, scheduled_start: null })} /></label></div>
          <label className="block text-xs text-muted">Начало работы в календаре — по желанию<input className={inputClass} type="datetime-local" value={localTime(a.scheduled_start)} onChange={e => patch(a.id, { scheduled_start: iso(e.target.value) })} /></label>
          {!a.task_id && <Button size="sm" variant="secondary" disabled={!a.assignee_id || !a.duration_minutes} onClick={() => void findSlots(a.id)}>Подобрать свободное время</Button>}
          {!!slots[a.id]?.length && <div className="flex flex-wrap gap-2">{slots[a.id].map(s => <button type="button" key={s.start} className="rounded border border-border px-2 py-1 text-xs text-brand" onClick={() => patch(a.id, { scheduled_start: s.start })}>{new Date(s.start).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</button>)}</div>}
        </fieldset>
      </div>)}
      {!!actions.length && canEdit && <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(async () => { await save(); setNotice('План сохранён') })}>Сохранить план</Button>{canApprove && <Button size="sm" disabled={busy || !selected.length} onClick={() => void approve()}>Утвердить и распределить ({selected.length})</Button>}</div>}
      <p className="text-xs text-muted">Срок — когда нужен результат. Интервал календаря — время на выполнение. Без выбранного интервала создаётся только задача. Изменения утверждённых поручений вносятся в задачах и календаре.</p>
    </>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
  </section>
}
