import { Forward, Pencil } from 'lucide-react'
import { ApiError } from '@/shared/lib/httpClient'
import { forwardMessage, isEditable } from '../api'
import { MaxChatSummary, MaxMessage } from '../types'
import { ChatPickerModal } from './ChatPickerModal'

/**
 * «Переслать» / «Изменить» под сообщением (0098). На широком экране
 * появляются при наведении на сообщение (родитель — `group`), на телефоне
 * видны всегда. «Изменить» — только у сообщений, которые бэк разрешит
 * править (см. `isEditable`).
 */
export function MaxMessageActions({
  message,
  onForward,
  onEdit,
}: {
  message: MaxMessage
  onForward: (message: MaxMessage) => void
  onEdit: (message: MaxMessage) => void
}) {
  if (message.isSystem) return null
  const btn =
    'inline-flex items-center gap-1 rounded-sm px-1 text-[11px] text-muted hover:text-brand-dark'
  return (
    <span className="inline-flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
      <button type="button" onClick={() => onForward(message)} className={btn}>
        <Forward size={12} />
        Переслать
      </button>
      {isEditable(message) && (
        <button type="button" onClick={() => onEdit(message)} className={btn}>
          <Pencil size={12} />
          Изменить
        </button>
      )}
    </span>
  )
}

/** Выбор чата и подтверждение пересылки сообщения `message` из `fromChatId`. */
export function ForwardMessageModal({
  fromChatId,
  message,
  onClose,
  onForwarded,
}: {
  fromChatId: number
  message: MaxMessage | null
  onClose: () => void
  onForwarded: (toChat: MaxChatSummary) => void
}) {
  async function forward(chat: MaxChatSummary) {
    if (!message) return { ok: false }
    try {
      await forwardMessage(fromChatId, message.id, chat.id)
      onForwarded(chat)
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof ApiError ? err.message : 'Не удалось переслать сообщение' }
    }
  }

  return (
    <ChatPickerModal
      open={message !== null}
      onClose={onClose}
      onPick={forward}
      title="Переслать сообщение"
      confirm={{
        question: (chat) => `Переслать сообщение в «${chat.title ?? `Чат ${chat.id}`}»?`,
        action: 'Переслать',
        busy: 'Пересылка…',
        failed: 'Не удалось переслать сообщение',
      }}
    />
  )
}
