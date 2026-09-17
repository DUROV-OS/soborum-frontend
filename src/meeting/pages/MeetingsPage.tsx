import { FormEvent, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, Check, Mic, Pencil, Sparkles, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { Markdown } from '@/shared/ui/Markdown'
import {
  askMeeting,
  deleteMeeting,
  downloadMeetingDocument,
  fetchMeetingAudioObjectUrl,
  getMeeting,
  listMeetings,
  refreshNotes,
  updateMeeting,
} from '../api'
import { NotesView } from '../components/NotesView'
import { useMeetingStore } from '../store'
import { MeetingDetailOut, MeetingOut } from '../types'

/** Эффективная дата встречи: указанная человеком (occurred_at) либо начало записи. */
function meetingWhen(meeting: Pick<MeetingOut, 'started_at' | 'occurred_at'>): Date {
  return new Date(meeting.occurred_at ?? meeting.started_at)
}

function meetingTitle(meeting: Pick<MeetingOut, 'title' | 'started_at' | 'occurred_at'>): string {
  if (meeting.title) return meeting.title
  return `Совещание от ${format(meetingWhen(meeting), 'd MMMM yyyy', { locale: ru })}`
}

/** ISO → значение для <input type="datetime-local"> (локальное время). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60
  return mm > 0 ? `${mm} мин ${ss} с` : `${ss} с`
}

function formatClock(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const ss = (totalSeconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function StatusChip({ status }: { status: MeetingOut['status'] }) {
  return status === 'recording' ? (
    <Chip tone="warning">идёт запись</Chip>
  ) : (
    <Chip tone="neutral">завершено</Chip>
  )
}

function StartMeetingCircle() {
  const phase = useMeetingStore((s) => s.phase)
  const start = useMeetingStore((s) => s.start)
  const openPanel = useMeetingStore((s) => s.openPanel)
  const busy = phase === 'starting' || phase === 'recording' || phase === 'finishing'
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')

  if (!canEdit && !busy) return null

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <button
        type="button"
        onClick={() => (busy ? openPanel() : void start())}
        className={`flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-full border-2 text-center transition-colors ${
          busy
            ? 'border-ai/40 bg-ai-bg text-ai-accent'
            : 'border-ai/30 bg-ai-bg/60 text-ai-accent hover:bg-ai/15'
        }`}
      >
        {busy ? (
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        ) : (
          <Mic size={30} />
        )}
        <span className="px-2 text-[13px] font-medium leading-tight">
          {busy ? 'Идёт совещание' : 'Начать совещание'}
        </span>
      </button>
      {busy && (
        <button
          type="button"
          onClick={openPanel}
          className="text-[12px] text-muted hover:underline"
        >
          Открыть панель
        </button>
      )}
    </div>
  )
}

function MeetingList() {
  const [meetings, setMeetings] = useState<MeetingOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const phase = useMeetingStore((s) => s.phase)
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')

  useEffect(() => {
    // перезагружаем список, когда совещание сохранилось
    listMeetings()
      .then(setMeetings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить совещания'))
  }, [phase])

  async function handleDelete(id: number, title: string) {
    if (!window.confirm(`Удалить совещание «${title}»? Транскрипт и заметки тоже удалятся.`)) return
    setRemoving(id)
    setError(null)
    try {
      await deleteMeeting(id)
      setMeetings((list) => (list ? list.filter((m) => m.id !== id) : list))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить совещание')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-medium text-ink">Совещания</h1>
        <p className="mt-1 text-[13px] text-muted">Записи, транскрипты и заметки прошлых совещаний.</p>
      </div>

      <StartMeetingCircle />

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      {!meetings && !error && <LoadingState label="Загружаем совещания…" />}

      {meetings && meetings.length === 0 && (
        <EmptyState
          icon={<Mic size={26} />}
          title="Пока нет совещаний"
          description="Нажмите «Начать совещание» выше — Марина запишет разговор и составит транскрипт."
        />
      )}

      {meetings && meetings.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {meetings.map((meeting) => (
            <li key={meeting.id} className="flex items-center gap-2 pr-2 hover:bg-surface-muted">
              <Link to={`/meetings/${meeting.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{meetingTitle(meeting)}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {format(meetingWhen(meeting), 'd MMM yyyy, HH:mm', { locale: ru })} ·{' '}
                    {formatDuration(meeting.duration_sec)}
                    {meeting.location ? ` · ${meeting.location}` : ''}
                  </div>
                </div>
                <StatusChip status={meeting.status} />
              </Link>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(meeting.id, meetingTitle(meeting))}
                  disabled={removing === meeting.id}
                  aria-label="Удалить совещание"
                  className="shrink-0 rounded-sm p-1.5 text-muted hover:bg-danger-bg hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MeetingAudio({ meetingId, hasAudio }: { meetingId: number; hasAudio: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasAudio) return
    let objectUrl: string | null = null
    let cancelled = false
    fetchMeetingAudioObjectUrl(meetingId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url) // размонтировались, пока грузилось — не течём
          return
        }
        objectUrl = url
        setSrc(url)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить запись')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [meetingId, hasAudio])

  if (!hasAudio) return <p className="text-[13px] text-muted">Запись аудио не сохранена.</p>
  if (error) return <p className="text-[13px] text-danger">{error}</p>
  if (!src) return <p className="text-[13px] text-muted">Загружаем запись…</p>
  return <audio controls src={src} className="w-full" />
}

function AskMarina({ meetingId, aiEnabled }: { meetingId: number; aiEnabled: boolean }) {
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q || pending) return
    setPending(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await askMeeting(meetingId, q)
      setAnswer(res.answer_markdown)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось получить ответ')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-medium text-ink">
        <Sparkles size={15} className="text-ai-accent" />
        Спросить Марину
      </h2>
      <p className="mb-3 text-[12px] text-muted">
        Ответит по транскрипту этого совещания и, если нужно, сверится с базой знаний.
      </p>

      {!canEdit ? (
        <p className="text-[13px] text-muted">Нет прав задавать вопросы по совещанию.</p>
      ) : !aiEnabled ? (
        <p className="text-[13px] text-muted">
          ИИ отключён: не задан ключ. Вопросы по совещанию недоступны.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Например: какие решения приняли и кто ответственный?"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink"
          />
          <Button type="submit" size="sm" disabled={pending || !question.trim()}>
            {pending ? 'Марина думает…' : 'Спросить'}
          </Button>
        </form>
      )}

      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      {answer && (
        <div className="mt-3 rounded-md border border-border bg-surface-muted/40 p-3 text-[13px] text-ink">
          <Markdown text={answer} />
        </div>
      )}
    </section>
  )
}

function MeetingNotesSection({ meeting }: { meeting: MeetingDetailOut }) {
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const [notes, setNotes] = useState(meeting.notes)
  const [busy, setBusy] = useState<'notes' | 'doc' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRefresh() {
    setBusy('notes')
    setError(null)
    try {
      setNotes(await refreshNotes(meeting.id))
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'ИИ-заметки отключены: не задан ключ.'
          : 'Не удалось обновить заметки.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function handleDownload() {
    setBusy('doc')
    setError(null)
    try {
      const date = format(new Date(meeting.started_at), 'yyyy-MM-dd')
      await downloadMeetingDocument(meeting.id, `meeting-${meeting.id}-${date}.md`)
    } catch {
      setError('Не удалось скачать документ.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">Заметки Марины</h2>
        <div className="flex items-center gap-3">
          {meeting.ai_enabled && canEdit && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={busy !== null}
              className="text-[12px] text-brand-dark hover:underline disabled:opacity-50"
            >
              {busy === 'notes' ? 'Обновляем…' : 'Обновить'}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null}
            className="text-[12px] text-brand-dark hover:underline disabled:opacity-50"
          >
            {busy === 'doc' ? 'Готовим…' : 'Документ для базы знаний'}
          </button>
        </div>
      </div>

      {!meeting.ai_enabled && (
        <p className="mb-2 text-[13px] text-muted">
          ИИ-заметки отключены: не задан ключ. Документ для базы знаний соберётся с транскриптом и
          пустыми секциями заметок.
        </p>
      )}
      {meeting.ai_enabled && <NotesView notes={notes} />}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </section>
  )
}

function MeetingDetailHeader({
  meeting,
  onPatched,
}: {
  meeting: MeetingDetailOut
  onPatched: (patch: Partial<MeetingDetailOut>) => void
}) {
  const navigate = useNavigate()
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(meeting.title ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateMeeting(meeting.id, { title: draft.trim() || null })
      onPatched({ title: updated.title })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переименовать')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Удалить это совещание? Транскрипт и заметки тоже удалятся.')) return
    setBusy(true)
    setError(null)
    try {
      await deleteMeeting(meeting.id)
      navigate('/meetings', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save()
                if (e.key === 'Escape') setEditing(false)
              }}
              placeholder="Название совещания"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[18px] font-medium text-ink"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              aria-label="Сохранить"
              className="rounded-sm p-1 text-success hover:bg-success-bg disabled:opacity-50"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(meeting.title ?? '')
              }}
              aria-label="Отмена"
              className="rounded-sm p-1 text-muted hover:bg-surface-muted"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[20px] font-medium text-ink">{meetingTitle(meeting)}</h1>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setDraft(meeting.title ?? '')
                  setEditing(true)
                }}
                aria-label="Переименовать"
                className="shrink-0 rounded-sm p-1 text-muted hover:bg-surface-muted hover:text-ink"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
        <p className="mt-1 text-[13px] text-muted">
          {format(meetingWhen(meeting), 'd MMMM yyyy, HH:mm', { locale: ru })} ·{' '}
          {formatDuration(meeting.duration_sec)}
        </p>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusChip status={meeting.status} />
        {canEdit && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label="Удалить совещание"
            className="rounded-sm p-1.5 text-muted hover:bg-danger-bg hover:text-danger disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

function MeetingCircumstances({
  meeting,
  onPatched,
}: {
  meeting: MeetingDetailOut
  onPatched: (patch: Partial<MeetingDetailOut>) => void
}) {
  const canEdit = accessLevelAtLeast(useAccessLevel('ai'), 'edit')
  const [editing, setEditing] = useState(false)
  const [topic, setTopic] = useState(meeting.topic ?? '')
  const [goals, setGoals] = useState(meeting.goals ?? '')
  const [location, setLocation] = useState(meeting.location ?? '')
  const [participants, setParticipants] = useState(meeting.participants ?? '')
  const [when, setWhen] = useState(toLocalInput(meeting.occurred_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTopic(meeting.topic ?? '')
    setGoals(meeting.goals ?? '')
    setLocation(meeting.location ?? '')
    setParticipants(meeting.participants ?? '')
    setWhen(toLocalInput(meeting.occurred_at))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateMeeting(meeting.id, {
        topic: topic.trim() || null,
        goals: goals.trim() || null,
        location: location.trim() || null,
        participants: participants.trim() || null,
        occurred_at: when ? new Date(when).toISOString() : null,
      })
      onPatched({
        topic: updated.topic,
        goals: updated.goals,
        location: updated.location,
        participants: updated.participants,
        occurred_at: updated.occurred_at,
      })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  const empty =
    !meeting.topic &&
    !meeting.goals &&
    !meeting.location &&
    !meeting.participants &&
    !meeting.occurred_at

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-ink">Тема, цели и обстоятельства встречи</h2>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={() => {
              reset()
              setEditing(true)
            }}
            className="text-[12px] text-brand-dark hover:underline"
          >
            {empty ? 'Заполнить' : 'Изменить'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="block text-[12px] text-muted">
            Тема
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="О чём переговоры"
              className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <label className="block text-[12px] text-muted">
            Цели
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={2}
              placeholder="Чего хотим добиться на этих переговорах"
              className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <label className="block text-[12px] text-muted">
            Где
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Переговорная, Zoom, объект…"
              className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <label className="block text-[12px] text-muted">
            Когда
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <label className="block text-[12px] text-muted">
            С кем
            <input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Игорь, Пётр, снабженец…"
              className="mt-0.5 w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Отмена
            </Button>
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      ) : empty ? (
        <p className="text-[13px] text-muted">Не заполнены.</p>
      ) : (
        <dl className="space-y-1 text-[13px]">
          {meeting.topic && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">Тема</dt>
              <dd className="text-ink">{meeting.topic}</dd>
            </div>
          )}
          {meeting.goals && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">Цели</dt>
              <dd className="whitespace-pre-wrap text-ink">{meeting.goals}</dd>
            </div>
          )}
          {meeting.occurred_at && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">Когда</dt>
              <dd className="text-ink">
                {format(new Date(meeting.occurred_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </dd>
            </div>
          )}
          {meeting.location && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">Где</dt>
              <dd className="text-ink">{meeting.location}</dd>
            </div>
          )}
          {meeting.participants && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">С кем</dt>
              <dd className="text-ink">{meeting.participants}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

function MeetingDetail({ id }: { id: number }) {
  const [meeting, setMeeting] = useState<MeetingDetailOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMeeting(null)
    setError(null)
    getMeeting(id)
      .then(setMeeting)
      .catch((e) => setError(e instanceof Error ? e.message : 'Совещание не найдено'))
  }, [id])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/meetings" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:underline">
        <ArrowLeft size={14} />К списку совещаний
      </Link>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {error}
        </div>
      )}

      {!meeting && !error && <LoadingState label="Загружаем совещание…" />}

      {meeting && (
        <>
          <MeetingDetailHeader
            meeting={meeting}
            onPatched={(patch) => setMeeting((m) => (m ? { ...m, ...patch } : m))}
          />

          <MeetingCircumstances
            meeting={meeting}
            onPatched={(patch) => setMeeting((m) => (m ? { ...m, ...patch } : m))}
          />

          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="mb-3 text-[14px] font-medium text-ink">Запись</h2>
            <MeetingAudio meetingId={meeting.id} hasAudio={meeting.has_audio} />
          </section>

          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="mb-3 text-[14px] font-medium text-ink">Транскрипт</h2>
            {meeting.transcript.length === 0 ? (
              <p className="text-[13px] text-muted">Транскрипт не записан.</p>
            ) : (
              <div className="space-y-2.5">
                {meeting.transcript.map((line) => (
                  <div key={line.id} className="text-[13px]">
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <span className="font-medium">{line.speaker}</span>
                      <span className="tabular-nums">
                        {formatClock(Math.floor(line.at_ms / 1000))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-ink">{line.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <MeetingNotesSection meeting={meeting} />

          <AskMarina meetingId={meeting.id} aiEnabled={meeting.ai_enabled} />
        </>
      )}
    </div>
  )
}

export function MeetingsPage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : null
  if (numericId !== null && !Number.isNaN(numericId)) return <MeetingDetail id={numericId} />
  return <MeetingList />
}
