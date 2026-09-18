import { useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { FileLink } from '@/shared/ui/FileLink'
import { Select } from '@/shared/ui/Field'
import { useTasksStore } from '../store'
import { Task, TASK_PRIORITIES, TASK_STATES, TaskPriority, TaskStatus } from '../types'
import { stateTone } from './stateTone'

export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const setStatus = useTasksStore((s) => s.setStatus)
  const update = useTasksStore((s) => s.update)
  const canEdit = accessLevelAtLeast(useAccessLevel('tasks'), 'edit')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!task) return null

  const taskId = task.id

  async function act(target: TaskStatus) {
    setBusy(true)
    const result = await setStatus(taskId, target)
    setBusy(false)
    setError(result.ok ? null : result.reason ?? 'Действие недоступно')
  }

  async function changePriority(target: TaskPriority) {
    setBusy(true)
    const result = await update(taskId, { priority: target })
    setBusy(false)
    setError(result.ok ? null : result.reason ?? 'Действие недоступно')
  }

  const stateLabel = TASK_STATES.find((s) => s.key === task.status)?.label ?? task.status
  const priorityLabel = TASK_PRIORITIES.find((p) => p.key === task.priority)?.label ?? task.priority

  return (
    <Drawer open={!!task} onClose={onClose} title={task.title} subtitle={<Chip tone={stateTone(task.status)}>{stateLabel}</Chip>}>
      <div className="flex flex-col gap-5">
        {task.description && <p className="text-[13px] text-ink">{task.description}</p>}

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

        {error && <p className="text-[12px] text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {!canEdit && task.status !== 'not_ready' && task.status !== 'done' && (
            <p className="text-[12px] text-muted">У вас нет прав менять статус этой задачи.</p>
          )}
          {canEdit && task.status === 'ready' && (
            <Button size="sm" disabled={busy} onClick={() => act('in_progress')}>
              Взять в работу
            </Button>
          )}
          {canEdit && task.status === 'in_progress' && (
            <Button size="sm" disabled={busy} onClick={() => act('in_review')}>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  )
}
