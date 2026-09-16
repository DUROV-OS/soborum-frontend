import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as productionApi from './api'
import { ProductionListItem, Block, Production } from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface ProductionState {
  productions: ProductionListItem[]
  production: Production | null
  block: Block | null
  loading: boolean
  error: string | null
  loadProductions: () => Promise<void>
  loadProduction: (id: number) => Promise<void>
  loadBlock: (id: number) => Promise<void>
  createBlock: (productionId: number, name: string, description?: string) => Promise<ActionResult>
  updateBlock: (id: number, patch: { name?: string; description?: string }) => Promise<ActionResult>
  deleteProduction: (id: number) => Promise<ActionResult>
  deleteBlock: (id: number) => Promise<ActionResult>
  addBlockDependency: (blockId: number, dependsOnId: number) => Promise<ActionResult>
  removeBlockDependency: (blockId: number, dependsOnId: number) => Promise<ActionResult>
  addBlockMaterial: (blockId: number, input: productionApi.AddBlockMaterialInput) => Promise<ActionResult>
  updateBlockMaterial: (id: number, quantityRequired: number) => Promise<ActionResult>
  requestMaterial: (blockMaterialId: number, quantity: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export const useProductionStore = create<ProductionState>((set, get) => ({
  productions: [],
  production: null,
  block: null,
  loading: true,
  error: null,

  loadProductions: async () => {
    set({ loading: true, error: null })
    try {
      const productions = await productionApi.listProductions()
      set({ productions, loading: false })
    } catch (error) {
      set({ productions: [], loading: false, error: reasonOf(error) })
    }
  },

  loadProduction: async (id) => {
    const production = await productionApi.getProduction(id)
    set({ production })
  },

  loadBlock: async (id) => {
    const block = await productionApi.getBlock(id)
    set({ block })
  },

  createBlock: async (productionId, name, description) => {
    try {
      await productionApi.createBlock(productionId, name, description)
      await get().loadProduction(productionId)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  updateBlock: async (id, patch) => {
    try {
      const block = await productionApi.updateBlock(id, patch)
      set({ block })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  deleteProduction: async (id) => {
    try {
      await productionApi.deleteProduction(id)
      set({ productions: get().productions.filter((p) => p.id !== id) })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  deleteBlock: async (id) => {
    try {
      await productionApi.deleteBlock(id)
      const current = get().production
      if (current) set({ production: { ...current, blocks: current.blocks.filter((b) => b.id !== id) } })
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  addBlockDependency: async (blockId, dependsOnId) => {
    try {
      const current = get().production
      await productionApi.addBlockDependency(blockId, dependsOnId)
      if (current) await get().loadProduction(current.id)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  removeBlockDependency: async (blockId, dependsOnId) => {
    try {
      const current = get().production
      await productionApi.removeBlockDependency(blockId, dependsOnId)
      if (current) await get().loadProduction(current.id)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  addBlockMaterial: async (blockId, input) => {
    try {
      await productionApi.addBlockMaterial(blockId, input)
      await get().loadBlock(blockId)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  updateBlockMaterial: async (id, quantityRequired) => {
    try {
      const current = get().block
      await productionApi.updateBlockMaterial(id, quantityRequired)
      if (current) await get().loadBlock(current.id)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },

  requestMaterial: async (blockMaterialId, quantity) => {
    try {
      const current = get().block
      await productionApi.requestMaterial(blockMaterialId, quantity)
      if (current) await get().loadBlock(current.id)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  },
}))
