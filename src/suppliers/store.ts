import { create } from 'zustand'
import * as suppliersApi from './api'
import { LeadTimeQuestionDraft, PriceListImportResult, Supplier } from './types'
import { plainErrorText } from '@/shared/lib/humanError'

export interface ActionResult {
  ok: boolean
  reason?: string
}

function reasonOf(error: unknown): string {
  return plainErrorText(error, 'Не удалось выполнить действие')
}

interface SuppliersState {
  suppliers: Supplier[]
  loading: boolean
  /** Ошибка загрузки списка (напр. нет доступа к разделу склада). */
  loadError: string | null
  load: () => Promise<void>
  create: (input: suppliersApi.SupplierCreateInput) => Promise<ActionResult>
  update: (id: number, patch: suppliersApi.SupplierUpdateInput) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  addPriceItem: (id: number, input: suppliersApi.PriceItemInput) => Promise<ActionResult>
  updatePriceItem: (
    id: number,
    itemId: number,
    patch: Partial<suppliersApi.PriceItemInput>,
  ) => Promise<ActionResult>
  removePriceItem: (id: number, itemId: number) => Promise<ActionResult>
  addNote: (id: number, text: string) => Promise<ActionResult>
  removeNote: (id: number, noteId: number) => Promise<ActionResult>
  importPriceList: (id: number, file: File) => Promise<ActionResult & { result?: PriceListImportResult }>
  aiFillCategory: (id: number) => Promise<ActionResult & { filled?: number; skipped?: number }>
  draftLeadTimeQuestion: (id: number) => Promise<ActionResult & { draft?: LeadTimeQuestionDraft }>
  sendLeadTimeQuestion: (id: number, message: string) => Promise<ActionResult>
  createBackfillTask: (id: number, missingFields: string[]) => Promise<ActionResult & { taskId?: number }>
  linkChat: (id: number, chatId: number) => Promise<ActionResult>
  unlinkChat: (id: number) => Promise<ActionResult>
}

export const useSuppliersStore = create<SuppliersState>((set, get) => {
  const replace = (updated: Supplier) =>
    set({ suppliers: get().suppliers.map((s) => (s.id === updated.id ? updated : s)) })

  return {
    suppliers: [],
    loading: true,
    loadError: null,

    load: async () => {
      set({ loading: true, loadError: null })
      try {
        const suppliers = await suppliersApi.listSuppliers()
        set({ suppliers, loading: false })
      } catch (error) {
        set({ loading: false, loadError: reasonOf(error) })
      }
    },

    create: async (input) => {
      try {
        const supplier = await suppliersApi.createSupplier(input)
        set({ suppliers: [...get().suppliers, supplier].sort((a, b) => a.name.localeCompare(b.name, 'ru')) })
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    update: async (id, patch) => {
      try {
        replace(await suppliersApi.updateSupplier(id, patch))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    remove: async (id) => {
      try {
        await suppliersApi.deleteSupplier(id)
        set({ suppliers: get().suppliers.filter((s) => s.id !== id) })
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    addPriceItem: async (id, input) => {
      try {
        replace(await suppliersApi.addPriceItem(id, input))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    updatePriceItem: async (id, itemId, patch) => {
      try {
        replace(await suppliersApi.updatePriceItem(id, itemId, patch))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    removePriceItem: async (id, itemId) => {
      try {
        await suppliersApi.deletePriceItem(id, itemId)
        await get().load()
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    addNote: async (id, text) => {
      try {
        replace(await suppliersApi.addNote(id, text))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    removeNote: async (id, noteId) => {
      try {
        replace(await suppliersApi.deleteNote(id, noteId))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    importPriceList: async (id, file) => {
      try {
        const result = await suppliersApi.importPriceList(id, file)
        replace(result.supplier)
        return { ok: true, result }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    aiFillCategory: async (id) => {
      try {
        const res = await suppliersApi.aiFillCategory(id)
        replace(res.supplier)
        return { ok: true, filled: res.filled, skipped: res.skipped }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    draftLeadTimeQuestion: async (id) => {
      try {
        return { ok: true, draft: await suppliersApi.draftLeadTimeQuestion(id) }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    sendLeadTimeQuestion: async (id, message) => {
      try {
        await suppliersApi.sendLeadTimeQuestion(id, message)
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    createBackfillTask: async (id, missingFields) => {
      try {
        const res = await suppliersApi.createBackfillTask(id, missingFields)
        replace(res.supplier)
        return { ok: true, taskId: res.task_id }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    linkChat: async (id, chatId) => {
      try {
        replace(await suppliersApi.linkMaxChat(id, chatId))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    unlinkChat: async (id) => {
      try {
        replace(await suppliersApi.unlinkMaxChat(id))
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },
  }
})
