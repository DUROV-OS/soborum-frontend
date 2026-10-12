import { create } from 'zustand'
import * as marketingApi from './api'
import { ContentItem } from './types'
import { plainErrorText } from '@/shared/lib/humanError'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface MarketingState {
  items: ContentItem[]
  loading: boolean
  load: () => Promise<void>
  create: (input: marketingApi.CreateContentInput) => Promise<ActionResult>
  updateBasic: (id: number, patch: marketingApi.UpdateBasicInput) => Promise<ActionResult>
  updateRaw: (id: number, rawTexts?: string) => Promise<ActionResult>
  updateFinal: (id: number, finalTexts?: string) => Promise<ActionResult>
  setPostLinks: (id: number, links: { platform: string; url: string }[]) => Promise<ActionResult>
  updateAnalysis: (id: number, notes?: string, reach?: Record<string, number>) => Promise<ActionResult>
  advance: (id: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return plainErrorText(error, 'Не удалось выполнить действие')
}

export const useMarketingStore = create<MarketingState>((set, get) => {
  function replace(item: ContentItem) {
    set({ items: get().items.map((i) => (i.id === item.id ? item : i)) })
  }

  async function apply(mutation: () => Promise<ContentItem>): Promise<ActionResult> {
    try {
      replace(await mutation())
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  }

  return {
    items: [],
    loading: true,

    load: async () => {
      const items = await marketingApi.listContent()
      set({ items, loading: false })
    },

    create: async (input) => {
      try {
        const item = await marketingApi.createContent(input)
        set({ items: [item, ...get().items] })
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },

    updateBasic: (id, patch) => apply(() => marketingApi.updateBasic(id, patch)),
    updateRaw: (id, rawTexts) => apply(() => marketingApi.updateRaw(id, rawTexts)),
    updateFinal: (id, finalTexts) => apply(() => marketingApi.updateFinal(id, finalTexts)),
    setPostLinks: (id, links) => apply(() => marketingApi.setPostLinks(id, links)),
    updateAnalysis: (id, notes, reach) => apply(() => marketingApi.updateAnalysis(id, { analysis_notes: notes, analysis_reach: reach })),
    advance: (id) => apply(() => marketingApi.advanceStage(id)),
  }
})
