import { Account } from '@/auth/types'
import { FileAsset } from '@/clients/types'

export type TaskStatus = 'not_ready' | 'ready' | 'in_progress' | 'in_review' | 'done'

export const TASK_STATES: { key: TaskStatus; label: string }[] = [
  { key: 'not_ready', label: 'Не готова к работе' },
  { key: 'ready', label: 'Готова к работе' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'in_review', label: 'На проверке' },
  { key: 'done', label: 'Выполнена' },
]

export type TaskPriority = 'low' | 'medium' | 'high'

export const TASK_PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: 'low', label: 'Низкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'high', label: 'Высокий' },
]

export type TaskLinkType =
  | 'none'
  | 'client_stage'
  | 'content_stage'
  | 'warehouse_request'
  | 'warehouse_shortage'
  | 'growth_proposal'

/** Кто оставил запись: сдача исполнителя или решение проверяющего (0077),
 * либо служебная запись о назначении проверяющего по политике (0084-f). */
export type TaskReportKind = 'submission' | 'review_accepted' | 'review_returned' | 'reviewer_assigned'

export const TASK_REPORT_KIND_LABEL: Record<TaskReportKind, string> = {
  submission: 'Отчёт исполнителя',
  review_accepted: 'Проверяющий принял',
  review_returned: 'Проверяющий вернул в работу',
  reviewer_assigned: 'Проверяющий назначен по политике',
}

/** Политика приёмки задачи (0084-f, backend app/tasks/policy.py). */
export type TaskReviewPolicy = 'review_required' | 'auto_close_allowed'

/** Запись журнала отчётов задачи (0077): комментарий + файлы. */
export interface TaskReport {
  id: number
  author: Account
  kind: TaskReportKind
  comment: string
  created_at: string
  /** Не null, если автор правил комментарий уже после отправки. */
  updated_at: string | null
  files: FileAsset[]
  /** Сколько прежних версий текста сохранено (0084-g). */
  revisions_count: number
  /** Хоть одна правка сделана, когда задачу уже приняли. */
  edited_after_acceptance: boolean
}

/** Прежняя версия текста записи журнала: каким был комментарий до правки (0084-g). */
export interface TaskReportRevision {
  id: number
  comment: string
  edited_by: Account | null
  edited_at: string
  after_acceptance: boolean
}

export interface Task {
  id: number
  title: string
  description: string | null
  deadline: string | null
  status: TaskStatus
  priority: TaskPriority
  created_at: string
  block_id: number | null
  link_type: TaskLinkType
  link_id: number | null
  link_meta: Record<string, unknown> | null
  assignees: Account[]
  reviewers: Account[]
  /** Один человек, отвечающий за задачу, когда исполнителей несколько —
   * отдельно от assignees/reviewers, не обязан быть среди исполнителей. */
  responsible: Account | null
  images: FileAsset[]
  /** Журнал отчётов — сдачи и решения проверяющего, от первого к последнему. */
  reports: TaskReport[]
  depends_on_ids: number[]
  /** review_required — задачу блока производства сдачей без проверяющего не
   * закрыть, и исполнитель не принимает свою сдачу. */
  review_policy: TaskReviewPolicy
  /** 'no_reviewer' — задача на проверке, но принять её некому. */
  review_blocked_reason: 'no_reviewer' | null
}
