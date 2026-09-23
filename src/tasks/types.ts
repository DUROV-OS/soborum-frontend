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

export type TaskLinkType =
  | 'none'
  | 'client_stage'
  | 'content_stage'
  | 'warehouse_request'
  | 'warehouse_shortage'
  | 'growth_proposal'

/** Кто оставил запись: сдача исполнителя или решение проверяющего (0077). */
export type TaskReportKind = 'submission' | 'review_accepted' | 'review_returned'

export const TASK_REPORT_KIND_LABEL: Record<TaskReportKind, string> = {
  submission: 'Отчёт исполнителя',
  review_accepted: 'Проверяющий принял',
  review_returned: 'Проверяющий вернул в работу',
}

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
}

export interface Task {
  id: number
  title: string
  description: string | null
  deadline: string | null
  status: TaskStatus
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
}
