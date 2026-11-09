import { useEffect, useRef, useState } from 'react'
import { AnalysisEvidence } from './AnalysisEvidence'
import { format } from 'date-fns'
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { Markdown } from '@/shared/ui/Markdown'
import { getSectionAnalytics } from '../api'
import { AnalyticsSection, SectionAnalyticsOut, SectionAnalyticsStatus } from '../types'

/** Цвет обводки блока — свой на каждый раздел, чтобы резюме узнавалось с первого взгляда. */
const SECTION_BORDER: Record<AnalyticsSection, string> = {
  clients: 'border-sky-300',
  production: 'border-orange-300',
  installation: 'border-violet-300',
  cycle: 'border-teal-300',
  warehouse: 'border-stone-300',
  marketing: 'border-fuchsia-300',
  tasks: 'border-indigo-300',
}

const STATUS_TONE: Record<SectionAnalyticsStatus, ChipTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'neutral',
}

// green — «по переданным данным отклонений не найдено», а не гарантия
// благополучия (0084-c).
const STATUS_LABEL: Record<SectionAnalyticsStatus, string> = {
  green: 'Отклонений не найдено',
  yellow: 'Нужно внимание',
  red: 'Критично',
  unknown: 'Не оценено',
}

export function SectionAnalyticsCard({ section }: { section: AnalyticsSection }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const canShow = hasAccess('ai')

  const [data, setData] = useState<SectionAnalyticsOut | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)

  async function load(reload = false) {
    const request = ++sequence.current
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await getSectionAnalytics(section, reload)
      if (request === sequence.current) setData(result)
    } catch (e) {
      if (request === sequence.current) setError(e instanceof Error ? e.message : 'Не удалось загрузить ИИ-резюме')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (canShow) load()
    return () => { sequence.current += 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow, section])

  if (!canShow) return null

  return (
    <div className={`mb-5 rounded-md border ${SECTION_BORDER[section]} bg-surface p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <Sparkles size={15} className="text-ai" />
          Анализ раздела
        </div>
        <div className="flex items-center gap-2">
          {data && !error && <Chip tone={!data.source_hash || data.input_changed ? 'neutral' : data.source === 'ai' && data.status === 'green' ? 'info' : STATUS_TONE[data.status]}>{!data.source_hash || data.input_changed ? 'Нужна актуальная проверка' : `${data.source === 'ai' ? 'Оценка ИИ: ' : 'Правила: '}${STATUS_LABEL[data.status]}`}</Chip>}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Обновить ИИ-резюме"
            className="rounded-pill p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="mt-2 text-[13px] leading-relaxed text-ink">
        {loading && !data && <span className="text-muted">Собираем аналитику…</span>}
        {!loading && error && (
          <span className="flex items-center gap-1.5 text-danger">
            <AlertCircle size={14} />
            {error}
          </span>
        )}
        {!loading && !error && data && <>
          {data.input_changed && <p role="alert" className="mb-2 text-warning">Данные изменились во время анализа. Этот вывод относится к предыдущему срезу; обновите анализ.</p>}
          {!!data.rule_findings?.length && <div className="mb-3 rounded-lg bg-surface-muted p-3"><p className="font-medium">Обнаружено по правилам</p><ul className="mt-1 space-y-1">{data.rule_findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul></div>}
          {data.source === 'ai' && <p className="mb-1 text-xs font-medium text-muted">Черновик вывода ИИ · сотрудником не согласован</p>}
          <Markdown text={data.summary} />
        </>}
      </div>
      {data && !error && (
        <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted">
          {data.status_floor_reason && (
            <span className="text-warning">Статус скорректирован по фактам: {data.status_floor_reason}</span>
          )}
          <span>
            {data.source === 'rules' && 'оценка по правилам, ИИ недоступен · '}
            анализ от {format(new Date(data.generated_at), 'dd.MM.yyyy HH:mm')}
          </span>
          {data.data_as_of && <span>Исходный срез: {format(new Date(data.data_as_of), 'dd.MM.yyyy HH:mm')}{data.cached ? ' · используется сохранённый анализ совпадающего среза' : ''}</span>}
          {data.checked_at && <span>Актуальность среза проверена: {format(new Date(data.checked_at), 'dd.MM.yyyy HH:mm')}</span>}
          <AnalysisEvidence snapshot={data.snapshot} sourceHash={data.source_hash} version={data.analysis_version} citations={data.citations} />
        </div>
      )}
    </div>
  )
}
