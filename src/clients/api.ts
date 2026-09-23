import { apiRequest } from '@/shared/lib/httpClient'
import {
  Client,
  ClientChatLink,
  ClientChatState,
  ClientCreateInput,
  ClientNote,
  ClientSourceInput,
  ClientTask,
  ClientTaskInput,
  OrderType,
  PaymentPlan,
} from './types'

const SECTION = 'clients'

/** GET /api/clients/ — `search` ищет по фамилии/имени и телефону сразу по всем
 * стадиям (0079-f). */
export function listClients(search?: string): Promise<Client[]> {
  const path = search ? `/?search=${encodeURIComponent(search)}` : '/'
  return apiRequest<Client[]>({ section: SECTION, path })
}

/** GET /api/clients/:id */
export function getClient(id: number): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}` })
}

/** POST /api/clients/ */
export function createClient(input: ClientCreateInput): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: '/', method: 'POST', body: input })
}

/** PATCH /api/clients/:id/source — кто привёл клиента (0079-c). В отличие от
 * ФИО/телефона/почты источник правится и после создания карточки. */
export function updateSource(id: number, patch: ClientSourceInput): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/source`, method: 'PATCH', body: patch })
}

/** POST /api/clients/:id/tasks — завести задачу по клиенту (0079-d). */
export function createClientTask(id: number, input: ClientTaskInput): Promise<ClientTask> {
  return apiRequest<ClientTask>({ section: SECTION, path: `/${id}/tasks`, method: 'POST', body: input })
}

/** POST /api/clients/:id/tasks/:taskId/deadline — перенести срок с причиной. */
export function shiftClientTaskDeadline(
  id: number,
  taskId: number,
  deadline: string,
  reason: string,
): Promise<ClientTask> {
  return apiRequest<ClientTask>({
    section: SECTION,
    path: `/${id}/tasks/${taskId}/deadline`,
    method: 'POST',
    body: { deadline, reason },
  })
}

/** POST /api/clients/:id/tasks/:taskId/close — закрыть с решением и, по желанию,
 * сразу завести вытекающую задачу. */
export function closeClientTask(
  id: number,
  taskId: number,
  resolution: string,
  nextTask?: ClientTaskInput,
): Promise<ClientTask> {
  return apiRequest<ClientTask>({
    section: SECTION,
    path: `/${id}/tasks/${taskId}/close`,
    method: 'POST',
    body: { resolution, next_task: nextTask ?? null },
  })
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

/** POST /api/clients/:id/chat-links — привязать ещё один чат MAX к клиенту (0053). */
export function createChatLink(id: number, maxChatId: number, label: string): Promise<ClientChatLink> {
  return apiRequest<ClientChatLink>({
    section: SECTION,
    path: `/${id}/chat-links`,
    method: 'POST',
    body: { max_chat_id: maxChatId, label },
  })
}

export interface ChatLinkUpdateInput {
  label?: string
  state?: ClientChatState
}

/** PATCH /api/clients/:id/chat-links/:linkId */
export function updateChatLink(id: number, linkId: number, patch: ChatLinkUpdateInput): Promise<ClientChatLink> {
  return apiRequest<ClientChatLink>({
    section: SECTION,
    path: `/${id}/chat-links/${linkId}`,
    method: 'PATCH',
    body: patch,
  })
}

/** DELETE /api/clients/:id/chat-links/:linkId — отвязать один чат, остальные привязки клиента не затрагивает. */
export function deleteChatLink(id: number, linkId: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/${id}/chat-links/${linkId}`, method: 'DELETE' })
}

/** PATCH /api/clients/:id/payment */
export function updatePayment(id: number, is_paid: boolean): Promise<Client> {
  return apiRequest<Client>({ section: SECTION, path: `/${id}/payment`, method: 'PATCH', body: { is_paid } })
}

/** PATCH /api/clients/:id/payment-edit-unlock — только для роли admin. */
export function setPaymentEditUnlocked(id: number, unlocked: boolean): Promise<Client> {
  return apiRequest<Client>({
    section: SECTION,
    path: `/${id}/payment-edit-unlock`,
    method: 'PATCH',
    body: { unlocked },
  })
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

async function uploadFile(
  id: number,
  kind: 'house-project-file' | 'ar-file' | 'kr-file',
  file: File,
): Promise<Client> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<Client>({ section: SECTION, path: `/${id}/${kind}`, method: 'POST', form })
}

/** POST /api/clients/:id/contract-file — договор и приложение одним действием, нельзя раздельно (0061) */
export function uploadContractFiles(id: number, contract: File, appendix: File): Promise<Client> {
  const form = new FormData()
  form.append('contract', contract)
  form.append('appendix', appendix)
  return apiRequest<Client>({ section: SECTION, path: `/${id}/contract-file`, method: 'POST', form })
}

/** POST /api/clients/:id/house-project-file */
export function uploadHouseProjectFile(id: number, file: File): Promise<Client> {
  return uploadFile(id, 'house-project-file', file)
}

/** POST /api/clients/:id/ar-file */
export function uploadArFile(id: number, file: File): Promise<Client> {
  return uploadFile(id, 'ar-file', file)
}

/** POST /api/clients/:id/kr-file */
export function uploadKrFile(id: number, file: File): Promise<Client> {
  return uploadFile(id, 'kr-file', file)
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
