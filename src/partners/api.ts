import { apiRequest } from '@/shared/lib/httpClient'
import { Partner, PartnerChatLink, PartnerInput, PartnerNote, ReferredClient } from './types'

const SECTION = 'partners'

/** GET /api/partners/ — весь список, новые сверху. Категорию, город и поиск
 * страница фильтрует сама: партнёров немного, а счётчики на вкладках
 * категорий должны считаться по всей базе, а не по отфильтрованному ответу. */
export function listPartners(): Promise<Partner[]> {
  return apiRequest<Partner[]>({ section: SECTION, path: '/' })
}

/** GET /api/partners/cities — города из базы без дублей по регистру. */
export function listCities(): Promise<string[]> {
  return apiRequest<string[]>({ section: SECTION, path: '/cities' })
}

export function getPartner(id: number): Promise<Partner> {
  return apiRequest<Partner>({ section: SECTION, path: `/${id}` })
}

/** GET /api/partners/:id/clients — клиенты, которых привёл партнёр (0083-c). */
export function listReferredClients(id: number): Promise<ReferredClient[]> {
  return apiRequest<ReferredClient[]>({ section: SECTION, path: `/${id}/clients` })
}

export function createPartner(input: PartnerInput): Promise<Partner> {
  return apiRequest<Partner>({ section: SECTION, path: '/', method: 'POST', body: input })
}

export function updatePartner(id: number, patch: Partial<PartnerInput>): Promise<Partner> {
  return apiRequest<Partner>({ section: SECTION, path: `/${id}`, method: 'PATCH', body: patch })
}

export function deletePartner(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}`, method: 'DELETE' })
}

export function addNote(id: number, text: string): Promise<PartnerNote> {
  return apiRequest<PartnerNote>({ section: SECTION, path: `/${id}/notes`, method: 'POST', body: { text } })
}

export function deleteNote(id: number, noteId: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}/notes/${noteId}`, method: 'DELETE' })
}

/** POST /api/partners/:id/chat-links — привязать чат MAX к партнёру (0105),
 * по образцу клиентской `createChatLink`. */
export function createChatLink(id: number, maxChatId: number, label: string): Promise<PartnerChatLink> {
  return apiRequest<PartnerChatLink>({
    section: SECTION,
    path: `/${id}/chat-links`,
    method: 'POST',
    body: { max_chat_id: maxChatId, label },
  })
}
