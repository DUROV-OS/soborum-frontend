export type AgentId =
  | 'coordinator'
  | 'sales'
  | 'marketer'
  | 'production'
  | 'warehouse'
  | 'finance'
  | 'lawyer'
  | 'engineer'

export type AgentTone = 'brand' | 'danger' | 'timber' | 'info'

export interface AgentPassport {
  id: AgentId
  title: string
  role: string
  owns: string
  doesNotOwn: string
  dailyQuestion: string
  tone: AgentTone
}

export interface PlanItem {
  id: string
  title: string
  detail: string
  done: boolean
}

export interface DayPoint {
  date: string
  runs: number
  blocked: number
  escalated: number
  released: number
}

export interface RouteShare {
  id: AgentId
  title: string
  count: number
}

export interface GoldProgress {
  id: AgentId
  title: string
  gold: number
  target: number
}

export type LegalVerdict = 'allow' | 'allow_with_conditions' | 'block' | 'escalate_human'

export interface TraceRow {
  id: number | string
  trace_id?: string
  text: string
  agents: string[]
  legal: LegalVerdict
  released: boolean
  created_at?: string
}

export interface AgentRun {
  id: number
  trace_id: string
  text: string
  reply: string
  legal_verdict: LegalVerdict
  legal_rules: string[]
  legal_passport: string
  released: boolean
  specialists: string[]
  specialist_titles: string[]
  created_at: string
}

export interface LegalMix {
  allow: number
  allow_with_conditions: number
  escalate_human: number
  block: number
}

export interface AgentsTotals {
  runs: number
  blocked: number
  escalated: number
  released: number
}

export interface AgentsStats {
  week: DayPoint[]
  legal: LegalMix
  routing: RouteShare[]
  traces: TraceRow[]
  totals: AgentsTotals
  shifts?: number
  pending_approvals?: number
}

// Статус кросс-проверки (0084-e). null/нет поля — запись смены до 0084-e:
// показываем «Не проверено», а не благополучный текст.
export type ShiftReviewStatus = 'checked_ok' | 'checked_escalate' | 'not_checked'

export interface ShiftReview {
  reviewer: string
  reviewer_title: string
  text: string
  escalate: boolean
  kind: string
  status?: ShiftReviewStatus | null
}

// Откуда позиция роли: живой срез базы, Claude без фактов из системы или ничего.
export type ShiftStanceSource = 'live' | 'llm_without_facts' | 'none'

export interface ShiftItem {
  id: number
  agent_id: AgentId
  agent_title: string
  daily_question: string
  stance: string
  citations: string[]
  legal_verdict: LegalVerdict
  has_live_data?: boolean
  stance_source?: ShiftStanceSource | null
  reviews: ShiftReview[]
}

export interface ShiftApproval {
  id: number
  shift_id: number
  item_id?: number | null
  kind: string
  title: string
  detail: string
  // approved = согласовано, но не исполнено: исполнителя согласований в P0 нет.
  status: 'pending' | 'approved' | 'rejected'
  // Хэш снимка пункта, который видит человек; решение без него сервер не примет (409).
  subject_hash?: string | null
  subject_snapshot?: Record<string, unknown> | null
  created_at: string
}

export interface ChartBar {
  label: string
  value: number
}

export interface ShiftChart {
  id: string
  title: string
  unit: string
  bars: ChartBar[]
  agents?: AgentId[]
  lead?: string
  tone?: 'brand' | 'danger' | 'warning' | 'timber'
}

export interface AgentShift {
  id: number
  verdict: LegalVerdict
  summary: string
  claude_used: boolean
  created_at: string
  items: ShiftItem[]
  approvals: ShiftApproval[]
  charts?: ShiftChart[]
  autorun?: boolean
  interval_seconds?: number
  next_tick_at?: string | null
}
