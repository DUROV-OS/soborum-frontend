import { create } from 'zustand'
import * as notificationsApi from './api'
import { Notification, NotificationModule, NotificationMute } from './types'

interface NotificationsState {
  notifications: Notification[]
  mutes: NotificationMute[]
  unreadCount: number
  loading: boolean
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
