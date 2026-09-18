import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { EmptyState } from '@/shared/ui/EmptyState'
import { HelpButton } from '@/shared/ui/HelpButton'
import { LoadingState } from '@/shared/ui/LoadingState'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { CheckCircle2, Factory } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { CYCLE_STAGES } from '@/cycles/types'
import { useProductionStore } from '../store'
import { ProductionCriticality, ProductionListItem } from '../types'

const CRITICALITY_ORDER: Record<ProductionCriticality, number> = { critical: 0, warning: 1, normal: 2 }

const CRITICALITY_ACCENT: Record<ProductionCriticality, string> = {
  critical: 'border-l-4 border-l-danger',
  warning: 'border-l-4 border-l-warning',
  normal: '',
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Активные производства',
    body: (
      <p>
        Здесь собраны все запущенные производства — карточки появляются автоматически, как только клиент
        доходит до стадии «постоплата» в разделе «Клиенты».
      </p>
    ),
  },
  {
    title: 'Блоки производства',
    body: (
      <p>
        Кликните по карточке, чтобы открыть производство: внутри — направленный граф блоков (этапов
        производства), их порядок, зависимости и материалы, нужные для сборки каждого блока.
      </p>
    ),
  },
]

export function ProductionOverviewPage() {
  const productions = useProductionStore((s) => s.productions)
  const loading = useProductionStore((s) => s.loading)
  const loadProductions = useProductionStore((s) => s.loadProductions)
  const error = useProductionStore((s) => s.error)
  const navigate = useNavigate()
  const onboarding = useSectionOnboarding('production')

  useEffect(() => {
    loadProductions()
  }, [loadProductions])

  const current = productions
    .filter((p) => !p.is_completed)
    .sort((a, b) => CRITICALITY_ORDER[a.criticality] - CRITICALITY_ORDER[b.criticality])
  const completed = productions.filter((p) => p.is_completed)

  return (
    <div>
      <SectionAnalyticsCard section="production" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Производство</h1>
          <p className="mt-1 text-[13px] text-muted">Блоки и материалы по каждому запущенному производству</p>
        </div>
        <HelpButton onClick={onboarding.show} />
      </div>

      {error ? (
        <EmptyState title="Не удалось загрузить производства" description={error}
          action={<Button onClick={() => loadProductions()}>Повторить</Button>} />
      ) : loading && productions.length === 0 ? (
        <LoadingState label="Загружаем производства…" />
      ) : productions.length === 0 ? (
        <EmptyState
          icon={<Factory size={28} />}
          title="Производств пока нет"
          description="Они появляются автоматически, когда клиент доходит до стадии «постоплата»."
        />
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-3 text-[15px] font-medium text-ink">Текущие производства</h2>
            {current.length === 0 ? (
              <EmptyState
                icon={<Factory size={24} />}
                title="Активных производств пока нет"
                description="Новые появляются автоматически, когда клиент доходит до стадии «постоплата»."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {current.map((production) => (
                  <ProductionCard key={production.id} production={production}
                    accentClassName={CRITICALITY_ACCENT[production.criticality]}
                    onClick={() => navigate(`/production/${production.id}`)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Завершённые производства</h2>
            {completed.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={24} />}
                title="Завершённых производств пока нет"
                description="Производство переходит сюда, когда закрыты все задачи по всем его блокам."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((production) => (
                  <ProductionCard key={production.id} production={production} muted
                    onClick={() => navigate(`/production/${production.id}`)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Производство»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}

function ProductionCard({
  production,
  onClick,
  accentClassName = '',
  muted = false,
}: {
  production: ProductionListItem
  onClick: () => void
  /** Левая цветная полоса по критичности — только для карточек блока «Текущие». */
  accentClassName?: string
  /** Приглушённый вид для завершённых — без акцента критичности. */
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-brand/40 ${accentClassName} ${
        muted ? 'opacity-70' : ''
      }`}
    >
      <div className={`font-medium text-ink ${muted ? 'text-[13px]' : 'text-[14px]'}`}>
        Заказ №{production.cycle_id}
      </div>
      {production.name !== 'Дом' && <div className="mt-0.5 text-[12px] text-brand-dark">{production.name}</div>}
      <div className="mt-1 text-[12px] text-muted">
        Блоков: {production.block_count} · {CYCLE_STAGES.find((s) => s.key === production.cycle_status)?.label}
      </div>
    </button>
  )
}
