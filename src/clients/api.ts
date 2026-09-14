import { apiRequest } from '@/shared/lib/httpClient'
import { Client, ClientChatState, ClientCreateInput, ClientNote, OrderType, PaymentPlan } from './types'

const SECTION = 'clients'

/** GET /api/clients/ */
export function listClients(): Promise<Client[]> {
  return apiRequest<Client[]>({ section: SECTION, path: '/' })
}

/** GET /api/clients/:id */
export function getClient(id: number): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}` })
}

/** POST /api/clients/ */
export function createClient(input: ClientCreateInput): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: '/', method: 'POST', body: input })
}

export interface DocumentsUpdateInput {
  order_type?: OrderType
  /** `null` снимает привязку к модели каталога. */
  house_model_key?: string | null
  final_price?: number
  installation_address?: string
  payment_plan?: PaymentPlan
  /** Обязателен для payment_plan === 'advance_then_balance', меньше final_price. */
  advance_amount?: number
}

/** PATCH /api/clients/:id/documents */
export function updateDocuments(id: number, patch: DocumentsUpdateInput): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/documents`, method: 'PATCH', body: patch })
}

export interface HousesCountUpdateInput {
  houses_count: number
}

/** PATCH /api/clients/:id/houses-count — не блокируется documents_locked_at, редактируется в любой момент. */
export function updateHousesCount(id: number, patch: HousesCountUpdateInput): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/houses-count`, method: 'PATCH', body: patch })
}

/** PATCH /api/clients/:id/max-chat — привязать/отвязать чат MAX (`null` отвязывает). */
export function setMaxChat(id: number, maxChatId: number | null): Promise<Client> {
  return apiRequest<Client>({
    section: SECTION,
    path: `/${id}/max-chat`,
    method: 'PATCH',
    body: { max_chat_id: maxChatId },
  })
}

/** PATCH /api/clients/:id/chat-state — только для клиента с уже привязанным чатом. */
export function setChatState(id: number, state: ClientChatState): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/chat-state`, method: 'PATCH', body: { state } })
}

/** PATCH /api/clients/:id/payment */
export function updatePayment(id: number, is_paid: boolean): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/payment`, method: 'PATCH', body: { is_paid } })
}

/** PATCH /api/clients/:id/balance-payment — приём остатка после получения дома. */
export function markBalancePayment(id: number): Promise<Client> {
  return apiRequest<Client>({
    section: SECTION,
    path: `/${id}/balance-payment`,
    method: 'PATCH',
    body: { balance_paid: true },
  })
}

async function uploadFile(id: number, kind: 'contract-file' | 'house-project-file', file: File): Promise<Client> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<Client>({ section: SECTION, path: `/${id}/${kind}`, method: 'POST', form })
}

/** POST /api/clients/:id/contract-file */
export function uploadContractFile(id: number, file: File): Promise<Client> {
  return uploadFile(id, 'contract-file', file)
}

/** POST /api/clients/:id/house-project-file */
export function uploadHouseProjectFile(id: number, file: File): Promise<Client> {
  return uploadFile(id, 'house-project-file', file)
}

/** POST /api/clients/:id/notes */
export function addNote(id: number, text: string): Promise<ClientNote> {
  return apiRequest<ClientNote>({ section: SECTION, path: `/${id}/notes`, method: 'POST', body: { text } })
}

/** PATCH /api/clients/:id/notes/:noteId */
export function updateNote(id: number, noteId: number, text: string): Promise<ClientNote> {
  return apiRequest<ClientNote>({
    section: SECTION,
    path: `/${id}/notes/${noteId}`,
    method: 'PATCH',
    body: { text },
  })
}

/** DELETE /api/clients/:id/notes/:noteId */
export function deleteNote(id: number, noteId: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}/notes/${noteId}`, method: 'DELETE' })
}

/** DELETE /api/clients/:id — только администратор */
export function deleteClient(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}`, method: 'DELETE' })
}

/** POST /api/clients/:id/transition */
export function advanceStage(id: number): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/transition`, method: 'POST' })
}
