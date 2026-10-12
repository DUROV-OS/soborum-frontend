import { create } from 'zustand'
import * as todayApi from './api'
import { AktualnoeResponse, MissedResponse, PeriodSummary, SummaryPeriod, TodayDashboard } from './types'
import { plainErrorText } from '@/shared/lib/humanError'

function reasonOf(error: unknown): string {
  return plainErrorText(error, 'Не удалось загрузить сводку')
}

interface TodayState {
  data: TodayDashboard | null
  loading: boolean
  error: string | null
  aktualnoe: AktualnoeResponse | null
  aktualnoeLoading: boolean
  missed: MissedResponse | null
  missedLoading: boolean
  /** Итоги за период, подгружаются при первом открытии вкладки (0027). */
  summaries: Partial<Record<SummaryPeriod, PeriodSummary>>
  summaryLoading: Partial<Record<SummaryPeriod, boolean>>
  summaryError: Partial<Record<SummaryPeriod, string>>
  load: (reload?: boolean) => Promise<void>
  loadSummary: (period: SummaryPeriod) => Promise<void>
  /** Убрать прочитанное уведомление из блока «Вы могли пропустить», не дожидаясь пересчёта. */
  dropMissed: (id: number) => void
}

export const useTodayStore = create<TodayState>((set) => ({
  data: null,
  loading: true,
  error: null,
  aktualnoe: null,
  aktualnoeLoading: true,
  missed: null,
  missedLoading: true,
  summaries: {},
  summaryLoading: {},
  summaryError: {},

  load: async (reload = false) => {
    set({ loading: true, error: null, data: null, aktualnoeLoading: true, missedLoading: true, summaries: {} })

    // Блок «Актуальное» грузится независимо: его сбой не должен ломать «Сегодня».
    todayApi
      .getAktualnoe(reload)
      .then((aktualnoe) => set({ aktualnoe, aktualnoeLoading: false }))
      .catch(() => set({ aktualnoe: null, aktualnoeLoading: false }))

    // «Вы могли пропустить» — тоже независимо: без него «Сегодня» работает как раньше.
    todayApi
      .getMissed(reload)
      .then((missed) => set({ missed, missedLoading: false }))
      .catch(() => set({ missed: null, missedLoading: false }))

    try {
      const data = await todayApi.getToday(reload)
      set({ data, loading: false })
    } catch (error) {
      set({ error: reasonOf(error), loading: false })
    }
  },

  loadSummary: async (period) => {
    set((state) => ({
      summaryLoading: { ...state.summaryLoading, [period]: true },
      summaryError: { ...state.summaryError, [period]: undefined },
    }))
    try {
      const summary = await todayApi.getPeriodSummary(period)
      set((state) => ({ summaries: { ...state.summaries, [period]: summary } }))
    } catch (error) {
      set((state) => ({ summaryError: { ...state.summaryError, [period]: reasonOf(error) } }))
    } finally {
      set((state) => ({ summaryLoading: { ...state.summaryLoading, [period]: false } }))
    }
  },

  dropMissed: (id) =>
    set((state) => (state.missed ? { missed: { ...state.missed, items: state.missed.items.filter((i) => i.id !== id) } } : {})),
}))
