import { ArrowRight, BellRing } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationTargetPath } from '@/notifications/routing'
import { useNotificationsStore } from '@/notifications/store'
import { NOTIFICATION_KIND_LABEL } from '@/notifications/types'
import { useTodayStore } from '../store'
import { MissedItem } from '../types'

function ago(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'только что'
  if (hours < 24) return `${hours} ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

/**
 * «Вы могли пропустить» (0027): 2–3 самых важных непрочитанных уведомления,
 * которые выбрал ИИ. Клик отмечает уведомление прочитанным и ведёт к объекту.
 */
export function MissedBlock() {
  const navigate = useNavigate()
  const { missed, missedLoading, dropMissed } = useTodayStore()
  const markRead = useNotificationsStore((s) => s.markRead)
  const items = missed?.items ?? []

  if (!missedLoading && items.length === 0) return null

  async function open(item: MissedItem) {
    const path = notificationTargetPath(item.object_type ?? null, item.object_id ?? null)
    try {
      await markRead(item.id)
      dropMissed(item.id)
    } catch {
      // не удалось отметить — всё равно ведём к объекту, уведомление останется непрочитанным
    }
    if (path) navigate(path)
  }

  return (
    <section className="rounded-2xl border border-warning/30 bg-warning-bg/40 p-5 sm:p-6" aria-labelledby="missed-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="missed-title" className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
            <BellRing size={18} className="text-warning" /> Вы могли пропустить
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            {missed?.degraded ? 'Самое важное из непрочитанного' : 'Самое важное из непрочитанного — по оценке Марины'}
          </p>
        </div>
        <button type="button" onClick={() => navigate('/notifications')} className="text-[12px] text-muted transition-colors hover:text-brand">
          Все уведомления
        </button>
      </div>

      {missedLoading && items.length === 0 ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-surface-muted" />)}</div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => open(item)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-muted/60">
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted">{NOTIFICATION_KIND_LABEL[item.kind] ?? item.kind} · {ago(item.created_at)}</span>
                  <span className="mt-0.5 block text-[14px] font-medium text-ink">{item.title}</span>
                  {item.reason && <span className="mt-0.5 block text-[12px] text-warning">{item.reason}</span>}
                </span>
                <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
