import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Tabs } from '@/shared/ui/Tabs'
import { sectionById, SectionId } from '@/shared/sections'
import { NotificationSettingsTab } from '../components/NotificationSettingsTab'
import { useNotificationsStore } from '../store'
import { notificationTargetPath } from '../routing'
import { Notification, NOTIFICATION_KIND_LABEL } from '../types'

function sectionLabel(objectType: string | null): string | null {
  if (!objectType) return null
  try {
    return sectionById(objectType as SectionId).label
  } catch {
    return objectType
  }
}

function NotificationCard({ notification, onOpen }: { notification: Notification; onOpen: (n: Notification) => void }) {
  const unread = !notification.read_at
  return (
    <li
      className={`rounded-2xl border bg-surface ${unread ? 'border-brand/50' : 'border-border'}`}
    >
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Bell size={16} className={`mt-0.5 shrink-0 ${unread ? 'text-brand' : 'text-muted'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <span>{NOTIFICATION_KIND_LABEL[notification.kind] ?? notification.kind}</span>
            <span>·</span>
            <span>{new Date(notification.created_at).toLocaleString('ru-RU')}</span>
            {sectionLabel(notification.object_type) && (
              <>
                <span>·</span>
                <span>{sectionLabel(notification.object_type)}</span>
              </>
            )}
          </div>
          <p className="mt-1.5 text-[14px] font-medium text-ink">{notification.title}</p>
          {notification.body && <p className="mt-1 text-[13px] text-muted">{notification.body}</p>}
        </div>
        {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
      </button>
    </li>
  )
}

/**
 * «Уведомления» (0080-d): лента личных уведомлений (прочитанные/непрочитанные
 * визуально разделены, клик ведёт на объект и отмечает прочитанным) + вкладка
 * «Настройки» — мьют раздела целиком или конкретного объекта.
 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const notifications = useNotificationsStore((s) => s.notifications)
  const load = useNotificationsStore((s) => s.load)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const [tab, setTab] = useState<'list' | 'settings'>('list')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить уведомления'))
      .finally(() => setLoaded(true))
  }, [load])

  async function open(notification: Notification) {
    setError(null)
    try {
      if (!notification.read_at) await markRead(notification.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить прочитанным')
    }
    const path = notificationTargetPath(notification.object_type, notification.object_id)
    if (path) navigate(path)
  }

  async function handleMarkAllRead() {
    setError(null)
    try {
      await markAllRead()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить все прочитанными')
    }
  }

  const unread = notifications.filter((n) => !n.read_at)
  const read = notifications.filter((n) => n.read_at)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Уведомления</h1>
          <p className="mt-1 text-[13px] text-muted">
            Личные уведомления по вашим клиентам, задачам, производству, монтажу и другим разделам.
          </p>
        </div>
        {tab === 'list' && unread.length > 0 && (
          <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" onClick={handleMarkAllRead}>
            <CheckCheck size={14} />
            Отметить все прочитанными
          </Button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'list', label: 'Все уведомления' },
          { key: 'settings', label: 'Настройки' },
        ]}
        activeKey={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

        {tab === 'settings' ? (
          <NotificationSettingsTab />
        ) : loaded && notifications.length === 0 ? (
          <EmptyState icon={<Bell size={22} />} title="Уведомлений пока нет" />
        ) : (
          <div className="flex flex-col gap-6">
            {unread.length > 0 && (
              <div>
                <h2 className="mb-2 text-[13px] font-medium text-muted">Непрочитанные ({unread.length})</h2>
                <ul className="flex flex-col gap-2">
                  {unread.map((n) => (
                    <NotificationCard key={n.id} notification={n} onOpen={open} />
                  ))}
                </ul>
              </div>
            )}
            {read.length > 0 && (
              <div>
                <h2 className="mb-2 text-[13px] font-medium text-muted">Прочитанные</h2>
                <ul className="flex flex-col gap-2">
                  {read.map((n) => (
                    <NotificationCard key={n.id} notification={n} onOpen={open} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
