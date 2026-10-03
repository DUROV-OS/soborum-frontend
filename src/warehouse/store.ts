import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as warehouseApi from './api'
import { Material } from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface WarehouseState {
  materials: Material[]
  loading: boolean
  load: () => Promise<void>
  createMaterial: (input: warehouseApi.MaterialCreateInput) => Promise<ActionResult>
  updateMaterial: (id: number, patch: warehouseApi.MaterialUpdateInput) => Promise<ActionResult>
  writeOffMaterial: (id: number, quantity: number, reason: string) => Promise<ActionResult>
  createSupply: (supplierName: string | undefined, lines: warehouseApi.SupplyLineInput[]) => Promise<ActionResult>
  importSupply: (file: File) => Promise<ActionResult>
  approveRequest: (requestId: number) => Promise<ActionResult>
  rejectRequest: (requestId: number) => Promise<ActionResult>
  /** Счётчик проведённых документов (0088) — журнал перечитывается при его смене. */
  operationsVersion: number
  createInventoryOperation: (
    kind: 'receipt' | 'write_off',
    input: warehouseApi.InventoryOperationInput,
  ) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  materials: [],
  loading: true,

  load: async () => {
    const materials = await warehouseApi.listMaterials()
    set({ materials, loading: false })
  },

  createMaterial: async (input) => {
    try {
      const material = await warehouseApi.createMaterial(input)
      set({ materials: [...get().materials, material] })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  updateMaterial: async (id, patch) => {
    try {
      const updated = await warehouseApi.updateMaterial(id, patch)
      set({ materials: get().materials.map((m) => (m.id === id ? updated : m)) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  writeOffMaterial: async (id, quantity, reason) => {
    try {
      const updated = await warehouseApi.writeOffMaterial(id, quantity, reason)
      set({
        materials: get().materials.map((m) => (m.id === id ? updated : m)),
        operationsVersion: get().operationsVersion + 1,
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  createSupply: async (supplierName, lines) => {
    try {
      await warehouseApi.createSupply(supplierName, lines)
      await get().load()
      set({ operationsVersion: get().operationsVersion + 1 })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  importSupply: async (file) => {
    try {
      await warehouseApi.importSupply(file)
      await get().load()
      set({ operationsVersion: get().operationsVersion + 1 })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  approveRequest: async (requestId) => {
    try {
      await warehouseApi.approveRequest(requestId)
      await get().load()
      set({ operationsVersion: get().operationsVersion + 1 })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  rejectRequest: async (requestId) => {
    try {
      await warehouseApi.rejectRequest(requestId)
      await get().load()
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  operationsVersion: 0,

  createInventoryOperation: async (kind, input) => {
    try {
      await warehouseApi.createInventoryOperation(kind, input)
      await get().load()
      set({ operationsVersion: get().operationsVersion + 1 })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },
}))
