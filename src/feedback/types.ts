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
}
