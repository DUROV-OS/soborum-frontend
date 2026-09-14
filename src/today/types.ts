export type WidgetTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

export interface DashboardWidget {
  section: string
  title: string
  value: string
  hint?: string | null
  tone: WidgetTone
}

export interface DashboardAction {
  id: string
  section: string
  title: string
  description: string
  href: string
  count: number
  tone: WidgetTone
}

export interface TodayDashboard {
  generated_at: string
  summary: string
  widgets: DashboardWidget[]
  actions?: DashboardAction[]
  source?: 'database'
  ai_configured?: boolean
}

/** GET /api/dashboard/today/section/{section} — один раздел «Работы» отдельным
 * кэшируемым (6ч) запросом, вместо общего /today на всю страницу.
 *
 * `checked` — по разделу вообще есть проверка сигнала внимания на бэке: true,
 * если `action === null` значит «проверили, проблем нет»; false — раздел не
 * входит в проверяемые (или нет доступа), `action === null` там ничего не
 * говорит о состоянии раздела, только «не проверяли». */
export interface SectionSignal {
  section: string
  action: DashboardAction | null
  checked: boolean
  /** Текст «что именно проверили и что там чисто» — есть только когда
   * checked=true и action=null. */
  clear_text: string | null
  generated_at: string
}

export interface AktualnoeItem {
  cycle_id: number
  client_name: string
  /** короткое (2–3 слова) название текущей стадии клиента */
  stage: string
  /** 0–100: насколько выполнена текущая стадия (ставит ИИ) */
  percent: number
  /** фраза из 2–3 слов о том, что сейчас происходит */
  phrase: string
}

export interface AktualnoeResponse {
  generated_at: string
  items: AktualnoeItem[]
  ai_configured: boolean
  /** true — подборка собрана без ИИ (топ по свежести, проценты по стадии) */
  degraded: boolean
}
