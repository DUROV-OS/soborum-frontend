import { SectionId } from '@/shared/sections'

export type FeedbackStatus = 'new' | 'in_progress' | 'done' | 'rejected'

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Сделано',
  rejected: 'Отклонена',
}

export type FeedbackAttachmentKind = 'screenshot' | 'log'

export interface FeedbackAttachment {
  id: number
  file_id: number
  filename: string
  content_type: string
  kind: FeedbackAttachmentKind
}

export interface FeedbackAuthor {
  id: number
  full_name: string
  email: string
}

export type FeedbackEventKind = 'status' | 'comment' | 'change'

/** Записи, которые администратор добавляет в ленту руками (0090). */
export type FeedbackNoteKind = Exclude<FeedbackEventKind, 'status'>

export const FEEDBACK_NOTE_LABEL: Record<FeedbackNoteKind, string> = {
  comment: 'Комментарий',
  change: 'Изменение в системе',
}

/** Цвет бейджа статуса — тон из `Chip`. */
export const FEEDBACK_STATUS_TONE: Record<FeedbackStatus, 'brand' | 'warning' | 'success' | 'neutral'> = {
  new: 'brand',
  in_progress: 'warning',
  done: 'success',
  rejected: 'neutral',
}

/** Запись ленты разбора заявки (0090): смена статуса, комментарий или изменение в системе. */
export interface FeedbackEvent {
  id: number
  kind: FeedbackEventKind
  /** `null` у смены статуса */
  text: string | null
  old_status: FeedbackStatus | null
  new_status: FeedbackStatus | null
  author: FeedbackAuthor
  created_at: string
}

export interface FeedbackRequest {
  id: number
  /** Слаг раздела фронта; для незнакомого значения показываем сам слаг. */
  section: SectionId | string
  text: string
  status: FeedbackStatus
  created_at: string
  updated_at: string
  author: FeedbackAuthor
  attachments: FeedbackAttachment[]
  /** Лента по возрастанию времени */
  events: FeedbackEvent[]
  /** Сколько записей ленты автор ещё не видел; не-автору всегда 0 */
  unseen_updates: number
}
