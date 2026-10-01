import { ClientTask } from './types'

/** Человеческая метка срока задачи: «сегодня», «завтра», «просрочено на N
 * дней» или дата. Настоящих уведомлений в системе нет (см. задачу 0080) —
 * эта метка вместе с задачей в «Моих задачах» и есть то, что напоминает
 * менеджеру о сроке. */
export interface DeadlineLabel {
  text: string
  overdue: boolean
  /** Срок сегодня или уже прошёл — повод выделить карточку. */
  urgent: boolean
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

export function deadlineLabel(deadline: string | null, now: Date = new Date()): DeadlineLabel | null {
  if (!deadline) return null
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return null

  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
  if (days < 0) {
    const overdueDays = Math.abs(days)
    return { text: `просрочено на ${overdueDays} ${plural(overdueDays)}`, overdue: true, urgent: true }
  }
  if (days === 0) return { text: 'сегодня', overdue: false, urgent: true }
  if (days === 1) return { text: 'завтра', overdue: false, urgent: false }
  return { text: date.toLocaleDateString('ru-RU'), overdue: false, urgent: false }
}

function plural(days: number): string {
  const tail = days % 100
  if (tail >= 11 && tail <= 14) return 'дней'
  switch (days % 10) {
    case 1:
      return 'день'
    case 2:
    case 3:
    case 4:
      return 'дня'
    default:
      return 'дней'
  }
}

export function isOpen(task: ClientTask): boolean {
  return task.status !== 'done'
}

/** Ближайшая по сроку открытая задача — её показывает карточка на доске. */
export function nearestOpenTask(tasks: ClientTask[]): ClientTask | null {
  const open = tasks.filter(isOpen)
  if (open.length === 0) return null
  return open.reduce((closest, task) => {
    if (!task.deadline) return closest
    if (!closest.deadline) return task
    return new Date(task.deadline) < new Date(closest.deadline) ? task : closest
  })
}
