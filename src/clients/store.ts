import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import * as clientsApi from './api'
import { Client, ClientCreateInput, ClientSourceInput, ClientTaskInput } from './types'

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
  /** Найденные по строке поиска клиенты; `null` — поиск не активен и доска
   * показывает обычный список за выбранный период (0079-f). */
  searchResults: Client[] | null
  searching: boolean
  search: (text: string) => Promise<void>
  clearLastAdvanced: () => void
  load: () => Promise<void>
  create: (input: ClientCreateInput) => Promise<Client>
  updateSource: (id: number, patch: ClientSourceInput) => Promise<ActionResult>
  createTask: (id: number, input: ClientTaskInput) => Promise<ActionResult>
  shiftTaskDeadline: (id: number, taskId: number, deadline: string, reason: string) => Promise<ActionResult>
  closeTask: (id: number, taskId: number, resolution: string, next?: ClientTaskInput) => Promise<ActionResult>
  updateDocuments: (id: number, patch: clientsApi.DocumentsUpdateInput) => Promise<ActionResult>
  updateHousesCount: (id: number, patch: clientsApi.HousesCountUpdateInput) => Promise<ActionResult>
  updatePayment: (id: number, isPaid: boolean) => Promise<ActionResult>
  setPaymentEditUnlocked: (id: number, unlocked: boolean) => Promise<ActionResult>
  createChatLink: (id: number, maxChatId: number, label: string) => Promise<ActionResult>
  updateChatLink: (id: number, linkId: number, patch: clientsApi.ChatLinkUpdateInput) => Promise<ActionResult>
  deleteChatLink: (id: number, linkId: number) => Promise<ActionResult>
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
    searchResults: null,
    searching: false,

    search: async (text) => {
      const query = text.trim()
      if (!query) {
        set({ searchResults: null, searching: false })
        return
      }
      set({ searching: true })
      try {
        set({ searchResults: await clientsApi.listClients(query), searching: false })
      } catch {
        // Пустой результат честнее оборванной доски: сам запрос покажет
        // ошибку сети в общем перехватчике.
        set({ searchResults: [], searching: false })
      }
    },

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

    updateSource: (id, patch) => applyClientMutation(() => clientsApi.updateSource(id, patch)),
    // Эндпоинты задач отвечают самой задачей, а не клиентом — поэтому клиента
    // после них перечитываем целиком (applyNoteMutation делает ровно это).
    createTask: (id, input) => applyNoteMutation(id, () => clientsApi.createClientTask(id, input)),
    shiftTaskDeadline: (id, taskId, deadline, reason) =>
      applyNoteMutation(id, () => clientsApi.shiftClientTaskDeadline(id, taskId, deadline, reason)),
    closeTask: (id, taskId, resolution, next) =>
      applyNoteMutation(id, () => clientsApi.closeClientTask(id, taskId, resolution, next)),
    updateDocuments: (id, patch) => applyClientMutation(() => clientsApi.updateDocuments(id, patch)),
    updateHousesCount: (id, patch) => applyClientMutation(() => clientsApi.updateHousesCount(id, patch)),
    updatePayment: (id, isPaid) => applyClientMutation(() => clientsApi.updatePayment(id, isPaid)),
    setPaymentEditUnlocked: (id, unlocked) =>
      applyClientMutation(() => clientsApi.setPaymentEditUnlocked(id, unlocked)),
    createChatLink: (id, maxChatId, label) =>
      applyNoteMutation(id, () => clientsApi.createChatLink(id, maxChatId, label)),
    updateChatLink: (id, linkId, patch) => applyNoteMutation(id, () => clientsApi.updateChatLink(id, linkId, patch)),
    deleteChatLink: (id, linkId) => applyNoteMutation(id, () => clientsApi.deleteChatLink(id, linkId)),
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
