/**
 * Браузерный push (0080-e): Service Worker + Notification API.
 * Прецедент запроса разрешения в проекте — `useVoiceInput.ts` (getUserMedia
 * в try/catch, понятный текст при отказе); здесь та же логика для
 * `Notification.requestPermission()`.
 *
 * Требует https или localhost — ограничение самого Push API браузера, не
 * этого кода.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

/** Запрашивает разрешение показывать уведомления. Как `getUserMedia` в
 * `useVoiceInput` — в try/catch: `Notification.requestPermission` сам по
 * себе Promise-based и редко бросает, но лучше вернуть понятный «отказ»,
 * чем дать необработанному исключению уронить вызывающий код. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Base64url (RFC4648 §5) VAPID-ключ из .env → Uint8Array для `applicationServerKey`. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/** Подписывает текущий браузер на push через VAPID-публичный ключ из
 * `VITE_VAPID_PUBLIC_KEY`. Бросает, если ключ не задан на этой сборке
 * фронта — вызывающий код (хук) превращает это в понятную ошибку. */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY не задан в сборке фронта')
  }
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    // `Uint8Array` вместо `ArrayBuffer` — то, что реально ожидает
    // `applicationServerKey` в рантайме; явный cast из-за несовпадения
    // generic-типа typed array с `BufferSource` в текущих lib.dom.d.ts.
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
  })
}

export async function unsubscribeFromPush(registration: ServiceWorkerRegistration): Promise<string | null> {
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}

/** Сериализация `PushSubscription` в тело запроса на backend — ровно то,
 * что ожидает `POST /api/notifications/push-subscriptions`. */
export function toSubscriptionPayload(subscription: PushSubscription): {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  const json = subscription.toJSON()
  const keys = json.keys ?? {}
  if (!keys.p256dh || !keys.auth) {
    throw new Error('Браузер не вернул ключи подписки (p256dh/auth)')
  }
  return { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}
