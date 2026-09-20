import { create } from 'zustand'
import * as aiApi from '@/ai/api'
import { applyStreamEvent, StreamBubble } from '@/ai/stream'
import { ApiError, StreamEvent } from '@/shared/lib/httpClient'
import { MessageOut, PendingActionOut } from '@/ai/types'

const STORAGE_KEY = 'soborbum.consult.visible'

interface PersistShape {
  chatId: number | null
  messages: MessageOut[]
}

interface ConsultState {
  chatId: number | null
  messages: MessageOut[]
  pendingActions: PendingActionOut[]
  sending: boolean
  streamBubbles: StreamBubble[]
  streamStatus: string | null
  error: string | null
  optimisticMessage: string | null
  draft: string
  hydrate: () => void
  setDraft: (text: string) => void
  send: (message: string) => Promise<void>
  resolveAction: (id: number, decision: 'approve' | 'reject') => Promise<void>
  clear: () => Promise<void>
}

function reasonOf(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'Ответ занял слишком долго — повторите, не обновляя страницу.'
  }
  if (error instanceof Error && /signal timed out|aborted|TimeoutError/i.test(error.message)) {
    return 'Ответ занял слишком долго — повторите, не обновляя страницу.'
  }
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return 'Сеть оборвалась или сервер не ответил вовремя. Обновите страницу и повторите.'
  }
  return error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось отправить'
}

function loadPersist(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { chatId: null, messages: [] }
    const parsed = JSON.parse(raw) as PersistShape
    return {
      chatId: typeof parsed.chatId === 'number' ? parsed.chatId : null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    }
  } catch {
    return { chatId: null, messages: [] }
  }
}

function savePersist(chatId: number | null, messages: MessageOut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ chatId, messages }))
}

function bubble(role: 'user' | 'assistant', text: string, id: number): MessageOut {
  return {
    id,
    role,
    content: [{ type: 'text', text }],
    tool_resolutions: null,
    created_at: new Date().toISOString(),
  }
}

export const useConsultStore = create<ConsultState>((set, get) => ({
  chatId: null,
  messages: [],
  pendingActions: [],
  sending: false,
  streamBubbles: [],
  streamStatus: null,
  error: null,
  optimisticMessage: null,
  draft: '',

  hydrate: () => {
    const saved = loadPersist()
    set({ chatId: saved.chatId, messages: saved.messages })
  },

  setDraft: (text) => set({ draft: text }),

  send: async (message) => {
    const text = message.trim()
    if (!text) return
    const { chatId, messages } = get()
    const userBubble = bubble('user', text, Date.now())
    set({
      sending: true,
      error: null,
      optimisticMessage: text,
      messages: [...messages, userBubble],
      draft: '',
      streamBubbles: [],
      streamStatus: null,
    })

    const clearStream = () => set({ streamBubbles: [], streamStatus: null })

    const finalize = (nextChatId: number | null, pending: PendingActionOut[]) => {
      // Во время стрима пузыри показываются по одному; в ленту кладём одно
      // ассистентское сообщение (так работает озвучка «Голосом: …»).
      const joined = get().streamBubbles.map((b) => b.text.trim()).filter(Boolean).join('\n\n')
      const base = get().messages.filter((item) => item.id !== userBubble.id)
      const nextMessages = [
        ...base,
        userBubble,
        ...(joined ? [bubble('assistant', joined, Date.now() + 1)] : []),
      ]
      const resolvedChatId = nextChatId ?? get().chatId
      set({
        chatId: resolvedChatId,
        messages: nextMessages,
        pendingActions: pending,
        sending: false,
        optimisticMessage: null,
      })
      clearStream()
      savePersist(resolvedChatId, nextMessages)
    }

    let sawByte = false
    let doneChatId: number | null = null
    let pendingFromStream: PendingActionOut[] = []
    let streamError: string | null = null

    try {
      await aiApi.askConsultStream({ chat_id: chatId, message: text }, (event: StreamEvent) => {
        sawByte = true
        if (event.type === 'topic_reset') return
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
        set({ sending: false, error: reasonOf(error), optimisticMessage: null })
        clearStream()
        return
      }
      // Стрим не поднялся — блокирующий запрос как раньше.
      try {
        const response = await aiApi.askConsult({ chat_id: chatId, message: text })
        const assistantId = response.pending_actions[0]?.message_id ?? Date.now() + 1
        const nextMessages = [
          ...get().messages.filter((item) => item.id !== userBubble.id),
          userBubble,
          ...(response.reply ? [bubble('assistant', response.reply, assistantId)] : []),
        ]
        set({
          chatId: response.chat_id,
          messages: nextMessages,
          pendingActions: response.pending_actions,
          sending: false,
          optimisticMessage: null,
        })
        savePersist(response.chat_id, nextMessages)
      } catch (fallbackError) {
        set({ sending: false, error: reasonOf(fallbackError), optimisticMessage: null })
        clearStream()
      }
      return
    }

    if (streamError) {
      set({ sending: false, error: streamError, optimisticMessage: null })
      clearStream()
      return
    }
    finalize(doneChatId, pendingFromStream)
  },

  resolveAction: async (id, decision) => {
    try {
      const response = await aiApi.resolveConsultAction(id, decision)
      const extra = response.reply ? [bubble('assistant', response.reply, Date.now())] : []
      const messages = [...get().messages, ...extra]
      set({
        chatId: response.chat_id,
        messages,
        pendingActions: response.pending_actions,
      })
      savePersist(response.chat_id, messages)
    } catch (error) {
      set({ error: reasonOf(error) })
    }
  },

  clear: async () => {
    const chatId = get().chatId
    try {
      await aiApi.clearConsult(chatId)
    } catch {
      // локальную ленту всё равно убираем — пользователь просил стереть у себя
    }
    set({ chatId: null, messages: [], pendingActions: [], error: null, optimisticMessage: null, draft: '' })
    localStorage.removeItem(STORAGE_KEY)
  },
}))
