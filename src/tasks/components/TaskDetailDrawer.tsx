import { useState } from 'react'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { FileLink } from '@/shared/ui/FileLink'
import { useTasksStore } from '../store'
import { Task, TASK_STATES, TaskStatus } from '../types'
import { stateTone } from './stateTone'

export function TaskDetailDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const setStatus = useTasksStore((s) => s.setStatus)
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

        {error && <p className="text-[12px] text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {task.status === 'ready' && (
            <Button size="sm" disabled={busy} onClick={() => act('in_progress')}>
              Взять в работу
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button size="sm" disabled={busy} onClick={() => act('in_review')}>
              {task.reviewers.length > 0 ? 'Отправить на проверку' : 'Сдать задачу'}
            </Button>
          )}
          {task.status === 'in_review' && (
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
