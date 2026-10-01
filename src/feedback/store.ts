import { create } from 'zustand'
import { renderClientLog } from '@/shared/lib/clientLog'
import { useAuthStore } from '@/auth/store'
import * as feedbackApi from './api'
import { FeedbackRequest, FeedbackStatus } from './types'

interface FeedbackState {
  requests: FeedbackRequest[]
  loading: boolean
  load: () => Promise<void>
  submit: (input: { text: string; section: string; screenshots: File[] }) => Promise<FeedbackRequest>
  setStatus: (id: number, status: FeedbackStatus) => Promise<void>
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  requests: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ requests: await feedbackApi.listRequests() })
    } finally {
      set({ loading: false })
    }
  },

  /** Лог сессии собирается здесь же, в момент отправки (0075-b). */
  submit: async ({ text, section, screenshots }) => {
    const created = await feedbackApi.createRequest({
      text,
      section,
      screenshots,
      clientLog: renderClientLog(useAuthStore.getState().current),
    })
    set((state) => ({ requests: [created, ...state.requests] }))
    return created
  },

  setStatus: async (id, status) => {
    const updated = await feedbackApi.updateStatus(id, status)
    set((state) => ({ requests: state.requests.map((r) => (r.id === id ? updated : r)) }))
  },
}))
