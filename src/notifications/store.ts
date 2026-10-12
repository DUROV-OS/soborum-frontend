import { create } from 'zustand'
import * as notificationsApi from './api'
import { Notification, NotificationModule, NotificationMute } from './types'

/** Плашка внутри системы (0080-g): отдельное уведомление или сводка «Новых уведомлений: N». */
export type ToastItem =
  | { key: string; kind: 'notification'; notification: Notification }
  | { key: string; kind: 'summary'; count: number }

/** Не больше стольких плашек одновременно; при переполнении последняя — сводная. */
const MAX_TOASTS = 3

interface NotificationsState {
  toasts: ToastItem[]
  /** Максимальный id уже «виденного» уведомления; `null` — первый опрос ещё не прошёл. */
  notifications: Notification[]
  mutes: NotificationMute[]
  lastSeenId: number | null
  unreadCount: number
  loading: boolean
  poll: (opts: { onNotificationsPage: boolean }) => Promise<void>
  dismissToast: (key: string) => void
  resetPolling: () => void
  load: () => Promise<void>
  loadUnreadCount: () => Promise<void>
  loadMutes: () => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  setMute: (module: NotificationModule | string, objectId: number | null, muted: boolean) => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  mutes: [],
  unreadCount: 0,
  loading: false,
  toasts: [],
  lastSeenId: null,

  poll: async ({ onNotificationsPage }) => {
    const [{ unread_count }, unread] = await Promise.all([
      notificationsApi.unreadCount(),
      notificationsApi.listNotifications({ unreadOnly: true, limit: 20 }),
    ])
    set({ unreadCount: unread_count })

    let lastSeenId = get().lastSeenId
    if (lastSeenId === null) {
      // Первый опрос после входа: всё, что уже есть, считаем виденным.
      const [latest] = await notificationsApi.listNotifications({ limit: 1 })
      const maxUnread = unread.reduce((m, n) => Math.max(m, n.id), 0)
      set({ lastSeenId: Math.max(latest?.id ?? 0, maxUnread) })
      return
    }

    const fresh = unread.filter((n) => n.id > lastSeenId!).sort((a, b) => a.id - b.id)
    if (fresh.length === 0) return
    lastSeenId = fresh[fresh.length - 1].id
    set({ lastSeenId })

    if (onNotificationsPage) {
      await get().load()
      return
    }
    set((state) => {
      const shown = state.toasts.filter((t): t is Extract<ToastItem, { kind: 'notification' }> => t.kind === 'notification')
      const hidden = state.toasts.reduce((sum, t) => sum + (t.kind === 'summary' ? t.count : 0), 0)
      const all = [...shown, ...fresh.map((notification) => ({ key: `n${notification.id}`, kind: 'notification' as const, notification }))]
      if (hidden === 0 && all.length <= MAX_TOASTS) return { toasts: all }
      const visible = all.slice(0, MAX_TOASTS - 1)
      const count = hidden + all.length - visible.length
      return { toasts: [...visible, { key: 'summary', kind: 'summary', count }] }
    })
  },

  dismissToast: (key) => set((state) => ({ toasts: state.toasts.filter((t) => t.key !== key) })),

  resetPolling: () => set({ toasts: [], lastSeenId: null }),

  load: async () => {
    set({ loading: true })
    try {
      set({ notifications: await notificationsApi.listNotifications({ limit: 200 }) })
    } finally {
      set({ loading: false })
    }
  },

  loadUnreadCount: async () => {
    const { unread_count } = await notificationsApi.unreadCount()
    set({ unreadCount: unread_count })
  },

  loadMutes: async () => {
    set({ mutes: await notificationsApi.listMutes() })
  },

  markRead: async (id) => {
    const notification = get().notifications.find((n) => n.id === id)
    if (notification?.read_at) return
    const updated = await notificationsApi.markRead(id)
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? updated : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    const { unread_count } = await notificationsApi.markAllRead()
    set((state) => ({
      notifications: state.notifications.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      unreadCount: unread_count,
    }))
  },

  setMute: async (module, objectId, muted) => {
    const mutes = await notificationsApi.setMute(module, objectId, muted)
    set({ mutes })
  },
}))
