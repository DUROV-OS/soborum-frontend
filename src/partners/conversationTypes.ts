/** Переписка из карточки (0083-d). Зеркало `app/conversations/schemas.py`. */

export type ChannelKind = 'MAX' | 'TELEGRAM' | 'WHATSAPP'
export type ChannelState = 'NONE' | 'INVITED' | 'CONNECTED' | 'STOPPED'
export type ConversationOwner = 'clients' | 'partners'

export const CHANNEL_LABELS: Record<ChannelKind, string> = {
  MAX: 'Макс',
  TELEGRAM: 'Telegram',
  WHATSAPP: 'WhatsApp',
}

export const CHANNEL_ORDER: ChannelKind[] = ['MAX', 'TELEGRAM', 'WHATSAPP']

export interface ChannelStateInfo {
  channel: ChannelKind
  configured: boolean
  status: ChannelState
  invite_link: string | null
  connected_name: string | null
  connected_at: string | null
}

export interface ConversationMessage {
  id: number
  channel: ChannelKind
  direction: 'IN' | 'OUT'
  text: string
  attachments: unknown[]
  author_id: number | null
  author_name: string | null
  delivery: 'SENT' | 'FAILED'
  error: string | null
  sent_at: string | null
  created_at: string
}

export interface Conversation {
  channels: ChannelStateInfo[]
  messages: ConversationMessage[]
}

/** 409 «Пользователь не найден в Макс. Доступные каналы: …» — текст и список
 * каналов, на которые можно переключиться. */
export interface ChannelUnavailable {
  message: string
  available: ChannelKind[]
}
