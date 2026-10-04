import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as partnersApi from './api'
import { Partner, PartnerInput } from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface PartnersState {
  partners: Partner[]
  cities: string[]
  loading: boolean
  error: string | null
  load: () => Promise<void>
  create: (input: PartnerInput) => Promise<Partner>
  update: (id: number, patch: Partial<PartnerInput>) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  addNote: (id: number, text: string) => Promise<ActionResult>
  deleteNote: (id: number, noteId: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export const usePartnersStore = create<PartnersState>((set, get) => {
  function replace(partner: Partner) {
    set({ partners: get().partners.map((p) => (p.id === partner.id ? partner : p)) })
  }

  // Город могли добавить или переименовать — список для фильтра перечитываем
  // после любой правки партнёра, а не собираем на фронте.
  async function refreshCities() {
    try {
      set({ cities: await partnersApi.listCities() })
    } catch {
      // Фильтр по городу — удобство; если не загрузился, список всё равно рабочий.
    }
  }

  return {
    partners: [],
    cities: [],
    loading: true,
    error: null,

    load: async () => {
      set({ loading: true, error: null })
      try {
        const [partners, cities] = await Promise.all([partnersApi.listPartners(), partnersApi.listCities()])
        set({ partners, cities, loading: false })
      } catch (error) {
        set({ loading: false, error: reasonOf(error) })
      }
    },

    create: async (input) => {
      const partner = await partnersApi.createPartner(input)
      set({ partners: [partner, ...get().partners] })
      refreshCities()
      return partner
    },

    update: async (id, patch) => {
      try {
        replace(await partnersApi.updatePartner(id, patch))
        refreshCities()
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    remove: async (id) => {
      try {
        await partnersApi.deletePartner(id)
        set({ partners: get().partners.filter((p) => p.id !== id) })
        refreshCities()
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    addNote: async (id, text) => {
      try {
        await partnersApi.addNote(id, text)
        replace(await partnersApi.getPartner(id))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    deleteNote: async (id, noteId) => {
      try {
        await partnersApi.deleteNote(id, noteId)
        replace(await partnersApi.getPartner(id))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },
  }
})
