import { create } from 'zustand'
import * as montageApi from './api'
import { CycleForMontage, Installation } from './types'
import { plainErrorText } from '@/shared/lib/humanError'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface MontageState {
  cycles: CycleForMontage[]
  installation: Installation | null
  loading: boolean
  loadCycles: () => Promise<void>
  loadInstallation: (id: number) => Promise<void>
  start: (cycleId: number) => Promise<ActionResult>
  update: (id: number, patch: montageApi.InstallationUpdateInput) => Promise<ActionResult>
  advance: (id: number) => Promise<ActionResult>
  complete: (id: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return plainErrorText(error, 'Не удалось выполнить действие')
}

export const useMontageStore = create<MontageState>((set, get) => ({
  cycles: [],
  installation: null,
  loading: true,

  loadCycles: async () => {
    const cycles = await montageApi.listCyclesForMontage()
    set({ cycles, loading: false })
  },

  loadInstallation: async (id) => {
    const installation = await montageApi.getInstallation(id)
    set({ installation })
  },

  start: async (cycleId) => {
    try {
      await montageApi.startInstallation(cycleId)
      await get().loadCycles()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  update: async (id, patch) => {
    try {
      const installation = await montageApi.updateInstallation(id, patch)
      set({ installation })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  advance: async (id) => {
    try {
      const installation = await montageApi.advanceStage(id)
      set({ installation })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  complete: async (id) => {
    try {
      const installation = await montageApi.complete(id)
      set({ installation })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },
}))
