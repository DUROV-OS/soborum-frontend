import { useCallback, useState } from 'react'
import { deletePushSubscription, savePushSubscription } from '@/notifications/api'
import {
  pushSupported,
  registerServiceWorker,
  subscribeToPush,
  toSubscriptionPayload,
  unsubscribeFromPush,
} from '@/shared/lib/pushNotifications'

export type PushStatus = 'unsupported' | 'idle' | 'requesting' | 'granted' | 'denied' | 'error'

export interface BrowserPushState {
  status: PushStatus
  error: string | null
  /** Permission моментальный снимок на вызов, не подписка на изменения —
   * его достаточно, чтобы решить, показывать ли кнопку повторного запроса. */
  permission: NotificationPermission | 'unsupported'
  /** Запрашивает разрешение (если ещё не решено) и оформляет подписку.
   * Безопасно звать повторно — уже решённое browser'ом разрешение он
   * просто возвращает без показа диалога. */
  enable: () => Promise<void>
  disable: () => Promise<void>
}

/**
 * Браузерный push (0080-e), по образцу `useVoiceInput`: try/catch вокруг
 * обращения к системному API браузера, понятная ошибка при отказе, без
 * попытки сделать вид, что всё получилось.
 */
export function useBrowserPush(): BrowserPushState {
  const [status, setStatus] = useState<PushStatus>(() => {
    if (!pushSupported()) return 'unsupported'
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    return 'idle'
  })
  const [error, setError] = useState<string | null>(null)

  const enable = useCallback(async () => {
    if (!pushSupported()) {
      setStatus('unsupported')
      setError('Этот браузер не поддерживает уведомления.')
      return
    }
    setStatus('requesting')
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        setError('Уведомления не разрешены — включить можно в настройках браузера.')
        return
      }
      const registration = await registerServiceWorker()
      const subscription = await subscribeToPush(registration)
      await savePushSubscription(toSubscriptionPayload(subscription))
      setStatus('granted')
    } catch {
      setStatus('error')
      setError('Не удалось включить уведомления. Попробуйте ещё раз.')
    }
  }, [])

  const disable = useCallback(async () => {
    if (!pushSupported()) return
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!registration) return
      const endpoint = await unsubscribeFromPush(registration)
      if (endpoint) await deletePushSubscription(endpoint)
      setStatus('idle')
    } catch {
      setError('Не удалось отключить уведомления. Попробуйте ещё раз.')
    }
  }, [])

  return {
    status,
    error,
    permission: pushSupported() ? Notification.permission : 'unsupported',
    enable,
    disable,
  }
}
