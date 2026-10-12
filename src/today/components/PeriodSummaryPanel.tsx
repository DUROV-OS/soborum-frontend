import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SECTIONS } from '@/shared/sections'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PeriodMetric, PeriodSummary } from '../types'

function formatValue(metric: PeriodMetric, value: number): string {
  if (metric.unit === 'rub') return `${Math.round(value).toLocaleString('ru-RU')} ₽`
  return value.toLocaleString('ru-RU')
}

/** Дельта к прошлому периоду: стрелка и цвет; для «плохих» метрик рост красный. */
function Delta({ metric, compareLabel }: { metric: PeriodMetric; compareLabel: string }) {
  const diff = metric.value - metric.previous
  if (diff === 0) {
    return <span className="text-[11px] text-muted">как {compareLabel}</span>
  }
  const up = diff > 0
  const bad = up === metric.growth_is_bad
  const Icon = up ? ArrowUpRight : ArrowDownRight
  const sign = up ? '+' : '−'
  const amount = formatValue(metric, Math.abs(diff))
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${bad ? 'text-danger' : 'text-success'}`}>
      <Icon size={13} />
      {sign}{amount} к {compareLabel === 'вчера' ? 'вчера' : 'прошлому периоду'}
    </span>
  )
}

interface Props {
  summary: PeriodSummary | undefined
  loading: boolean
  error: string | undefined
  onReload: () => void
}

export function PeriodSummaryPanel({ summary, loading, error, onReload }: Props) {
  const navigate = useNavigate()

  if (error) {
    return (
      <EmptyState title="Итоги временно недоступны" description={error}
        action={<Button size="sm" onClick={onReload}>Повторить</Button>} />
    )
  }
  if (!summary) {
    return <div role="status" className="rounded-2xl border border-border bg-surface px-6 py-12 text-[14px] text-muted">Считаем итоги…</div>
  }
  if (summary.sections.length === 0) {
    return <EmptyState title="Рабочие разделы пока не назначены" description="Администратор может назначить доступ в разделе «Доступ»." />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">{summary.label}. Сравнение — с периодом «{summary.compare_label}».</p>
        <Button variant="secondary" size="sm" onClick={onReload} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Пересчитать
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.sections.map((section) => {
          const target = SECTIONS.find((s) => s.id === section.section)
          return (
            <section key={section.section} className="rounded-2xl border border-border bg-surface p-5 shadow-card" aria-label={section.title}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-[16px] font-semibold tracking-tight text-ink">{section.title}</h3>
                {target && (
                  <button type="button" onClick={() => navigate(target.path)} aria-label={`Открыть раздел «${section.title}»`}
                    className="text-muted transition-colors hover:text-brand">
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              <ul className="divide-y divide-border">
                {section.metrics.map((metric) => (
                  <li key={metric.key} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-ink">{metric.label}</span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[16px] font-semibold tabular text-ink">{formatValue(metric, metric.value)}</span>
                      <Delta metric={metric} compareLabel={summary.compare_label} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
