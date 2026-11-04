import { apiRequest, ApiError } from '@/shared/lib/httpClient'

export type CrmChatLink = { id: number; entity_id: number; max_chat_id: number; label: string; entity_kind: 'contact' | 'company'; entity_name: string }
export type CrmLinkInput = { max_chat_id: number; entity_id?: number; create?: { kind: 'contact' | 'company'; name: string; phone: string; email: string } }
export const listCrmChatLinks = (entryId: number) => apiRequest<CrmChatLink[]>({ section: 'crm', path: `/entries/${entryId}/chat-links` })
export const linkCrmFromMax = (input: CrmLinkInput) => apiRequest<CrmChatLink>({ section: 'crm', path: '/chat-links/from-max', method: 'POST', body: input })
export const crmCardPath = (kind: string, id: number) => `/crm?tab=${kind === 'company' ? 'company' : 'contact'}&entry=${id}`
export function chatLinkError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) return 'Этот чат уже связан с другой карточкой. Обновите список чатов и откройте текущую связь.'
  if (error instanceof ApiError && error.status === 403) return 'Недостаточно прав для изменения карточки.'
  if (error instanceof ApiError && error.status === 422) return 'Проверьте имя и данные карточки. Архивную карточку или «Избранное» привязать нельзя.'
  return 'Не удалось сохранить связь. Обновите список чатов перед повтором; введённые данные сохранены в форме.'
}
