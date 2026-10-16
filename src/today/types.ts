import { NotificationKind } from '@/notifications/types'

export type WidgetTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

export interface DashboardWidget {
  section: string
  title: string
  value: string
  hint?: string | null
  tone: WidgetTone
  /** Куда ведёт клик, если не просто в раздел: счётчик задач открывает доску
   * с тем же набором (`/tasks?scope=…&status=open`, 0084-h). */
  href?: string | null
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
  /** Что автономный агент сам сделал в разделе за сутки (0112). */
  agent_note?: string | null
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

export type SummaryPeriod = 'day' | 'week'

export interface PeriodMetric {
  key: string
  label: string
  /** count — штуки, rub — рубли */
  unit: 'count' | 'rub'
  value: number
  /** то же за предыдущий период такой же длины */
  previous: number
  /** рост — плохой знак (просрочки, списания): цвет дельты наоборот */
  growth_is_bad: boolean
}

export interface PeriodSection {
  section: string
  title: string
  metrics: PeriodMetric[]
}

/** GET /api/dashboard/today/summary/{day|week} — «Итоги дня»/«Итоги недели» (0027). */
export interface PeriodSummary {
  period: SummaryPeriod
  label: string
  /** с чем сравниваем: «вчера» / «предыдущие 7 дней» */
  compare_label: string
  start: string
  end: string
  generated_at: string
  sections: PeriodSection[]
}

export interface MissedItem {
  id: number
  kind: NotificationKind
  title: string
  body?: string | null
  object_type?: string | null
  object_id?: number | null
  created_at: string
  /** до 8 слов от ИИ: почему это стоит открыть; пусто при отборе без ИИ */
  reason: string
}

/** GET /api/dashboard/missed — блок «Вы могли пропустить» (0027). */
export interface MissedResponse {
  generated_at: string
  items: MissedItem[]
  ai_configured: boolean
  /** true — отбор без ИИ (по приоритету повода и свежести) */
  degraded: boolean
}
