import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as agentsApi from './api'
import { AutonomyState } from './autonomyTypes'

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

interface AutonomyStore {
  state: AutonomyState | null
  loading: boolean
  running: boolean
  error: string | null
  load: () => Promise<void>
  run: () => Promise<void>
  resolveWatch: (id: number) => Promise<void>
  closeProposals: () => Promise<void>
}

export const useAutonomyStore = create<AutonomyStore>((set) => ({
  state: null,
  loading: false,
  running: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      set({ state: await agentsApi.getAutonomyState(), loading: false })
    } catch (error) {
      set({ error: reasonOf(error), loading: false })
    }
  },

  run: async () => {
    set({ running: true, error: null })
    try {
      await agentsApi.runAutonomy()
      set({ state: await agentsApi.getAutonomyState(), running: false })
    } catch (error) {
      set({ error: reasonOf(error), running: false })
    }
  },

  resolveWatch: async (id) => {
    try {
      await agentsApi.resolveAutonomyWatch(id)
      set({ state: await agentsApi.getAutonomyState() })
    } catch (error) {
      set({ error: reasonOf(error) })
    }
  },

  closeProposals: async () => {
    try {
      await agentsApi.closeAutonomyProposals()
      set({ state: await agentsApi.getAutonomyState() })
    } catch (error) {
      set({ error: reasonOf(error) })
    }
  },
}))
