import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useNotificationsStore } from '../store'

const VISIBLE_INTERVAL_MS = 10_000
const HIDDEN_INTERVAL_MS = 60_000

/**
 * Единый опрос уведомлений (0080-g): обновляет бейдж в меню и порождает плашки
 * о новых. Раз в 10 с, пока вкладка видима, раз в 60 с в фоне, сразу — при
 * возврате на вкладку. Монтируется один раз в `AppShell` (только для вошедшего).
 */
export function useNotificationPolling() {
  const poll = useNotificationsStore((s) => s.poll)
  const resetPolling = useNotificationsStore((s) => s.resetPolling)
  const { pathname } = useLocation()
  const onPageRef = useRef(false)
  onPageRef.current = pathname.startsWith('/notifications')

  useEffect(() => {
    let timer: number | undefined
    let inflight = false

    const tick = async () => {
      if (inflight) return
      inflight = true
      try {
        await poll({ onNotificationsPage: onPageRef.current })
      } catch {
        // Сеть/сервер недоступны — молча ждём следующего тика.
      } finally {
        inflight = false
      }
    }

    const schedule = () => {
      window.clearInterval(timer)
      const visible = document.visibilityState === 'visible'
      timer = window.setInterval(tick, visible ? VISIBLE_INTERVAL_MS : HIDDEN_INTERVAL_MS)
    }

    const onVisibility = () => {
      schedule()
      if (document.visibilityState === 'visible') void tick()
    }

    void tick()
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      resetPolling()
    }
  }, [poll, resetPolling])
}
