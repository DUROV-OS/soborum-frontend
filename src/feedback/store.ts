import { create } from 'zustand'
import { renderClientLog } from '@/shared/lib/clientLog'
import { useAuthStore } from '@/auth/store'
import * as feedbackApi from './api'
import { FeedbackNoteKind, FeedbackRequest, FeedbackStatus } from './types'

interface FeedbackState {
  /** Все заявки у админа (раздел «Заявки»), свои — у сотрудника */
  requests: FeedbackRequest[]
  /** Только свои заявки — раздел «Мои заявки» и счётчик в меню (0090) */
  mine: FeedbackRequest[]
  loading: boolean
  load: () => Promise<void>
  loadMine: () => Promise<void>
  submit: (input: { text: string; section: string; screenshots: File[] }) => Promise<FeedbackRequest>
  setStatus: (id: number, status: FeedbackStatus) => Promise<void>
  addEvent: (id: number, kind: FeedbackNoteKind, text: string) => Promise<void>
  markSeen: (id: number) => Promise<void>
}

/** Ответ сервера по одной заявке подменяет её в обоих списках. */
function replaceIn(list: FeedbackRequest[], updated: FeedbackRequest): FeedbackRequest[] {
  return list.map((r) => (r.id === updated.id ? updated : r))
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  requests: [],
  mine: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ requests: await feedbackApi.listRequests() })
    } finally {
      set({ loading: false })
    }
  },

  loadMine: async () => {
    set({ mine: await feedbackApi.listMyRequests() })
  },

  /** Лог сессии собирается здесь же, в момент отправки (0075-b). */
  submit: async ({ text, section, screenshots }) => {
    const created = await feedbackApi.createRequest({
      text,
      section,
      screenshots,
      clientLog: renderClientLog(useAuthStore.getState().current),
    })
    set((state) => ({ requests: [created, ...state.requests], mine: [created, ...state.mine] }))
    return created
  },

  setStatus: async (id, status) => {
    const updated = await feedbackApi.updateStatus(id, status)
    // Непрочитанное сервер считает для того, кто запрашивает; в «Моих
    // заявках» лежат только свои — там это и есть автор.
    set((state) => ({ requests: replaceIn(state.requests, updated), mine: replaceIn(state.mine, updated) }))
  },

  addEvent: async (id, kind, text) => {
    const updated = await feedbackApi.addEvent(id, kind, text)
    set((state) => ({ requests: replaceIn(state.requests, updated), mine: replaceIn(state.mine, updated) }))
  },

  markSeen: async (id) => {
    const updated = await feedbackApi.markSeen(id)
    set((state) => ({ requests: replaceIn(state.requests, updated), mine: replaceIn(state.mine, updated) }))
  },
}))
