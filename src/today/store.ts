import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as todayApi from './api'
import { AktualnoeResponse, TodayDashboard } from './types'

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось загрузить сводку'
}

interface TodayState {
  data: TodayDashboard | null
  loading: boolean
  error: string | null
  aktualnoe: AktualnoeResponse | null
  aktualnoeLoading: boolean
  load: (reload?: boolean) => Promise<void>
}

let requestSequence = 0
export const useTodayStore = create<TodayState>((set) => ({
  data: null,
  loading: true,
  error: null,
  aktualnoe: null,
  aktualnoeLoading: true,

  load: async (reload = false) => {
    const request = ++requestSequence
    set({ loading: true, error: null, data: null, aktualnoe: null, aktualnoeLoading: true })

    // Блок «Актуальное» грузится независимо: его сбой не должен ломать «Сегодня».
    todayApi
      .getAktualnoe(reload)
      .then((aktualnoe) => { if (request === requestSequence) set({ aktualnoe, aktualnoeLoading: false }) })
      .catch(() => { if (request === requestSequence) set({ aktualnoe: null, aktualnoeLoading: false }) })

    try {
      const data = await todayApi.getToday(reload)
      if (request === requestSequence) set({ data, loading: false })
    } catch (error) {
      if (request === requestSequence) set({ error: reasonOf(error), loading: false })
    }
  },
}))
