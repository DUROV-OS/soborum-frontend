import { create } from 'zustand'
import { ApiError, StreamEvent } from '@/shared/lib/httpClient'
import * as aiApi from './api'
import { applyStreamEvent, StreamBubble } from './stream'
import {
  AgentActivityOut,
  AskRequest,
  AskResponse,
  ChatDetailOut,
  ChatDomain,
  ChatMode,
  ChatOut,
  FileAssetOut,
  GrowthProposalOut,
  PendingActionOut,
} from './types'

function reasonOf(error: unknown): string {
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return 'Сеть оборвалась или сервер не ответил вовремя. Обновите страницу и повторите.'
  }
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

interface AiState {
  chats: ChatOut[]
  chatsLoading: boolean
  activeChat: ChatDetailOut | null
  loadingChat: boolean
  draftDomain: ChatDomain | null
  draftMode: ChatMode
  pendingActions: PendingActionOut[]
  sending: boolean
  /** Пузыри ответа, печатающиеся по мере генерации (SSE), до финального refreshChat. */
  streamBubbles: StreamBubble[]
  /** «Ищу в интернете…» и т.п. — статус текущего шага, пока текста ещё нет. */
  streamStatus: string | null
  /** Только что отправленное сообщение, пока ответ ещё не пришёл — рисуется как временный пузырь. */
  optimisticMessage: string | null
  /** Файлы, уже загруженные на бэкенд (POST /ai/files) и ждущие следующего send(). */
  attachments: FileAssetOut[]
  uploadingAttachment: boolean
  error: string | null
  /** Панель «Действия агента» справа от чата — общий лог, не зависит от activeChat. */
  agentActivity: AgentActivityOut[]
  agentActivityLoading: boolean
  /** Подраздел «Развитие» — общий список, не зависит от activeChat. */
  growthProposals: GrowthProposalOut[]
  growthProposalsLoading: boolean

  loadChats: (domain?: ChatDomain) => Promise<void>
  loadAgentActivity: () => Promise<void>
  loadGrowthProposals: () => Promise<void>
  prepareGrowthProposalTask: (id: number) => Promise<void>
  openChat: (id: number) => Promise<void>
  startDraft: (domain: ChatDomain, mode?: ChatMode) => void
  send: (message: string, contextNote?: string) => Promise<AskResponse | null>
  addAttachment: (file: File) => Promise<void>
  removeAttachment: (id: number) => void
  setMode: (mode: ChatMode) => Promise<void>
  renameChat: (id: number, title: string | null) => Promise<void>
  resolveAction: (id: number, decision: 'approve' | 'reject') => Promise<AskResponse | null>
  removeChat: (id: number) => Promise<void>
}

