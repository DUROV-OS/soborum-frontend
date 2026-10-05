import { useEffect, useState } from 'react'
import { AlertCircle, CalendarCheck, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { getDailyPlan } from '@/ai/api'
import { DailyPlanItemOut } from '@/ai/types'
import { Task } from '../types'

export function DailyPlanPanel({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const canShow = hasAccess('ai')

  const [plan, setPlan] = useState<DailyPlanItemOut[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(reload?: boolean) {
    setLoading(true)
    setError(null)
    try {
      const res = await getDailyPlan(reload)
      setPlan(res.plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить план на день')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canShow) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow])

  if (!canShow) return null

  return (
    <div className="mb-5 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <CalendarCheck size={15} className="text-indigo-600" />
          План на день
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          aria-label="Обновить"
          className="rounded-pill p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-2">
        {loading && !plan && <p className="text-[13px] text-muted">Собираем план на сегодня…</p>}
        {!loading && error && (
          <p className="flex items-center gap-1.5 text-[13px] text-danger">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
        {!loading && !error && plan && plan.length === 0 && (
          <p className="text-[13px] text-muted">На сегодня открытых задач для плана нет.</p>
        )}
        {!loading && !error && plan && plan.length > 0 && (
          <div className="flex flex-col gap-2">
            {plan.map(({ task, reason }, index) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className="flex items-start gap-2.5 rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-brand/40"
              >
                <span className="tabular mt-0.5 text-[12px] font-medium text-muted">{index + 1}</span>
                <div>
                  <div className="text-[13px] font-medium text-ink">{task.title}</div>
                  <div className="mt-1 text-[12px] text-muted">{reason}</div>
                  {task.deadline && (
                    <div className="mt-1.5 text-[11px] text-muted">
                      {new Date(task.deadline).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
