import { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { getTaskPriorities } from '@/ai/api'
import { PriorityTaskOut } from '@/ai/types'
import { Task } from '../types'
import { plainErrorText } from '@/shared/lib/humanError'

export function MyTasksPanel({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const canShow = hasAccess('ai')

  const [priorities, setPriorities] = useState<PriorityTaskOut[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await getTaskPriorities()
      setPriorities(res.priorities)
    } catch (e) {
      setError(plainErrorText(e, 'Не удалось загрузить приоритетные задачи'))
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
          <Sparkles size={15} className="text-indigo-600" />
          Мои задачи
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Обновить"
          className="rounded-pill p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-2">
        {loading && !priorities && <p className="text-[13px] text-muted">Подбираем приоритетные задачи…</p>}
        {!loading && error && (
          <p className="flex items-center gap-1.5 text-[13px] text-danger">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
        {!loading && !error && priorities && priorities.length === 0 && (
          <p className="text-[13px] text-muted">Нет задач, требующих особого внимания прямо сейчас.</p>
        )}
        {!loading && !error && priorities && priorities.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {priorities.map(({ task, reason }) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className="rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-brand/40"
              >
                <div className="text-[13px] font-medium text-ink">{task.title}</div>
                <div className="mt-1 text-[12px] text-muted">{reason}</div>
                {task.deadline && (
                  <div className="mt-2 text-[11px] text-muted">
                    {new Date(task.deadline).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
