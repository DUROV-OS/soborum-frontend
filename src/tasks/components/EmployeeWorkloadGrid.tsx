import { useEffect, useState } from 'react'
import { AlertCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { getWorkload } from '../api'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { Workload, WorkloadLevel } from '../types'

const LEVEL_LABEL: Record<WorkloadLevel, string> = {
  low: 'Низкая загрузка',
  medium: 'Средняя загрузка',
  high: 'Высокая загрузка',
}

const LEVEL_TONE: Record<WorkloadLevel, ChipTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous
  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-[12px] text-muted">
        <Minus size={12} />
        без изменений
      </span>
    )
  }
  const up = delta > 0
  return (
    <span className={`flex items-center gap-1 text-[12px] ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}
      {delta} очков за неделю
    </span>
  )
}

export function EmployeeWorkloadGrid() {
  const [rows, setRows] = useState<Workload[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows(await getWorkload())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить загруженность сотрудников')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !rows) return <p className="text-[13px] text-muted">Считаем загруженность сотрудников…</p>

  if (error) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-danger">
        <AlertCircle size={14} />
        {error}
      </p>
    )
  }

  if (!rows || rows.length === 0) {
    return <p className="text-[13px] text-muted">Пока нет сотрудников с историей задач.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.user_id} className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[14px] font-medium text-ink">{row.full_name}</div>
            <Chip tone={LEVEL_TONE[row.workload_level]}>{LEVEL_LABEL[row.workload_level]}</Chip>
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink">
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Открытых задач</span>
              <span className="tabular">{row.open_tasks_count}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Открытых очков</span>
              <span className="tabular">{row.open_story_points}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Просрочено</span>
              <span className={`tabular ${row.overdue_count > 0 ? 'text-danger' : ''}`}>{row.overdue_count}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <Trend current={row.completed_points_7d} previous={row.completed_points_prev_7d} />
          </div>
        </div>
      ))}
    </div>
  )
}
