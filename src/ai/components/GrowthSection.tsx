import { useEffect } from 'react'
import { Lightbulb } from 'lucide-react'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { useAiStore } from '../store'
import { GrowthProcessCard } from './GrowthProcessCard'
import { GrowthProposalCard } from './GrowthProposalCard'

/** Подраздел «Развитие» в «Марине» — предложения Марины по улучшению бизнеса
 * (задача 0036-b). Сейчас наполняется только демо-сидом на localhost (0036-a);
 * генерация предложений Мариной — вне скоупа. */
export function GrowthSection({ className = '' }: { className?: string }) {
  const proposals = useAiStore((s) => s.growthProposals)
  const loading = useAiStore((s) => s.growthProposalsLoading)
  const loadGrowthProposals = useAiStore((s) => s.loadGrowthProposals)
  const prepareTask = useAiStore((s) => s.prepareGrowthProposalTask)

  useEffect(() => {
    loadGrowthProposals()
  }, [loadGrowthProposals])

  return (
    <section aria-labelledby="growth-proposals-title" className={`flex flex-col gap-4 lg:flex-row ${className}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
        <div>
          <h2 id="growth-proposals-title" className="text-[15px] font-medium text-ink">
            Развитие
          </h2>
          <p className="text-[12px] text-muted">Предложения Марины по улучшению бизнеса</p>
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
