export interface AutoRun {
  id: number
  started_at: string
  finished_at: string | null
  trigger: string
  sections: string[]
  deviations: AutoDeviation[]
  actions: AutoAction[]
  summary: string
  error: string | null
}

export interface AutoDeviation {
  section: string
  scenario: string
  key: string
  text: string
}

export interface AutoAction {
  scenario: string
  key: string
  level: 'A' | 'B'
  result: string
  text: string
  task_id?: number | null
}

export interface AgentPriority {
  section: string
  weight: number
  signal_streak: number
  quiet_streak: number
}

export interface AgentWatch {
  id: number
  key: string
  section: string
  scenario: string
  text: string
  status: 'open' | 'escalated' | 'resolved'
  seen_count: number
  escalate_after: string | null
  created_at: string
  last_seen_at: string
}

export interface ActionCounter {
  scenario: string
  repeats: number
  last_action_at: string | null
  last_reaction_at: string | null
}

export interface AutonomyState {
  runs: AutoRun[]
  priorities: AgentPriority[]
  watchlist: AgentWatch[]
  counters: ActionCounter[]
  pending_proposals: number
  next_run_hint: string
}
