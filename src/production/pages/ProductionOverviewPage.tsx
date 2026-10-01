import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { EmptyState } from '@/shared/ui/EmptyState'
import { HelpButton } from '@/shared/ui/HelpButton'
import { LoadingState } from '@/shared/ui/LoadingState'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { Factory } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { CYCLE_STAGES } from '@/cycles/types'
import * as productionApi from '../api'
import { FactsTime, isProblemState, ReadinessBadge } from '../components/ReadinessBadge'
import { useProductionStore } from '../store'
import { ProductionReadinessListItem } from '../types'

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

  // null — ещё грузится; 'error' — оценку получить не удалось (карточки при
  // этом показываем, но без готовности, а не с выдуманным «всё хорошо»).
  const [readiness, setReadiness] = useState<Map<number, ProductionReadinessListItem> | 'error' | null>(null)

  useEffect(() => {
    loadProductions()
    productionApi
      .listProductionsReadiness()
      .then((items) => setReadiness(new Map(items.map((item) => [item.production_id, item]))))
      .catch(() => setReadiness('error'))
  }, [loadProductions])

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productions.map((production) => (
            <button
              key={production.id}
              type="button"
              onClick={() => navigate(`/production/${production.id}`)}
              className="rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-brand/40"
            >
              <div className="text-[14px] font-medium text-ink">Заказ №{production.cycle_id}</div>
              {production.name !== 'Дом' && (
                <div className="mt-0.5 text-[12px] text-brand-dark">{production.name}</div>
              )}
              <div className="mt-1 text-[12px] text-muted">
                Блоков: {production.block_count} · {CYCLE_STAGES.find((s) => s.key === production.cycle_status)?.label}
              </div>
              <ReadinessLine item={readiness instanceof Map ? readiness.get(production.id) : undefined} failed={readiness === 'error'} />
            </button>
          ))}

        </div>
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

function reasonsWord(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'причина'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'причины'
  return 'причин'
}

/** Колонка «Готовность» карточки производства: бейдж, число причин, время факта. */
function ReadinessLine({ item, failed }: { item?: ProductionReadinessListItem; failed: boolean }) {
  if (!item) {
    return (
      <div className="mt-2 text-[11px] text-muted">
        {failed ? 'Готовность: оценка недоступна' : 'Готовность: загрузка…'}
      </div>
    )
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <ReadinessBadge state={item.materials_state} label={item.materials_label} />
      {isProblemState(item.materials_state) && item.reasons_count > 0 && (
        <span className="text-[12px] text-muted">
          {item.reasons_count} {reasonsWord(item.reasons_count)}
        </span>
      )}
      <FactsTime factsAt={item.facts_at} />
    </div>
  )
}
