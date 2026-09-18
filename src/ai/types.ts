import { SectionId } from '@/shared/sections'
import { Task } from '@/tasks/types'

export type ChatDomain = 'clients' | 'production' | 'cycle' | 'warehouse' | 'marketing' | 'tasks' | 'general'

export type ChatMode = 'no_actions' | 'require_approval' | 'auto_approve'

export type PendingActionStatus = 'pending' | 'approved' | 'rejected'

export interface AskRequest {
  chat_id?: number | null
  message: string
  file_ids?: number[]
  mode?: ChatMode
  /** Что обсуждается (например «[client_id=6, Иванов И.]») — отдельно от `message`,
   * чтобы никогда не попасть в видимый текст сообщения (регрессия 0017). */
  context_note?: string
}

/** Файл, прикреплённый к сообщению чата — см. POST /api/ai/files. */
export interface FileAssetOut {
  id: number
  filename: string
  content_type: string
  purpose: string
  uploaded_by_id: number
  created_at: string
}

export interface PendingActionOut {
  id: number
  chat_id: number
  message_id: number
  tool_name: string
  tool_input: Record<string, unknown>
  status: PendingActionStatus
  decided_by_id: number | null
  decided_at: string | null
  created_at: string
  summary?: string
  execution_status?: 'pending' | 'succeeded' | 'failed' | 'rejected' | 'unknown'
  policy_version?: string | null
}

export interface AskResponse {
  chat_id: number
  status: 'completed' | 'pending_approval'
  reply: string | null
  pending_actions: PendingActionOut[]
}

export interface ConsultAskResponse extends AskResponse {
  topic_reset: boolean
}

export interface ChatOut {
  id: number
  domain: ChatDomain
  mode: ChatMode
  title: string | null
  created_at: string
}

export interface MessageContentBlock {
  type?: string
  text?: string
  name?: string
  input?: Record<string, unknown>
  id?: string
  /** Только для type === "file_ref" — файл, прикреплённый к сообщению. */
  file_id?: number
  filename?: string
  content_type?: string
  [key: string]: unknown
}

export interface MessageOut {
  id: number
  role: string
  content: MessageContentBlock[]
  tool_resolutions: Record<string, unknown> | null
  created_at: string
}

export interface ChatDetailOut extends ChatOut {
  messages: MessageOut[]
}

/** GET /api/ai/agent-actions — панель «Действия агента» справа от чата. Общий
 * лог, не привязан к открытому чату; сейчас наполняется только демо-сидом на
 * localhost (0033), реальные события пока не пишутся. */
export interface AgentActivityOut {
  id: number
  title: string
  detail: string
  /** true — агент сделал сам, без подтверждения; false — решение уже
   * потребовало или потребует подтверждения человеком (деньги, внешняя
   * коммуникация, необратимое действие). */
  autonomous: boolean
  related_section: string | null
  related_path: string | null
  related_label: string | null
  created_at: string
}

/** Разделы, у которых есть свой домен ИИ на бэкенде — у «Монтажа» такого домена нет. */
export const DOMAIN_TO_SECTION: Record<Exclude<ChatDomain, 'general'>, SectionId> = {
  clients: 'clients',
  production: 'production',
  cycle: 'cycle',
  warehouse: 'warehouse',
  marketing: 'marketing',
  tasks: 'tasks',
}

export const DOMAIN_LABEL: Record<ChatDomain, string> = {
  general: 'Общий',
  clients: 'Клиенты',
  production: 'Производство',
  cycle: 'Цикл клиента',
  warehouse: 'Склад',
  marketing: 'Маркетинг',
  tasks: 'Задачи',
}

export const MODE_LABEL: Record<ChatMode, string> = {
  no_actions: 'Анализ · A0',
  require_approval: 'С подтверждением · A2',
  auto_approve: 'С подтверждением · A2',
}

/** Разделы, для которых бэкенд отдаёт GET /api/ai/{section}/analytics — включает «Монтаж», в отличие от ChatDomain. */
export type AnalyticsSection =
  | 'clients'
  | 'production'
  | 'installation'
  | 'cycle'
  | 'warehouse'
  | 'marketing'
  | 'tasks'

export type SectionAnalyticsStatus = 'red' | 'yellow' | 'green'

export interface SectionAnalyticsOut {
  section: string
  generated_at: string
  summary: string
  status: SectionAnalyticsStatus
}

/** GET /api/ai/tasks/priorities — 2-3 открытые задачи сотрудника, к которым ИИ советует присмотреться в первую очередь. */
export interface PriorityTaskOut {
  task: Task
  reason: string
}

export interface TaskPrioritiesOut {
  generated_at: string
  priorities: PriorityTaskOut[]
}

/** GET /api/ai/tasks/daily-plan — связный план задач на сегодня (сторипоинты
 * и загруженность других сотрудников участвуют только во внутреннем расчёте
 * на бэке, наружу не отдаются — см. 0070-d/0070-e). */
export interface DailyPlanItemOut {
  task: Task
  reason: string
}

export interface DailyPlanOut {
  generated_at: string
  plan: DailyPlanItemOut[]
}

export type GrowthProposalStatus = 'open' | 'task_created'

/** GET /api/ai/growth-proposals — подраздел «Развитие» в «Марине» (0036-a).
 * Общий (не по владельцу) список, сейчас наполняется только демо-сидом на
 * localhost — реальная генерация предложений Мариной вне скоупа 0036. */
export interface GrowthProposalOut {
  id: number
  title: string
  problem: string
  checkable_result: string
  executor_and_estimate: string
  expected_effect: string
  status: GrowthProposalStatus
  task_id: number | null
  created_at: string
}

/** POST /api/ai/growth-proposals/:id/prepare-task */
export interface GrowthProposalPrepareTaskOut {
  proposal: GrowthProposalOut
  task: Task
}
