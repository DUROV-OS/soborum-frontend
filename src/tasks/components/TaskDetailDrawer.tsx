import { ReactNode, useEffect, useRef, useState } from 'react'
import { ExternalLink, Paperclip, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { useAuthStore } from '@/auth/store'
import { accessLevelAtLeast } from '@/auth/types'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Textarea } from '@/shared/ui/Field'
import { FileLink } from '@/shared/ui/FileLink'
import { Select } from '@/shared/ui/Field'
import { listReportRevisions } from '../api'
import { useTasksStore } from '../store'
import {
  Task,
  TaskReport,
  TaskReportRevision,
  TASK_PRIORITIES,
  TASK_REPORT_KIND_LABEL,
  TASK_STATES,
  TaskPriority,
  TaskStatus,
} from '../types'
import { stateTone } from './stateTone'

export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const setStatus = useTasksStore((s) => s.setStatus)
  const update = useTasksStore((s) => s.update)
  const submitReport = useTasksStore((s) => s.submitReport)
  const review = useTasksStore((s) => s.review)
  const editReportComment = useTasksStore((s) => s.editReportComment)
  const currentUserId = useAuthStore((s) => s.current?.id ?? null)
  const navigate = useNavigate()
  const canEdit = accessLevelAtLeast(useAccessLevel('tasks'), 'edit')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Общая форма отчёта: у исполнителя раскрывается по кнопке сдачи и без
  // комментария не отправляется, у проверяющего открыта сразу и комментарий
  // с файлами необязательны (0077).
  const [reporting, setReporting] = useState(false)
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const taskId = task?.id ?? null

  useEffect(() => {
    setError(null)
    setReporting(false)
    setComment('')
    setFiles([])
  }, [taskId])

  if (!task || taskId === null) return null

  function resetForm() {
    setReporting(false)
    setComment('')
    setFiles([])
    setError(null)
  }

  async function run(action: () => Promise<{ ok: boolean; reason?: string }>, fallback: string) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result.ok) resetForm()
    else setError(result.reason ?? fallback)
  }

  async function act(target: TaskStatus) {
    if (taskId === null) return
    await run(() => setStatus(taskId, target), 'Действие недоступно')
  }

  async function sendReport() {
    if (taskId === null || !comment.trim()) return
    await run(() => submitReport(taskId, comment.trim(), files), 'Не удалось сдать задачу')
  }

  async function decide(accept: boolean) {
    if (taskId === null) return
    await run(() => review(taskId, accept, comment.trim(), files), 'Действие недоступно')
  }

  async function changePriority(target: TaskPriority) {
    if (taskId === null) return
    setBusy(true)
    const result = await update(taskId, { priority: target })
    setBusy(false)
    setError(result.ok ? null : result.reason ?? 'Действие недоступно')
  }

  const stateLabel = TASK_STATES.find((s) => s.key === task.status)?.label ?? task.status
  const reviewRequired = task.review_policy === 'review_required'
  // Задачу блока производства исполнитель не принимает сам (0084-f) — сервер
  // ответит 403, поэтому кнопку «Принять» ему не показываем.
  const ownAcceptBlocked = reviewRequired && task.assignees.some((a) => a.id === currentUserId)
  const attachments = (
    <>
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          if (picked.length > 0) setFiles((prev) => [...prev, ...picked])
          e.target.value = ''
        }}
      />
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => fileInput.current?.click()}>
        <Paperclip size={14} />
        Прикрепить файл
      </Button>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between text-[13px] text-ink">
              <span className="flex items-center gap-1.5">
                <Paperclip size={13} className="text-muted" />
                {file.name}
              </span>
              <button
                type="button"
                aria-label={`Убрать ${file.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                className="rounded-pill p-1 text-muted hover:text-danger"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
  const priorityLabel = TASK_PRIORITIES.find((p) => p.key === task.priority)?.label ?? task.priority

  return (
    <Drawer open={!!task} onClose={onClose} title={task.title} subtitle={<Chip tone={stateTone(task.status)}>{stateLabel}</Chip>}>
      <div className="flex flex-col gap-5">
        {task.description && <p className="whitespace-pre-line text-[13px] text-ink">{task.description}</p>}

        {/* Задачу стадии клиента решают в его карточке — кнопкой перехода (0094). */}
        {task.link_type === 'client_stage' && task.link_id !== null && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              onClose()
              navigate(`/clients/${task.link_id}`)
            }}
          >
            <ExternalLink size={14} />
            Открыть карточку клиента
          </Button>
        )}

        {task.deadline && <Row label="Дедлайн" value={new Date(task.deadline).toLocaleDateString('ru-RU')} />}

        {canEdit ? (
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted">Приоритет</span>
            <Select
              className="w-auto py-1"
              value={task.priority}
              disabled={busy}
              onChange={(e) => changePriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <Row label="Приоритет" value={priorityLabel} />
        )}

        <Row label="Исполнители" value={task.assignees.map((a) => a.full_name).join(', ') || '—'} />
        <Row label="Ответственный" value={task.responsible?.full_name ?? '—'} />
        <Row
          label="Проверяющие"
          value={
            task.reviewers.map((a) => a.full_name).join(', ') ||
            (reviewRequired ? 'нет — нужен проверяющий' : 'нет — проверка не требуется')
          }
        />
        {task.review_blocked_reason === 'no_reviewer' && (
          <p className="rounded-md border border-danger/30 bg-danger-bg/40 px-3 py-2 text-[13px] font-medium text-danger">
            Нет проверяющего — задача не закроется, пока его не назначат.
          </p>
        )}

        {task.depends_on_ids.length > 0 && <Row label="Зависит от" value={`${task.depends_on_ids.length} задач(и)`} />}

        {task.images.length > 0 && (
          <div>
            <div className="mb-1.5 text-[13px] text-muted">Изображения</div>
            <div className="flex flex-col gap-1">
              {task.images.map((img) => (
                <FileLink key={img.id} id={img.id} filename={img.filename} />
              ))}
            </div>
          </div>
        )}

        {task.reports.length > 0 && (
          <div className="border-t border-border pt-4">
            <div className="mb-2 text-[13px] text-muted">Отчёты по задаче</div>
            <div className="flex flex-col gap-3">
              {task.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  taskId={taskId}
                  report={report}
                  // Свой комментарий автор правит в любой момент, в том числе
                  // после того, как задачу приняли (0077).
                  // Служебная запись о назначении проверяющего не правится.
                  canEditComment={canEdit && report.author.id === currentUserId && report.kind !== 'reviewer_assigned'}
                  onSave={(text) => editReportComment(taskId, report.id, text)}
                />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-danger">{error}</p>}

        {canEdit && (reporting || task.status === 'in_review') && (
          <FormBox>
            <Field
              label={task.status === 'in_review' ? 'Комментарий проверяющего' : 'Что сделано по задаче'}
              required={task.status !== 'in_review'}
              hint={task.status === 'in_review' ? 'Необязательно — можно принять или вернуть и без комментария' : undefined}
            >
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  task.status === 'in_review'
                    ? 'Например: принято, акт приёмки приложил'
                    : 'Например: фасад покрашен в два слоя, остатки краски вернул на склад'
                }
              />
            </Field>
            {attachments}
            {task.status === 'in_review' ? (
              <div className="flex flex-col gap-2">
                {ownAcceptBlocked && (
                  <p className="text-[13px] font-medium text-danger">
                    Свою сдачу принять нельзя — задачу блока производства принимает другой сотрудник.
                  </p>
                )}
                <div className="flex gap-2">
                  {!ownAcceptBlocked && (
                    <Button size="sm" disabled={busy} onClick={() => decide(true)}>
                      {busy ? 'Отправляем…' : 'Принять — выполнена'}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide(false)}>
                    Вернуть в работу
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !comment.trim()} onClick={sendReport}>
                  {busy ? 'Отправляем…' : 'Выполнено — отправить отчёт'}
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            )}
          </FormBox>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {!canEdit && task.status !== 'not_ready' && task.status !== 'done' && (
            <p className="text-[12px] text-muted">У вас нет прав менять статус этой задачи.</p>
          )}
          {canEdit && task.status === 'ready' && (
            <Button size="sm" disabled={busy} onClick={() => act('in_progress')}>
              Взять в работу
            </Button>
          )}
          {canEdit && task.status === 'in_progress' && !reporting && (
            <Button size="sm" disabled={busy} onClick={() => setReporting(true)}>
              {task.reviewers.length > 0 || reviewRequired ? 'Отправить на проверку' : 'Сдать задачу'}
            </Button>
          )}
          {task.status === 'not_ready' && (
            <p className="text-[12px] text-muted">
              Задача откроется автоматически, когда будут выполнены задачи, от которых она зависит.
            </p>
          )}
          {task.status === 'done' && <p className="text-[12px] text-muted">Задача выполнена.</p>}
        </div>
      </div>
    </Drawer>
  )
}

function FormBox({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4">{children}</div>
}

function ReportCard({
  taskId,
  report,
  canEditComment,
  onSave,
}: {
  taskId: number
  report: TaskReport
  canEditComment: boolean
  onSave: (comment: string) => Promise<{ ok: boolean; reason?: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(report.comment)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save() {
    if (!draft.trim()) return
    setSaving(true)
    const result = await onSave(draft.trim())
    setSaving(false)
    if (result.ok) {
      setEditing(false)
      setSaveError(null)
    } else {
      setSaveError(result.reason ?? 'Не удалось сохранить комментарий')
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-muted">
        <span>
          {TASK_REPORT_KIND_LABEL[report.kind]} · {report.author.full_name}
        </span>
        <span>
          {new Date(report.created_at).toLocaleString('ru-RU')}
        </span>
      </div>
      <ReportEditedMark taskId={taskId} report={report} />
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {saveError && <p className="text-[12px] text-danger">{saveError}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving || !draft.trim()} onClick={save}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setDraft(report.comment)
                setSaveError(null)
                setEditing(false)
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <>
          {report.comment && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink">{report.comment}</p>}
          {canEditComment && (
            <button
              type="button"
              onClick={() => {
                setDraft(report.comment)
                setEditing(true)
              }}
              className="mt-1.5 text-[12px] text-brand-dark hover:underline"
            >
              Изменить комментарий
            </button>
          )}
        </>
      )}
      {report.files.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {report.files.map((file) => (
            <FileLink key={file.id} id={file.id} filename={file.filename} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Пометка «изменено» / «изменено после приёмки» у записи журнала и прежние
 * версии текста по клику (0084-g). Правки, сделанные до того, как начали
 * хранить историю, помечены, но прежнего текста у них нет — так и пишем.
 */
function ReportEditedMark({ taskId, report }: { taskId: number; report: TaskReport }) {
  const [open, setOpen] = useState(false)
  const [revisions, setRevisions] = useState<TaskReportRevision[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Новая правка — новая версия в истории: загруженный список устарел.
  useEffect(() => {
    setRevisions(null)
  }, [report.revisions_count])

  useEffect(() => {
    if (!open || revisions !== null) return
    let cancelled = false
    listReportRevisions(taskId, report.id)
      .then((list) => {
        if (!cancelled) {
          setRevisions(list)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить прежние версии')
      })
    return () => {
      cancelled = true
    }
  }, [open, revisions, taskId, report.id])

  if (!report.updated_at && report.revisions_count === 0) return null

  const label = report.edited_after_acceptance ? 'Изменено после приёмки' : 'Изменено'
  const tone = report.edited_after_acceptance ? 'warning' : 'info'

  if (report.revisions_count === 0) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Chip tone={tone}>{label}</Chip>
        <span className="text-[12px] text-muted">прежний текст не сохранился — правка сделана до ведения истории</span>
      </div>
    )
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-pill"
        title="Показать прежние версии"
      >
        <Chip tone={tone}>
          {label} · версий: {report.revisions_count} {open ? '▴' : '▾'}
        </Chip>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3">
          {loadError && <p className="text-[12px] text-danger">{loadError}</p>}
          {!loadError && revisions === null && <p className="text-[12px] text-muted">Загружаем…</p>}
          {revisions?.map((revision) => (
            <div key={revision.id} className="flex flex-col gap-1">
              <div className="text-[12px] text-muted">
                Было до правки {new Date(revision.edited_at).toLocaleString('ru-RU')}
                {' · '}правил(а) {revision.edited_by?.full_name ?? 'удалённый пользователь'}
                {revision.after_acceptance && (
                  <span className="font-medium text-warning"> · после приёмки</span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[13px] text-ink">{revision.comment || '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  )
}
