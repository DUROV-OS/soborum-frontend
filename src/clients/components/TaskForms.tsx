import { useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { useAssignees } from '../useAssignees'
import { Client, ClientTask, ClientTaskInput, CLIENT_TASK_SUGGESTIONS } from '../types'

const SUGGESTIONS_LIST_ID = 'client-task-suggestions'

/** Срок по умолчанию — через три дня: задача без срока в системе не заводится,
 * а конкретную дату менеджер всё равно правит под себя. */
function defaultDeadline(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  return date.toISOString().slice(0, 10)
}

/** Время по умолчанию — конец рабочего дня: иначе «сегодня» приезжает полуночью
 * и метка срока сразу показывает просрочку. */
const DEFAULT_TIME = '18:00'

function toIso(day: string, time: string = DEFAULT_TIME): string {
  return new Date(`${day}T${time || DEFAULT_TIME}:00`).toISOString()
}

/** Дата и время срока по местному времени (ISO с сервера — в UTC). */
function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function isInPast(day: string, time: string): boolean {
  return new Date(`${day}T${time || DEFAULT_TIME}:00`).getTime() < Date.now()
}

const PAST_DEADLINE = 'Срок уже прошёл — выберите дату и время в будущем'

function Suggestions() {
  return (
    <datalist id={SUGGESTIONS_LIST_ID}>
      {CLIENT_TASK_SUGGESTIONS.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  )
}

export function CreateTaskForm({ client, onDone }: { client: Client; onDone: () => void }) {
  const createTask = useClientsStore((s) => s.createTask)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [day, setDay] = useState(defaultDeadline())
  const [time, setTime] = useState(DEFAULT_TIME)
  const currentId = useAuthStore((s) => s.current?.id ?? null)
  const { assignees } = useAssignees()
  // По умолчанию — менеджер клиента, а если его нет — тот, кто ставит задачу.
  const [assigneeId, setAssigneeId] = useState<number | null>(client.manager_id ?? currentId)
  const [blocking, setBlocking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!title.trim() || !day) return
    if (isInPast(day, time)) {
      setError(PAST_DEADLINE)
      return
    }
    setError(null)
    setSaving(true)
    const result = await createTask(client.id, {
      title: title.trim(),
      description: description.trim() || null,
      deadline: toIso(day, time),
      assignee_ids: assigneeId ? [assigneeId] : undefined,
      blocking,
    })
    setSaving(false)
    if (result.ok) {
      onDone()
      return
    }
    setError(result.reason ?? 'Не удалось поставить задачу')
  }

  return (
    <div className="flex flex-col gap-3">
      <Suggestions />
      <Field label="Что нужно сделать" required>
        <Input
          list={SUGGESTIONS_LIST_ID}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Связаться / выслать каталог / уточнить по ипотеке"
        />
      </Field>
      <Field label="Подробности" hint="Необязательно">
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Исполнитель">
        <Select
          value={assigneeId ?? ''}
          onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Исполнитель"
        >
          {assigneeId !== null && !assignees.some((a) => a.id === assigneeId) && (
            <option value={assigneeId}>{assigneeId === currentId ? 'Я' : 'Менеджер клиента'}</option>
          )}
          {assigneeId === null && <option value="">Я</option>}
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Срок" required>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label="Время" required>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={blocking}
          onChange={(e) => setBlocking(e.target.checked)}
          className="h-4 w-4 accent-[#395b4b]"
        />
        Блокирует переход на следующую стадию
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !title.trim()}>
          {saving ? 'Сохранение…' : 'Поставить задачу'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}

export function ShiftDeadlineForm({
  client,
  task,
  onDone,
}: {
  client: Client
  task: ClientTask
  onDone: () => void
}) {
  const shiftTaskDeadline = useClientsStore((s) => s.shiftTaskDeadline)
  const [day, setDay] = useState(task.deadline ? localDay(task.deadline) : defaultDeadline())
  const [time, setTime] = useState(task.deadline ? localTime(task.deadline) : DEFAULT_TIME)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!reason.trim() || !day) return
    if (isInPast(day, time)) {
      setError(PAST_DEADLINE)
      return
    }
    setError(null)
    setSaving(true)
    const result = await shiftTaskDeadline(client.id, task.id, toIso(day, time), reason.trim())
    setSaving(false)
    if (result.ok) {
      onDone()
      return
    }
    setError(result.reason ?? 'Не удалось перенести срок')
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Новый срок" required>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Field label="Время" required>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Причина переноса" required hint="По ней потом видно, почему клиент стоит">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Клиент в отпуске" />
      </Field>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !reason.trim()}>
          {saving ? 'Сохранение…' : 'Перенести'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}

export function CloseTaskForm({
  client,
  task,
  onDone,
}: {
  client: Client
  task: ClientTask
  onDone: () => void
}) {
  const closeTask = useClientsStore((s) => s.closeTask)
  const [resolution, setResolution] = useState('')
  const [withNext, setWithNext] = useState(false)
  const [nextTitle, setNextTitle] = useState('')
  const [nextDay, setNextDay] = useState(defaultDeadline())
  const [nextTime, setNextTime] = useState(DEFAULT_TIME)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextReady = !withNext || Boolean(nextTitle.trim() && nextDay)

  async function submit() {
    if (!resolution.trim() || !nextReady) return
    if (withNext && isInPast(nextDay, nextTime)) {
      setError(PAST_DEADLINE)
      return
    }
    setError(null)
    const next: ClientTaskInput | undefined = withNext
      ? { title: nextTitle.trim(), deadline: toIso(nextDay, nextTime), blocking: true }
      : undefined
    setSaving(true)
    const result = await closeTask(client.id, task.id, resolution.trim(), next)
    setSaving(false)
    if (result.ok) {
      onDone()
      return
    }
    setError(result.reason ?? 'Не удалось закрыть задачу')
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <Suggestions />
      <Field label="Чем закончилась задача" required>
        <Textarea
          rows={2}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Дозвонился, клиент просит каталог"
        />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={withNext}
          onChange={(e) => setWithNext(e.target.checked)}
          className="h-4 w-4 accent-[#395b4b]"
        />
        Сразу поставить вытекающую задачу
      </label>
      {withNext && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Что нужно сделать" required>
            <Input
              list={SUGGESTIONS_LIST_ID}
              value={nextTitle}
              onChange={(e) => setNextTitle(e.target.value)}
              placeholder="Выслать каталог"
            />
          </Field>
          <Field label="Срок" required>
            <Input type="date" value={nextDay} onChange={(e) => setNextDay(e.target.value)} />
          </Field>
          <Field label="Время" required>
            <Input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !resolution.trim() || !nextReady}>
          {saving ? 'Сохранение…' : 'Готово'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}
