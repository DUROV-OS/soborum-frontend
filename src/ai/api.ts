import { apiRequest, streamRequest, StreamEvent } from '@/shared/lib/httpClient'
import {
  AgentActivityOut,
  AnalyticsSection,
  AskRequest,
  AskResponse,
  ConsultAskResponse,
  ChatDetailOut,
  ChatDomain,
  ChatMode,
  ChatOut,
  DailyPlanOut,
  FileAssetOut,
  GrowthProposalOut,
  GrowthProposalPrepareTaskOut,
  PendingActionOut,
  SectionAnalyticsOut,
  TaskPrioritiesOut,
} from './types'

const SECTION = 'ai'

function askPath(domain: ChatDomain): string {
  return domain === 'general' ? '/chat/ask' : `/${domain}/ask`
}

/** POST /api/ai/{domain}/ask (or /api/ai/chat/ask for domain "general") */
export function askDomain(domain: ChatDomain, request: AskRequest): Promise<AskResponse> {
  return apiRequest<AskResponse>({ section: SECTION, path: askPath(domain), method: 'POST', body: request })
}

/** POST /api/ai/{domain}/ask/stream — тот же ход, токены приходят по мере генерации (SSE). */
export function askDomainStream(
  domain: ChatDomain,
  request: AskRequest,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  return streamRequest({ section: SECTION, path: `${askPath(domain)}/stream`, body: request }, onEvent)
}

/** POST /api/ai/consult/ask/stream — стриминговый вариант консультации. */
export function askConsultStream(request: AskRequest, onEvent: (event: StreamEvent) => void): Promise<void> {
  return streamRequest({ section: SECTION, path: '/consult/ask/stream', body: request }, onEvent)
}

/** POST /api/ai/consult/ask — единый чат в «Агентах», без списка переписок */
export function askConsult(request: AskRequest): Promise<ConsultAskResponse> {
  return apiRequest<ConsultAskResponse>({
    section: SECTION,
    path: '/consult/ask',
    method: 'POST',
    body: request,
    timeoutMs: 180_000,
  })
}

/** DELETE /api/ai/consult — стереть серверную нить консультации */
export function clearConsult(chatId?: number | null): Promise<void> {
  return apiRequest<void>({
    section: SECTION,
    path: '/consult',
    method: 'DELETE',
    query: chatId ? { chat_id: chatId } : undefined,
  })
}

/** POST /api/ai/consult/pending-actions/:id/approve|reject */
export function resolveConsultAction(id: number, decision: 'approve' | 'reject'): Promise<AskResponse> {
  return apiRequest<AskResponse>({
    section: SECTION,
    path: `/consult/pending-actions/${id}/${decision}`,
    method: 'POST',
  })
}

/** POST /api/ai/files (multipart) — вложение для чата, id передаётся в AskRequest.file_ids */
export function uploadAttachment(file: File): Promise<FileAssetOut> {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<FileAssetOut>({ section: SECTION, path: '/files', method: 'POST', form })
}

/** GET /api/ai/{section}/analytics */
export function getSectionAnalytics(section: AnalyticsSection): Promise<SectionAnalyticsOut> {
  return apiRequest<SectionAnalyticsOut>({ section: SECTION, path: `/${section}/analytics` })
}

/** GET /api/ai/tasks/priorities */
export function getTaskPriorities(): Promise<TaskPrioritiesOut> {
  return apiRequest<TaskPrioritiesOut>({ section: SECTION, path: '/tasks/priorities' })
}

/** GET /api/ai/tasks/daily-plan */
export function getDailyPlan(reload?: boolean): Promise<DailyPlanOut> {
  return apiRequest<DailyPlanOut>({ section: SECTION, path: '/tasks/daily-plan', query: { reload } })
}

/** GET /api/ai/chats */
export function listChats(domain?: ChatDomain): Promise<ChatOut[]> {
  return apiRequest<ChatOut[]>({ section: SECTION, path: '/chats', query: { domain } })
}

/** GET /api/ai/chats/:id */
export function getChat(id: number): Promise<ChatDetailOut> {
  return apiRequest<ChatDetailOut>({ section: SECTION, path: `/chats/${id}` })
}

/** DELETE /api/ai/chats/:id */
export function deleteChat(id: number): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: `/chats/${id}`, method: 'DELETE' })
}

/** PATCH /api/ai/chats/:id/mode */
export function updateChatMode(id: number, mode: ChatMode): Promise<ChatOut> {
  return apiRequest<ChatOut>({ section: SECTION, path: `/chats/${id}/mode`, method: 'PATCH', body: { mode } })
}

/** PATCH /api/ai/chats/:id/title */
export function updateChatTitle(id: number, title: string | null): Promise<ChatOut> {
  return apiRequest<ChatOut>({ section: SECTION, path: `/chats/${id}/title`, method: 'PATCH', body: { title } })
}

/** GET /api/ai/pending-actions */
export function listPendingActions(chatId?: number): Promise<PendingActionOut[]> {
  return apiRequest<PendingActionOut[]>({ section: SECTION, path: '/pending-actions', query: { chat_id: chatId } })
}

/** POST /api/ai/pending-actions/:id/approve */
export function approvePendingAction(id: number): Promise<AskResponse> {
  return apiRequest<AskResponse>({ section: SECTION, path: `/pending-actions/${id}/approve`, method: 'POST' })
}

/** POST /api/ai/pending-actions/:id/reject */
export function rejectPendingAction(id: number): Promise<AskResponse> {
  return apiRequest<AskResponse>({ section: SECTION, path: `/pending-actions/${id}/reject`, method: 'POST' })
}

/** GET /api/ai/agent-actions — лог «Действия агента» (панель справа от чата) */
export function listAgentActivity(limit = 30): Promise<AgentActivityOut[]> {
  return apiRequest<AgentActivityOut[]>({ section: SECTION, path: '/agent-actions', query: { limit } })
}

/** GET /api/ai/growth-proposals — подраздел «Развитие».
 * reload=true запускает реальную генерацию через Claude (0050-a) и заменяет
 * открытые предложения новым набором; без reload — то что уже есть в базе. */
export function listGrowthProposals(reload = false): Promise<GrowthProposalOut[]> {
  return apiRequest<GrowthProposalOut[]>({ section: SECTION, path: '/growth-proposals', query: { reload } })
}

/** POST /api/ai/growth-proposals/:id/prepare-task — кнопка «Подготовить задачу» */
export function prepareGrowthProposalTask(id: number): Promise<GrowthProposalPrepareTaskOut> {
  return apiRequest<GrowthProposalPrepareTaskOut>({
    section: SECTION,
    path: `/growth-proposals/${id}/prepare-task`,
    method: 'POST',
  })
}
