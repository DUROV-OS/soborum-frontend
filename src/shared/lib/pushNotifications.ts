/**
 * Браузерный push (0080-e): Service Worker + Notification API.
 * Прецедент запроса разрешения в проекте — `useVoiceInput.ts` (getUserMedia
 * в try/catch, понятный текст при отказе); здесь та же логика для
 * `Notification.requestPermission()`.
 *
 * Требует https или localhost — ограничение самого Push API браузера, не
 * этого кода. Подписка (Push API, `pushManager.subscribe`) и отправка её
 * на backend — следующий шаг (0080-e, коммит 2), здесь только SW и
 * разрешение.
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
