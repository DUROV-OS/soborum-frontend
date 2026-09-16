import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as clientsApi from './api'
import { Client, ClientChatState, ClientCreateInput } from './types'

export interface ActionResult {
  ok: boolean
  reason?: string
}

interface ClientsState {
  clients: Client[]
  loading: boolean
  /** id клиента, чья стадия только что изменилась переходом — используется доской,
   * чтобы раскрыть на мобильном аккордеоне колонку новой стадии, а не терять карточку. */
  lastAdvancedId: number | null
  clearLastAdvanced: () => void
  load: () => Promise<void>
  create: (input: ClientCreateInput) => Promise<Client>
  updateDocuments: (id: number, patch: clientsApi.DocumentsUpdateInput) => Promise<ActionResult>
  updateHousesCount: (id: number, patch: clientsApi.HousesCountUpdateInput) => Promise<ActionResult>
  updatePayment: (id: number, isPaid: boolean) => Promise<ActionResult>
  setMaxChat: (id: number, maxChatId: number | null) => Promise<ActionResult>
  setChatState: (id: number, state: ClientChatState) => Promise<ActionResult>
  markBalancePayment: (id: number) => Promise<ActionResult>
  uploadContractFiles: (id: number, contract: File, appendix: File) => Promise<ActionResult>
  uploadHouseProjectFile: (id: number, file: File) => Promise<ActionResult>
  uploadArFile: (id: number, file: File) => Promise<ActionResult>
  uploadKrFile: (id: number, file: File) => Promise<ActionResult>
  addNote: (id: number, text: string) => Promise<ActionResult>
  updateNote: (id: number, noteId: number, text: string) => Promise<ActionResult>
  deleteNote: (id: number, noteId: number) => Promise<ActionResult>
  advance: (id: number) => Promise<ActionResult>
  deleteClient: (id: number) => Promise<ActionResult>
}

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

export const useClientsStore = create<ClientsState>((set, get) => {
  function replace(client: Client) {
    set({ clients: get().clients.map((c) => (c.id === client.id ? client : c)) })
  }

  async function applyClientMutation(mutation: () => Promise<Client>): Promise<ActionResult> {
    try {
      replace(await mutation())
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  }

  async function applyNoteMutation(id: number, mutation: () => Promise<unknown>): Promise<ActionResult> {
    try {
      await mutation()
      const client = await clientsApi.getClient(id)
      replace(client)
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: reasonOf(error) }
    }
  }

  return {
    clients: [],
    loading: true,
    lastAdvancedId: null,
    clearLastAdvanced: () => set({ lastAdvancedId: null }),

    load: async () => {
      const clients = await clientsApi.listClients()
      set({ clients, loading: false })
    },

    create: async (input) => {
      const client = await clientsApi.createClient(input)
      set({ clients: [client, ...get().clients] })
      return client
    },

    updateDocuments: (id, patch) => applyClientMutation(() => clientsApi.updateDocuments(id, patch)),
    updateHousesCount: (id, patch) => applyClientMutation(() => clientsApi.updateHousesCount(id, patch)),
    updatePayment: (id, isPaid) => applyClientMutation(() => clientsApi.updatePayment(id, isPaid)),
    setMaxChat: (id, maxChatId) => applyClientMutation(() => clientsApi.setMaxChat(id, maxChatId)),
    setChatState: (id, state) => applyClientMutation(() => clientsApi.setChatState(id, state)),
    markBalancePayment: (id) => applyClientMutation(() => clientsApi.markBalancePayment(id)),
    uploadContractFiles: (id, contract, appendix) =>
      applyClientMutation(() => clientsApi.uploadContractFiles(id, contract, appendix)),
    uploadHouseProjectFile: (id, file) => applyClientMutation(() => clientsApi.uploadHouseProjectFile(id, file)),
    uploadArFile: (id, file) => applyClientMutation(() => clientsApi.uploadArFile(id, file)),
    uploadKrFile: (id, file) => applyClientMutation(() => clientsApi.uploadKrFile(id, file)),
    advance: async (id) => {
      const result = await applyClientMutation(() => clientsApi.advanceStage(id))
      if (result.ok) set({ lastAdvancedId: id })
      return result
    },

    addNote: (id, text) => applyNoteMutation(id, () => clientsApi.addNote(id, text)),
    updateNote: (id, noteId, text) => applyNoteMutation(id, () => clientsApi.updateNote(id, noteId, text)),
    deleteNote: (id, noteId) => applyNoteMutation(id, () => clientsApi.deleteNote(id, noteId)),

    deleteClient: async (id) => {
      try {
        await clientsApi.deleteClient(id)
        set({ clients: get().clients.filter((c) => c.id !== id) })
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: reasonOf(error) }
      }
    },
  }
})
