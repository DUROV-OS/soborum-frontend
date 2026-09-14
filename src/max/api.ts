import { API_BASE, apiRequest, ApiError, getToken } from '@/shared/lib/httpClient'
import { MaxChatHistory, MaxChatList, MaxMediaUrl, MaxSendResult } from './types'

const SECTION = 'max'

/**
 * GET /api/max/chats — все чаты организации с последним сообщением в каждом,
 * самые свежие сверху. `limit` — сколько первых вернуть (по умолчанию все).
 */
export function listChats(limit?: number): Promise<MaxChatList> {
  return apiRequest<MaxChatList>({ section: SECTION, path: '/chats', query: { limit } })
}

export interface GetChatParams {
  /** Сколько последних сообщений вернуть (по умолчанию 50). */
  limit?: number
  /** Сколько дополнительно подгрузить назад от самого старого. */
  backward?: number
}

/** GET /api/max/chats/:chatId */
export function getChat(chatId: number, params: GetChatParams = {}): Promise<MaxChatHistory> {
  return apiRequest<MaxChatHistory>({
    section: SECTION,
    path: `/chats/${chatId}`,
    query: { limit: params.limit, backward: params.backward },
  })
}

/** POST /api/max/messages */
export function sendMessage(chatId: number, text: string, notify = true): Promise<MaxSendResult> {
  return apiRequest<MaxSendResult>({
    section: SECTION,
    path: '/messages',
    method: 'POST',
    body: { chat_id: chatId, text, notify },
  })
}

/**
 * GET /api/max/attachment — одноразовая ссылка на скачивание вложения типа
 * FILE. Домен `fd.oneme.ru`, без CORS: годится только для навигации
 * (`window.open` / `<a download>`), не для `fetch`.
 */
export async function getAttachmentUrl(
  chatId: number,
  messageId: string,
  fileId: string,
): Promise<string> {
  const res = await apiRequest<{ url: string }>({
    section: SECTION,
    path: '/attachment',
    query: { chat_id: chatId, message_id: messageId, file_id: fileId },
  })
  return res.url
}

/**
 * GET /api/max/attachment/preview — файл вложения FILE с корректным
 * content-type и CORS (в отличие от getAttachmentUrl — прокси через наш
 * бэк, поэтому годится для `fetch`). Требует Authorization-заголовок, его не
 * подставить в `<img src>`/`<embed src>` напрямую — поэтому возвращаем Blob,
 * а не URL; вызывающий код сам делает `URL.createObjectURL`.
 */
export async function getAttachmentPreviewBlob(
  chatId: number,
  messageId: string,
  fileId: string,
  filename: string,
): Promise<Blob> {
  const url = new URL(`${API_BASE}/${SECTION}/attachment/preview`, window.location.origin)
  url.searchParams.set('chat_id', String(chatId))
  url.searchParams.set('message_id', messageId)
  url.searchParams.set('file_id', fileId)
  url.searchParams.set('filename', filename)
  const token = getToken()
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* тело не JSON — оставляем statusText */
    }
    throw new ApiError(res.status, detail)
  }
  return res.blob()
}

/**
 * GET /api/max/media — воспроизводимая ссылка на вложение VIDEO или AUDIO
 * (голосовое). `mediaId` — `videoId` либо `audioId` из attach.
 */
export function getMediaUrl(
  chatId: number,
  messageId: string,
  mediaId: string,
): Promise<MaxMediaUrl> {
  return apiRequest<MaxMediaUrl>({
    section: SECTION,
    path: '/media',
    query: { chat_id: chatId, message_id: messageId, media_id: mediaId },
  })
}
