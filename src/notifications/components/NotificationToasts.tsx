import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { ToastItem, useNotificationsStore } from '../store'
import { notificationTargetPath } from '../routing'
import { NOTIFICATION_KIND_LABEL } from '../types'

const AUTO_HIDE_MS = 8_000

function Toast({ item }: { item: ToastItem }) {
  const navigate = useNavigate()
  const dismissToast = useNotificationsStore((s) => s.dismissToast)
  const markRead = useNotificationsStore((s) => s.markRead)
  const timer = useRef<number>()

  const start = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => dismissToast(item.key), AUTO_HIDE_MS)
  }
  const pause = () => window.clearTimeout(timer.current)

  useEffect(() => {
    start()
    return pause
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key, item.kind === 'summary' ? item.count : 0])

  async function open() {
    dismissToast(item.key)
    if (item.kind === 'summary') {
      navigate('/notifications')
      return
    }
    const { notification } = item
    try {
      await markRead(notification.id)
    } catch {
      // Не удалось отметить — всё равно ведём на объект, бейдж поправит опрос.
    }
    const path = notificationTargetPath(notification.object_type, notification.object_id)
    if (path) navigate(path)
  }

  return (
    <div
      role="status"
      onMouseEnter={pause}
      onMouseLeave={start}
      className="pointer-events-auto relative rounded-2xl border border-border bg-surface shadow-xl"
    >
      <button type="button" onClick={open} className="flex w-full items-start gap-3 p-4 pr-10 text-left">
        <Bell size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          {item.kind === 'summary' ? (
            <p className="text-[14px] font-semibold text-ink">Новых уведомлений: {item.count}</p>
          ) : (
            <>
              <p className="text-[12px] text-muted">
                {NOTIFICATION_KIND_LABEL[item.notification.kind] ?? item.notification.kind}
              </p>
              <p className="mt-1 line-clamp-2 text-[14px] font-semibold text-ink">{item.notification.title}</p>
              {item.notification.body && (
                <p className="mt-1 line-clamp-2 text-[13px] text-muted">{item.notification.body}</p>
              )}
            </>
          )}
        </div>
      </button>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={() => dismissToast(item.key)}
        className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/** Плашки о новых уведомлениях в правом нижнем углу (0080-g). */
export function NotificationToasts() {
  const toasts = useNotificationsStore((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
    >
      {toasts.map((t) => (
        <Toast key={t.key} item={t} />
      ))}
    </div>
  )
}
