import { Task } from '../types'

/** Компактная сводка «кто на задаче» для карточки/списка — исполнители,
 * ответственный (визуально отдельно, не смешивается с исполнителями) и
 * проверяющие. Общий для раздела «Задачи» (TasksPage) и карточки задачи блока
 * производства (BlockDetailPage) — один компонент, не отдельная вёрстка. */
export function TaskPeopleBadges({ task }: { task: Task }) {
  if (task.assignees.length === 0 && !task.responsible && task.reviewers.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      {task.assignees.length > 0 && <span>Испол.: {task.assignees.map((a) => a.full_name).join(', ')}</span>}
      {task.responsible && <span className="font-medium text-ink">Отв.: {task.responsible.full_name}</span>}
      {task.reviewers.length > 0 && <span>Пров.: {task.reviewers.map((a) => a.full_name).join(', ')}</span>}
    </div>
  )
}
