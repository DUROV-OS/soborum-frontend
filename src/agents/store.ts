import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as agentsApi from './api'
import { AgentRun, AgentShift, AgentsStats } from './types'

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

interface AgentsState {
  stats: AgentsStats | null
  statsLoading: boolean
  statsError: string | null
  lastRun: AgentRun | null
  runLoading: boolean
  runError: string | null
  shift: AgentShift | null
  shiftLoading: boolean
  shiftError: string | null
  approvalError: string | null
  loadStats: () => Promise<void>
  loadShift: () => Promise<void>
  startShift: () => Promise<AgentShift | null>
  decideApproval: (id: number, status: 'approved' | 'rejected', subjectHash: string) => Promise<void>
  submit: (text: string) => Promise<AgentRun | null>
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  stats: null,
  statsLoading: false,
  statsError: null,
  lastRun: null,
  runLoading: false,
  runError: null,
  shift: null,
  shiftLoading: false,
  shiftError: null,
  approvalError: null,

  loadStats: async () => {
    set({ statsLoading: true, statsError: null })
    try {
      const stats = await agentsApi.getAgentStats()
      set({ stats, statsLoading: false })
    } catch (error) {
      set({ statsError: reasonOf(error), statsLoading: false })
    }
  },

  loadShift: async () => {
    const quiet = get().shift !== null
    if (!quiet) set({ shiftLoading: true, shiftError: null })
    try {
      const shift = await agentsApi.getLatestShift()
      set({ shift, shiftLoading: false, shiftError: null })
    } catch (error) {
      set({ shiftError: reasonOf(error), shiftLoading: false })
    }
  },

  startShift: async () => {
    set({ shiftLoading: true, shiftError: null })
    try {
      const shift = await agentsApi.createAgentShift()
      set({ shift, shiftLoading: false })
      if (get().stats !== null) void get().loadStats()
      return shift
    } catch (error) {
      set({ shiftError: reasonOf(error), shiftLoading: false })
      return null
    }
  },

  decideApproval: async (id, status, subjectHash) => {
    set({ approvalError: null })
    let updated
    try {
      updated = await agentsApi.decideApproval(id, status, subjectHash)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Пункт на сервере не тот, что видел человек (или решение уже есть) —
        // не решаем вслепую, перечитываем смену.
        set({ approvalError: 'Пункт изменился — смену перечитали, посмотрите ещё раз.' })
        await get().loadShift()
        return
      }
      set({ approvalError: reasonOf(error) })
      return
    }
    const shift = get().shift
    if (!shift) return
    set({
      shift: {
        ...shift,
        approvals: shift.approvals.map((item) => (item.id === updated.id ? updated : item)),
      },
    })
  },

  submit: async (text: string) => {
    set({ runLoading: true, runError: null })
    try {
      const lastRun = await agentsApi.createAgentRun(text)
      set({ lastRun, runLoading: false })
      if (get().stats !== null || get().statsError) {
        void get().loadStats()
      }
      return lastRun
    } catch (error) {
      set({ runError: reasonOf(error), runLoading: false })
      return null
    }
  },
}))
