import { useEffect, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Textarea } from '@/shared/ui/Field'
import { FileLink } from '@/shared/ui/FileLink'
import { useTasksStore } from '../store'
import { Task, TaskReport, TASK_STATES, TaskStatus } from '../types'
import { stateTone } from './stateTone'

export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const setStatus = useTasksStore((s) => s.setStatus)
  const submitReport = useTasksStore((s) => s.submitReport)
  const canEdit = accessLevelAtLeast(useAccessLevel('tasks'), 'edit')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Форма отчёта: раскрывается по кнопке сдачи, сдать задачу без неё нельзя (0077).
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

  async function act(target: TaskStatus) {
    if (taskId === null) return
    setBusy(true)
    const result = await setStatus(taskId, target)
    setBusy(false)
    setError(result.ok ? null : result.reason ?? 'Действие недоступно')
  }

  async function sendReport() {
    if (taskId === null || !comment.trim()) return
    setBusy(true)
    const result = await submitReport(taskId, comment.trim(), files)
    setBusy(false)
    if (result.ok) {
      setReporting(false)
      setComment('')
      setFiles([])
      setError(null)
    } else {
      setError(result.reason ?? 'Не удалось сдать задачу')
    }
  }

  const stateLabel = TASK_STATES.find((s) => s.key === task.status)?.label ?? task.status

  return (
    <Drawer open={!!task} onClose={onClose} title={task.title} subtitle={<Chip tone={stateTone(task.status)}>{stateLabel}</Chip>}>
      <div className="flex flex-col gap-5">
        {task.description && <p className="text-[13px] text-ink">{task.description}</p>}

        {task.deadline && <Row label="Дедлайн" value={new Date(task.deadline).toLocaleDateString('ru-RU')} />}

        <Row label="Исполнители" value={task.assignees.map((a) => a.full_name).join(', ') || '—'} />
        <Row label="Ответственный" value={task.responsible?.full_name ?? '—'} />
        <Row label="Проверяющие" value={task.reviewers.map((a) => a.full_name).join(', ') || 'нет — проверка не требуется'} />

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
            <div className="mb-2 text-[13px] text-muted">
              {task.reports.length > 1 ? 'Отчёты исполнителя' : 'Отчёт исполнителя'}
            </div>
            <div className="flex flex-col gap-3">
              {task.reports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-danger">{error}</p>}

        {reporting && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4">
            <Field label="Что сделано по задаче" required>
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: фасад покрашен в два слоя, остатки краски вернул на склад"
              />
            </Field>

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

            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !comment.trim()} onClick={sendReport}>
                {busy ? 'Отправляем…' : 'Выполнено — отправить отчёт'}
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReporting(false)}>
                Отмена
              </Button>
            </div>
          </div>
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
              {task.reviewers.length > 0 ? 'Отправить на проверку' : 'Сдать задачу'}
            </Button>
          )}
          {canEdit && task.status === 'in_review' && (
            <>
              <Button size="sm" disabled={busy} onClick={() => act('done')}>
                Принять — выполнена
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('in_progress')}>
                Вернуть в работу
              </Button>
            </>
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

function ReportCard({ report }: { report: TaskReport }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-muted">
        <span>{report.author.full_name}</span>
        <span>{new Date(report.created_at).toLocaleString('ru-RU')}</span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink">{report.comment}</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  )
}
