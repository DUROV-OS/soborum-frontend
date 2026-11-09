import { apiRequest, ApiError } from '@/shared/lib/httpClient'

export type CrmChatLink = { id: number; entity_id: number; max_chat_id: number; label: string; entity_kind: 'contact' | 'company' | 'deal' | 'inquiry'; entity_name: string }
export type CurrentCrmLink = CrmChatLink & { entity_version: number; automatic_lead: boolean }
export type CrmLinkInput = { max_chat_id: number; entity_id?: number; move_from_id?: number; move_from_version?: number; create?: { kind: 'contact' | 'company' | 'deal'; name: string; phone: string; email: string } }
export type PendingMaxLink = { name: string; phone: string; suggested: { id: number; name: string; kind: string } | null }
export const pendingMaxLink = (chatId: number) => apiRequest<PendingMaxLink | null>({ section: 'crm', path: `/chat-links/unlinked/${chatId}` })
export const currentCrmLink = (chatId: number) => apiRequest<CurrentCrmLink | null>({ section: 'crm', path: `/chat-links/by-chat/${chatId}` })
export const listCrmChatLinks = (entryId: number) => apiRequest<CrmChatLink[]>({ section: 'crm', path: `/entries/${entryId}/chat-links` })
export const linkCrmFromMax = (input: CrmLinkInput) => apiRequest<CrmChatLink>({ section: 'crm', path: '/chat-links/from-max', method: 'POST', body: input })
export const crmCardPath = (kind: string, id: number) => `/crm?tab=${['contact', 'company', 'deal', 'inquiry'].includes(kind) ? kind : 'contact'}&entry=${id}&channel=max`
export function chatLinkError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) return 'Этот чат уже связан с другой карточкой. Обновите список чатов и откройте текущую связь.'
  if (error instanceof ApiError && error.status === 403) return 'Недостаточно прав для изменения карточки.'
  if (error instanceof ApiError && error.status === 422) return 'Проверьте имя и данные карточки. Архивную карточку или «Избранное» привязать нельзя.'
  return 'Не удалось сохранить связь. Обновите список чатов перед повтором; введённые данные сохранены в форме.'
}
