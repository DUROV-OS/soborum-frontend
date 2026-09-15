import { useEffect } from 'react'
import { AlertCircle, Lightbulb, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { useAiStore } from '../store'
import { GrowthProcessCard } from './GrowthProcessCard'
import { GrowthProposalCard } from './GrowthProposalCard'

/** Подраздел «Развитие» в «Марине» — предложения Марины по улучшению бизнеса
 * (0036-b). Кнопка «Обновить» запускает реальную генерацию через Claude
 * (0050-a/0050-b); без неё — демо-сид на localhost или ранее сгенерированное. */
export function GrowthSection({ className = '' }: { className?: string }) {
  const proposals = useAiStore((s) => s.growthProposals)
  const loading = useAiStore((s) => s.growthProposalsLoading)
  const refreshing = useAiStore((s) => s.growthProposalsRefreshing)
  const refreshError = useAiStore((s) => s.growthProposalsRefreshError)
  const loadGrowthProposals = useAiStore((s) => s.loadGrowthProposals)
  const refreshGrowthProposals = useAiStore((s) => s.refreshGrowthProposals)
  const prepareTask = useAiStore((s) => s.prepareGrowthProposalTask)

  useEffect(() => {
    loadGrowthProposals()
  }, [loadGrowthProposals])

  return (
    <section aria-labelledby="growth-proposals-title" className={`flex flex-col gap-4 lg:flex-row ${className}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="growth-proposals-title" className="text-[15px] font-medium text-ink">
              Развитие
            </h2>
            <p className="text-[12px] text-muted">Предложения Марины по улучшению бизнеса</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={refreshGrowthProposals}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Обновить
            </button>
            {refreshError && (
              <span className="flex max-w-[220px] items-center gap-1 text-right text-[11px] text-danger">
                <AlertCircle size={12} className="shrink-0" />
                {refreshError}
              </span>
            )}
          </div>
        </div>

        {loading && proposals.length === 0 && <LoadingState label="Загрузка…" />}
        {!loading && proposals.length === 0 && (
          <EmptyState
            icon={<Lightbulb size={22} />}
            title="Пока пусто"
            description="Здесь появятся предложения Марины по развитию бизнеса."
          />
        )}

        {proposals.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {proposals.map((proposal) => (
              <GrowthProposalCard key={proposal.id} proposal={proposal} onPrepareTask={prepareTask} />
            ))}
          </div>
        )}
      </div>

      <GrowthProcessCard />
    </section>
  )
}
