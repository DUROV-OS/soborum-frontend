import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { ToastItem, useNotificationsStore } from '../store'
import { notificationTargetPath } from '../routing'
import { NOTIFICATION_KIND_LABEL } from '../types'

/** На телефоне плашка живёт 5 секунд, на десктопе остаётся, пока её не закроют. */
const MOBILE_AUTO_HIDE_MS = 5_000
const SWIPE_DISMISS_PX = 80
const TAP_SLOP_PX = 6
const MOBILE_QUERY = '(max-width: 639px)'

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function Toast({ item, mobile }: { item: ToastItem; mobile: boolean }) {
  const navigate = useNavigate()
  const dismissToast = useNotificationsStore((s) => s.dismissToast)
  const markRead = useNotificationsStore((s) => s.markRead)
  // Мобильная плашка: по касанию показываем кнопки (и останавливаем таймер).
  const [expanded, setExpanded] = useState(false)
  const [dx, setDx] = useState(0)
  const drag = useRef<{ startX: number; moved: boolean } | null>(null)

  useEffect(() => {
    if (!mobile || expanded) return
    const timer = window.setTimeout(() => dismissToast(item.key), MOBILE_AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [mobile, expanded, item.key, item.kind === 'summary' ? item.count : 0, dismissToast])

  async function view() {
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

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mobile) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const delta = e.clientX - d.startX
    if (Math.abs(delta) > TAP_SLOP_PX) d.moved = true
    if (d.moved) setDx(delta)
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (Math.abs(dx) > SWIPE_DISMISS_PX) {
      dismissToast(item.key)
      return
    }
    setDx(0)
    if (!d.moved) setExpanded(true)
  }

  const showActions = mobile ? expanded : true
  const actionsClass = mobile
    ? expanded
      ? 'mt-3 flex gap-2'
      : 'hidden'
    : 'mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'

  return (
    <div
      role="status"
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, opacity: dx ? Math.max(0.3, 1 - Math.abs(dx) / 250) : undefined }}
      className="group pointer-events-auto rounded-2xl border border-border bg-surface p-4 shadow-xl"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'pan-y' }}
        className="flex items-start gap-3"
      >
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
      </div>
      {showActions && (
        <div className={actionsClass}>
          <button
            type="button"
            onClick={() => dismissToast(item.key)}
            className="rounded-pill border border-border px-3 py-1.5 text-[13px] text-ink hover:border-brand/40"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={view}
            className="rounded-pill bg-brand px-3 py-1.5 text-[13px] font-medium text-white"
          >
            Смотреть
          </button>
        </div>
      )}
    </div>
  )
}

/** Плашки о новых уведомлениях: справа вверху на десктопе, вверху на телефоне (0080-g). */
export function NotificationToasts() {
  const toasts = useNotificationsStore((s) => s.toasts)
  const mobile = useIsMobile()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-4 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
    >
      {toasts.map((t) => (
        <Toast key={t.key} item={t} mobile={mobile} />
      ))}
    </div>
  )
}
