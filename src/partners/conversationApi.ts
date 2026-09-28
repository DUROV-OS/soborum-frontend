import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import {
  ChannelKind,
  ChannelStateInfo,
  ChannelUnavailable,
  Conversation,
  ConversationMessage,
  ConversationOwner,
} from './conversationTypes'

const SECTION = 'conversations'

/** GET /api/conversations/:owner/:id — каналы и лента всех каналов по времени. */
export function getConversation(owner: ConversationOwner, id: number): Promise<Conversation> {
  return apiRequest<Conversation>({ section: SECTION, path: `/${owner}/${id}` })
}

/** POST …/invite — ссылка на бота с меткой карточки (повторно — та же). */
export function createInvite(owner: ConversationOwner, id: number, channel: ChannelKind): Promise<ChannelStateInfo> {
  return apiRequest<ChannelStateInfo>({ section: SECTION, path: `/${owner}/${id}/invite`, method: 'POST', body: { channel } })
}

export type SendResult =
  | { ok: true; message: ConversationMessage }
  | { ok: false; unavailable: ChannelUnavailable }
  | { ok: false; reason: string }

/** POST …/messages. 409 `channel_unavailable` — не ошибка, а подсказка
 * переключиться на другой канал: разбираем отдельно. */
export async function sendMessage(
  owner: ConversationOwner,
  id: number,
  channel: ChannelKind,
  text: string,
): Promise<SendResult> {
  try {
    const message = await apiRequest<ConversationMessage>({
      section: SECTION,
      path: `/${owner}/${id}/messages`,
      method: 'POST',
      body: { channel, text },
    })
    return { ok: true, message }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.body?.code === 'channel_unavailable') {
      const available = Array.isArray(error.body.available) ? (error.body.available as ChannelKind[]) : []
      return { ok: false, unavailable: { message: error.message, available } }
    }
    return { ok: false, reason: error instanceof Error ? error.message : 'Не удалось отправить сообщение' }
  }
}
