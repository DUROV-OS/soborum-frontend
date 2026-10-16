import { apiRequest } from '@/shared/lib/httpClient'
import { AktualnoeResponse, MissedResponse, PeriodSummary, SectionSignal, SummaryPeriod, TodayDashboard } from './types'

/** GET /api/dashboard/today */
export function getToday(reload = false): Promise<TodayDashboard> {
  return apiRequest<TodayDashboard>({ section: 'dashboard', path: '/today', query: { reload } })
}

/** GET /api/dashboard/today/section/:section — один раздел, кэш на 6 часов на бэке. */
export function getSectionSignal(section: string, reload = false): Promise<SectionSignal> {
  return apiRequest<SectionSignal>({
    section: 'dashboard',
    path: `/today/section/${section}`,
    query: { reload },
  })
}

/** GET /api/dashboard/aktualnoe — блок «Актуальное», кеш на 12 часов */
export function getAktualnoe(reload = false): Promise<AktualnoeResponse> {
  return apiRequest<AktualnoeResponse>({ section: 'dashboard', path: '/aktualnoe', query: { reload } })
}

/** GET /api/dashboard/today/summary/{period} — итоги за день или неделю по доступным разделам */
export function getPeriodSummary(period: SummaryPeriod): Promise<PeriodSummary> {
  return apiRequest<PeriodSummary>({ section: 'dashboard', path: `/today/summary/${period}` })
}

/** GET /api/dashboard/missed — «Вы могли пропустить»: важные непрочитанные уведомления, кеш на 6 часов */
export function getMissed(reload = false): Promise<MissedResponse> {
  return apiRequest<MissedResponse>({ section: 'dashboard', path: '/missed', query: { reload } })
}