export const useAiStore = create<AiState>((set, get) => {
  async function refreshChat(chatId: number) {
    const [chat, pendingActions] = await Promise.all([
      aiApi.getChat(chatId),
      aiApi.listPendingActions(chatId),
    ])
    set({ activeChat: chat, pendingActions })
    set((state) => ({
      chats: state.chats.some((c) => c.id === chat.id)
        ? state.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...state.chats],
    }))
  }

  return {
    chats: [],
    chatsLoading: false,
    activeChat: null,
    loadingChat: false,
    draftDomain: null,
    draftMode: 'require_approval',
    pendingActions: [],
    sending: false,
    streamBubbles: [],
    streamStatus: null,
    optimisticMessage: null,
    attachments: [],
    uploadingAttachment: false,
    error: null,
    agentActivity: [],
    agentActivityLoading: false,
    growthProposals: [],
    growthProposalsLoading: false,

    loadAgentActivity: async () => {
      set({ agentActivityLoading: true })
      try {
        const agentActivity = await aiApi.listAgentActivity()
        set({ agentActivity, agentActivityLoading: false })
      } catch (error) {
        set({ agentActivityLoading: false, error: reasonOf(error) })
      }
    },

    loadGrowthProposals: async () => {
      set({ growthProposalsLoading: true })
      try {
        const growthProposals = await aiApi.listGrowthProposals()
        set({ growthProposals, growthProposalsLoading: false })
      } catch (error) {
        set({ growthProposalsLoading: false, error: reasonOf(error) })
      }
    },

    prepareGrowthProposalTask: async (id) => {
      const { proposal } = await aiApi.prepareGrowthProposalTask(id)
      set((state) => ({
        growthProposals: state.growthProposals.map((p) => (p.id === id ? proposal : p)),
      }))
    },

    loadChats: async (domain) => {
      set({ chatsLoading: true })
      try {
        const chats = await aiApi.listChats(domain)
        set({ chats, chatsLoading: false })
      } catch (error) {
        set({ chatsLoading: false, error: reasonOf(error) })
      }
    },

    openChat: async (id) => {
      set({ loadingChat: true, draftDomain: null, optimisticMessage: null, attachments: [] })
      try {
        await refreshChat(id)
        set({ loadingChat: false })
      } catch (error) {
        set({ loadingChat: false, error: reasonOf(error) })
      }
    },

    startDraft: (domain, mode = 'require_approval') => {
      set({
        activeChat: null,
        pendingActions: [],
        draftDomain: domain,
        draftMode: mode,
        optimisticMessage: null,
        attachments: [],
      })
    },

    send: async (message, contextNote) => {
      const { activeChat, draftDomain, draftMode, attachments } = get()
      const domain = activeChat?.domain ?? draftDomain
      if (!domain) return null
      const mode = activeChat?.mode ?? draftMode
      const placeholder = message || (attachments.length > 0 ? `📎 ${attachments.length} файл(ов)` : message)
      const request: AskRequest = {
        chat_id: activeChat?.id ?? null,
        message,
        file_ids: attachments.map((a) => a.id),
        mode,
        context_note: contextNote,
      }
      set({
        sending: true,
        error: null,
        optimisticMessage: placeholder,
        attachments: [],
        streamBubbles: [],
        streamStatus: null,
      })

      const clearStream = () => set({ streamBubbles: [], streamStatus: null })
      const failFrom = async (error: unknown) => {
        // Файлы уже загружены на бэкенд (у них есть id) — возвращаем их в composer.
        set({ sending: false, error: reasonOf(error), attachments, optimisticMessage: null })
        clearStream()
        const chatId = get().activeChat?.id
        if (chatId) await refreshChat(chatId).catch(() => {})
        else get().loadChats().catch(() => {})
      }

      let sawByte = false
      let doneChatId: number | null = null
      let pendingFromStream: PendingActionOut[] = []
      let streamError: string | null = null

      try {
        await aiApi.askDomainStream(domain, request, (event: StreamEvent) => {
          sawByte = true
          if (event.type === 'done') {
            doneChatId = typeof event.chat_id === 'number' ? event.chat_id : null
            return
          }
          if (event.type === 'pending_approval') {
            pendingFromStream = (event.pending_actions as PendingActionOut[]) ?? []
            doneChatId = typeof event.chat_id === 'number' ? event.chat_id : null
            return
          }
          if (event.type === 'error') {
            streamError = typeof event.detail === 'string' ? event.detail : 'Не удалось получить ответ'
            return
          }
          set((state) => {
            const next = applyStreamEvent(event, { bubbles: state.streamBubbles, status: state.streamStatus })
            return { streamBubbles: next.bubbles, streamStatus: next.status }
          })
        })
      } catch (error) {
        if (sawByte) {
          await failFrom(error)
          return null
        }
        // Ни одного байта — стрим не поднялся; пробуем блокирующий эндпоинт.
        try {
          const response = await aiApi.askDomain(domain, request)
          await refreshChat(response.chat_id)
          set({ sending: false, draftDomain: null, optimisticMessage: null })
          clearStream()
          return response
        } catch (fallbackError) {
          await failFrom(fallbackError)
          return null
        }
      }

      if (streamError) {
        await failFrom(new Error(streamError))
        return null
      }

      const chatId = doneChatId ?? get().activeChat?.id
      if (chatId) await refreshChat(chatId).catch(() => {})
      set({ sending: false, draftDomain: null, optimisticMessage: null })
      clearStream()
      return {
        chat_id: chatId ?? 0,
        status: pendingFromStream.length > 0 ? 'pending_approval' : 'completed',
        reply: null,
        pending_actions: pendingFromStream,
      }
    },

    addAttachment: async (file) => {
      set({ uploadingAttachment: true, error: null })
      try {
        const asset = await aiApi.uploadAttachment(file)
        set((state) => ({ attachments: [...state.attachments, asset], uploadingAttachment: false }))
      } catch (error) {
        set({ uploadingAttachment: false, error: reasonOf(error) })
      }
    },

    removeAttachment: (id) => {
      set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) }))
    },

    setMode: async (mode) => {
      const chat = get().activeChat
      if (!chat) {
        set({ draftMode: mode })
        return
      }
      try {
        const updated = await aiApi.updateChatMode(chat.id, mode)
        set((state) => ({
          activeChat: state.activeChat ? { ...state.activeChat, mode: updated.mode } : state.activeChat,
          chats: state.chats.map((c) => (c.id === updated.id ? { ...c, mode: updated.mode } : c)),
        }))
      } catch (error) {
        set({ error: reasonOf(error) })
      }
    },

    renameChat: async (id, title) => {
      try {
        const updated = await aiApi.updateChatTitle(id, title)
        set((state) => ({
          activeChat: state.activeChat?.id === id ? { ...state.activeChat, title: updated.title } : state.activeChat,
          chats: state.chats.map((c) => (c.id === id ? { ...c, title: updated.title } : c)),
        }))
      } catch (error) {
        set({ error: reasonOf(error) })
      }
    },

    resolveAction: async (id, decision) => {
      try {
        const response = decision === 'approve' ? await aiApi.approvePendingAction(id) : await aiApi.rejectPendingAction(id)
        await refreshChat(response.chat_id)
        return response
      } catch (error) {
        set({ error: reasonOf(error) })
        return null
      }
    },

    removeChat: async (id) => {
      try {
        await aiApi.deleteChat(id)
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== id),
          activeChat: state.activeChat?.id === id ? null : state.activeChat,
          pendingActions: state.activeChat?.id === id ? [] : state.pendingActions,
        }))
      } catch (error) {
        set({ error: reasonOf(error) })
      }
    },
  }
})
