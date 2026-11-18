export type MeetingStatus = 'recording' | 'finished'

export interface MeetingOut {
  id: number
  title: string | null
  status: MeetingStatus
  started_at: string
  finished_at: string | null
  duration_sec: number | null
  has_audio: boolean
  /** Тема, цели и обстоятельства встречи (заполняет человек) */
  topic: string | null
  goals: string | null
  location: string | null
  participants: string | null
  occurred_at: string | null
}

export interface MeetingUpdatePatch {
  title?: string | null
  topic?: string | null
  goals?: string | null
  location?: string | null
  participants?: string | null
  occurred_at?: string | null
}

export interface TranscriptLineOut {
  id: number
  speaker: string
  text: string
  at_ms: number
  is_assistant_query: boolean
}

export interface MeetingNotesOut {
  summary: string
  decisions: string[]
  tasks: string[]
  questions: string[]
  source_line_count: number
  updated_at: string
  /** true — последний вызов модели не удался, показана прошлая версия */
  stale: boolean
}

export interface MeetingDetailOut extends MeetingOut {
  audio_url: string | null
  transcript: TranscriptLineOut[]
  notes: MeetingNotesOut | null
  ai_enabled: boolean
  processing: MeetingProcessing | null
}

export interface MeetingAction {
  id: string
  title: string
  expected_result: string
  assignee_id: number | null
  reviewer_id: number | null
  deadline: string | null
  duration_minutes: number | null
  scheduled_start: string | null
  source_line_ids: number[]
  quote: string
  clarification: string
  selected: boolean
  task_id?: number
  event_id?: number
}
export interface MeetingProcessing {
  status: 'queued' | 'transcribing' | 'analyzing' | 'ready' | 'error'
  error: string
  version: number
  actions?: MeetingAction[]
  recommendations?: string[]
  attempts: number
}
