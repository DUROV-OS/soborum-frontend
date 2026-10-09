import { apiRequest } from '@/shared/lib/httpClient'
import { Notification, NotificationMute, NotificationModule, UnreadCount } from './types'

const SECTION = 'notifications'

/** GET /api/notifications — свои уведомления, от новых к старым. */
export function listNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<Notification[]> {
  return apiRequest<Notification[]>({
    section: SECTION,
    path: '/',
    query: {
      unread_only: params?.unreadOnly,
      limit: params?.limit,
      offset: params?.offset,
    },
  })
}

/** GET /api/notifications/unread-count — счётчик для бейджа в меню. */
export function unreadCount(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>({ section: SECTION, path: '/unread-count' })
}

/** POST /api/notifications/:id/read — отметить одно уведомление прочитанным. */
export function markRead(id: number): Promise<Notification> {
  return apiRequest<Notification>({ section: SECTION, path: `/${id}/read`, method: 'POST' })
}

/** POST /api/notifications/read-all — отметить все прочитанными. */
export function markAllRead(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>({ section: SECTION, path: '/read-all', method: 'POST' })
}

/** GET /api/notifications/mutes — текущие мьюты (разделы целиком и точечные объекты). */
export function listMutes(): Promise<NotificationMute[]> {
  return apiRequest<NotificationMute[]>({ section: SECTION, path: '/mutes' })
}

/** PUT /api/notifications/mutes — включить/снять мьют раздела (`objectId` не задан) или объекта. */
export function setMute(module: NotificationModule | string, objectId: number | null, muted: boolean): Promise<NotificationMute[]> {
  return apiRequest<NotificationMute[]>({
    section: SECTION,
    path: '/mutes',
    method: 'PUT',
    body: { module, object_id: objectId, muted },
  })
}

export interface PushSubscriptionInput {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/** POST /api/notifications/push-subscriptions — сохраняет/обновляет подписку
 * текущего пользователя (несколько подписок на пользователя — норма, разные
 * браузеры/устройства). */
export function savePushSubscription(input: PushSubscriptionInput): Promise<void> {
  return apiRequest<void>({ section: SECTION, path: '/push-subscriptions', method: 'POST', body: input })
}

/** DELETE /api/notifications/push-subscriptions */
export function deletePushSubscription(endpoint: string): Promise<void> {
  return apiRequest<void>({
    section: SECTION,
    path: '/push-subscriptions',
    method: 'DELETE',
    body: { endpoint },
  })
}
