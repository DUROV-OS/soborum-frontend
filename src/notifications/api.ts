import { apiRequest } from '@/shared/lib/httpClient'

const SECTION = 'notifications'

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
