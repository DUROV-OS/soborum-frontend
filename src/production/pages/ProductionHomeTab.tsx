import { ReactNode, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { EmptyState } from '@/shared/ui/EmptyState'
import { FileLink } from '@/shared/ui/FileLink'
import { format } from 'date-fns'
import * as productionApi from '../api'
import { FactsTime, isProblemState, ReadinessBadge } from '../components/ReadinessBadge'
import { Production, ProductionHome as ProductionHomeData, ProductionReadiness } from '../types'

/** Вкладка «Главная» одного производства (0065): те же виджеты, что на
 * «Пульсе» («Требует внимания», «Актуальное»), но пересчитанные по одному
 * дому/циклу, плюс «Сроки» (главное узкое место) и документы клиента
 * (АР/КР/проект дома) — без цены/контактов, которые бэк для права
 * production сознательно не отдаёт. */
export function ProductionHomeTab() {
  const { production } = useOutletContext<{ production: Production }>()
  const navigate = useNavigate()
  const [home, setHome] = useState<ProductionHomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null)
  const [readinessFailed, setReadinessFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReadiness(null)
    setReadinessFailed(false)
    productionApi
      .getProductionReadiness(production.id)
      .then((data) => {
        if (!cancelled) setReadiness(data)
      })
      .catch(() => {
        if (!cancelled) setReadinessFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [production.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    productionApi
      .getProductionHome(production.id)
      .then((data) => {
        if (!cancelled) setHome(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить данные «Главной»')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [production.id])

  if (loading && !home) {
    return (
      <div role="status" className="rounded-md border border-border bg-surface px-6 py-12 text-center text-[13px] text-muted">
        Загрузка…
      </div>
    )
  }

  if (error || !home) {
    return <EmptyState icon={<AlertCircle size={24} />} title="Не удалось загрузить «Главную»" description={error ?? undefined} />
  }

  return (
    <div className="flex flex-col gap-5">
      <ReadinessSection readiness={readiness} failed={readinessFailed} onNavigate={navigate} />
      <AttentionSection actions={home.actions} readiness={readiness} onNavigate={navigate} />
      <div className="grid gap-5 sm:grid-cols-2">
        <AktualnoeSection aktualnoe={home.aktualnoe} />
        <DeadlinesSection deadlines={home.deadlines} />
      </div>
      <DocumentsSection documents={home.documents} />
    </div>
  )
}

const REASONS_SHOWN = 10

/** Блок «Готовность»: состояние материалов из оценки сервера (0084-b),
 * причины со ссылками на блок и время факта. */
function ReadinessSection({
  readiness,
  failed,
  onNavigate,
}: {
  readiness: ProductionReadiness | null
  failed: boolean
  onNavigate: (href: string) => void
}) {
  const reasons = readiness?.reasons ?? []
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface" aria-labelledby="production-readiness-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 id="production-readiness-title" className="text-[15px] font-medium text-ink">
          Готовность
        </h2>
        {readiness && (
          <div className="flex flex-wrap items-center gap-2">
            <ReadinessBadge state={readiness.materials_state} label={readiness.materials_label} />
            <FactsTime factsAt={readiness.facts_at} />
          </div>
        )}
      </div>
      {!readiness ? (
        <p className="px-5 py-5 text-[13px] text-muted">
          {failed ? 'Не удалось получить оценку готовности.' : 'Загружаем оценку готовности…'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {reasons.slice(0, REASONS_SHOWN).map((reason, index) => (
            <li key={`${reason.code}-${reason.block_id ?? 'p'}-${reason.material_id ?? reason.task_id ?? index}`}>
              {reason.block_id !== null ? (
                <button
                  type="button"
                  onClick={() => onNavigate(`/production/blocks/${reason.block_id}`)}
                  className="w-full px-5 py-3 text-left text-[13px] text-ink transition-colors hover:bg-surface-muted/60"
                >
                  {reason.text}
                </button>
              ) : (
                <p className="px-5 py-3 text-[13px] text-ink">{reason.text}</p>
              )}
            </li>
          ))}
          {reasons.length > REASONS_SHOWN && (
            <li className="px-5 py-3 text-[12px] text-muted">И ещё причин: {reasons.length - REASONS_SHOWN}</li>
          )}
        </ul>
      )}
    </section>
  )
}

function AttentionSection({
  actions,
  readiness,
  onNavigate,
}: {
  actions: ProductionHomeData['actions']
  readiness: ProductionReadiness | null
  onNavigate: (href: string) => void
}) {
  // «Всё чисто» — только когда и сигналов нет, и материалы по оценке в порядке.
  const readinessClean = readiness !== null && !isProblemState(readiness.materials_state)
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface" aria-labelledby="production-attention-title">
      <div className="border-b border-border px-5 py-4">
        <h2 id="production-attention-title" className="text-[15px] font-medium text-ink">
          Требует внимания
        </h2>
      </div>
      {actions.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-5 text-[13px] text-muted">
          {readinessClean ? (
            <>
              <CheckCircle2 size={16} className="shrink-0 text-success" />
              Всё чисто — сигналов внимания по этому дому нет.
            </>
          ) : (
            'Сигналов внимания нет, но оценка готовности материалов не подтверждена.'
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onNavigate(action.href)}
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60"
              >
                <AlertCircle size={16} className={`mt-0.5 shrink-0 ${action.tone === 'danger' ? 'text-danger' : 'text-warning'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink">{action.title}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-muted">{action.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AktualnoeSection({ aktualnoe }: { aktualnoe: ProductionHomeData['aktualnoe'] }) {
  return (
    <section className="flex flex-col rounded-md border border-border bg-surface p-5" aria-labelledby="production-aktualnoe-title">
      <h2 id="production-aktualnoe-title" className="mb-4 text-[15px] font-medium text-ink">
        Актуальное
      </h2>
      {aktualnoe === null ? (
        <p className="text-[13px] text-muted">Нет данных по клиенту этого цикла.</p>
      ) : (
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[13px] text-ink">{aktualnoe.phrase || aktualnoe.stage}</span>
            <span className="shrink-0 text-[12px] font-semibold tabular text-muted">{aktualnoe.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-pill bg-surface-muted" role="progressbar" aria-valuenow={aktualnoe.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-pill bg-brand transition-[width] duration-500" style={{ width: `${aktualnoe.percent}%` }} />
          </div>
          {aktualnoe.phrase && <p className="mt-2 text-[12px] text-muted">{aktualnoe.stage}</p>}
        </div>
      )}
    </section>
  )
}

function DeadlinesSection({ deadlines }: { deadlines: ProductionHomeData['deadlines'] }) {
  // source="none" — сигналов нет, по графику; "insufficient_data" — прогноз не построен (0084-c).
  const onSchedule = deadlines.source === 'none'
  return (
    <section className="flex flex-col rounded-md border border-border bg-surface p-5" aria-labelledby="production-deadlines-title">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={16} className={onSchedule ? 'text-success' : 'text-warning'} />
        <h2 id="production-deadlines-title" className="text-[15px] font-medium text-ink">
          Сроки
        </h2>
      </div>
      <p className="text-[14px] font-medium text-ink">{deadlines.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{deadlines.description}</p>
      {deadlines.impact && <p className="mt-2 text-[12px] leading-relaxed text-ink">{deadlines.impact}</p>}
      {deadlines.generated_at && (
        <p className="mt-3 text-[11px] text-muted">данные на {format(new Date(deadlines.generated_at), 'HH:mm')}</p>
      )}
    </section>
  )
}

function DocumentsSection({ documents }: { documents: ProductionHomeData['documents'] }) {
  return (
    <section className="rounded-md border border-border bg-surface p-5" aria-labelledby="production-documents-title">
      <h2 id="production-documents-title" className="mb-4 text-[15px] font-medium text-ink">
        Документы
      </h2>
      <div className="flex flex-col gap-1 text-[13px]">
        <DocumentRow label="Вид дома">{documents.house_model?.title || '—'}</DocumentRow>
        <DocumentRow label="АР">
          {documents.ar_file ? <FileLink id={documents.ar_file.id} filename={documents.ar_file.filename} /> : 'не загружено'}
        </DocumentRow>
        <DocumentRow label="КР">
          {documents.kr_file ? <FileLink id={documents.kr_file.id} filename={documents.kr_file.filename} /> : 'не загружено'}
        </DocumentRow>
        <DocumentRow label="Проект дома">
          {documents.house_project_file ? (
            <FileLink id={documents.house_project_file.id} filename={documents.house_project_file.filename} />
          ) : (
            'не загружено'
          )}
        </DocumentRow>
      </div>
    </section>
  )
}

function DocumentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2 last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  )
}
