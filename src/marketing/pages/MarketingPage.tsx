import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { HelpButton } from '@/shared/ui/HelpButton'
import { KanbanBoard } from '@/shared/ui/KanbanBoard'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { DateFilter, DEFAULT_DATE_FILTER, dateFilterRange, matchesDateFilter } from '@/shared/lib/dateFilter'
import { useMarketingStore } from '../store'
import { CONTENT_STAGES, ContentItem } from '../types'
import { CalendarView } from '../components/CalendarView'
import { CreateContentModal } from '../components/CreateContentModal'
import { ContentDetailDrawer } from '../components/ContentDetailDrawer'
import { TrendExplorer } from '../components/TrendExplorer'

type View = 'calendar' | 'stages' | 'trends'

const VIEW_SUBTITLE: Record<View, string> = {
  calendar: 'Календарь выпуска контента',
  stages: 'Контент по стадиям подготовки',
  trends: 'Динамика популярности запросов, как в Google Trends',
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Календарь контента',
    body: (
      <p>
        По умолчанию раздел показывает календарь выпуска контента с датами публикаций. Переключитесь на вкладку
        «По стадиям», чтобы увидеть контент в виде доски по этапам подготовки.
      </p>
    ),
  },
  {
    title: 'Новый контент',
    body: (
      <p>
        Кнопка «Новый контент» в правом верхнем углу открывает форму создания карточки: название, дата выхода и
        описание.
      </p>
    ),
  },
  {
    title: 'Детали и вопрос ИИ',
    body: (
      <p>
        Клик по карточке в календаре или на доске открывает подробности контента. Кнопка «Спросить ИИ» откроет
        чат с контекстом раздела маркетинга.
      </p>
    ),
  },
  {
    title: 'Фильтр по периоду',
    body: (
      <p>
        На доске «По стадиям» фильтр по дате выхода показывает контент за выбранный период (день, неделя, месяц,
        год и другие). По умолчанию показывается этот месяц.
      </p>
    ),
  },
  {
    title: 'Тренд',
    body: (
      <p>
        Вкладка «Тренд» строит графики популярности запросов по данным Google Trends: динамика во времени,
        распределение по регионам и похожие запросы. Введите до пяти запросов через запятую, чтобы сравнить их.
        Ниже — блок «Тренды ниши»: готовый срез спроса по модульным домам, регионам России и набирающим темам.
      </p>
    ),
  },
]

export function MarketingPage() {
  const items = useMarketingStore((s) => s.items)
  const load = useMarketingStore((s) => s.load)
  const [view, setView] = useState<View>('calendar')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<ContentItem | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER)
  const onboarding = useSectionOnboarding('marketing')
  const canEdit = accessLevelAtLeast(useAccessLevel('marketing'), 'edit')

  useEffect(() => {
    load()
  }, [load])

  const range = dateFilterRange(dateFilter)
  const filtered = items.filter((i) => matchesDateFilter(i.planned_release_date, range))

  return (
    <div>
      <SectionAnalyticsCard section="marketing" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Маркетинг</h1>
          <p className="mt-1 text-[13px] text-muted">{VIEW_SUBTITLE[view]}</p>
        </div>
        <div className="flex gap-2 self-start">
          <AskAiButton domain="marketing" />
          {view !== 'trends' && canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Новый контент
            </Button>
          )}
          <HelpButton onClick={onboarding.show} />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { key: 'calendar', label: 'Календарь' },
            { key: 'stages', label: 'По стадиям' },
            { key: 'trends', label: 'Тренд' },
          ]}
          activeKey={view}
          onChange={setView}
        />
        {view === 'stages' && <DateFilterSelect value={dateFilter} onChange={setDateFilter} />}
      </div>

      {view === 'trends' ? (
        <TrendExplorer />
      ) : view === 'calendar' ? (
        <CalendarView items={items} onSelect={setSelected} />
      ) : (
        <KanbanBoard
          columns={CONTENT_STAGES}
          items={filtered}
          keyOf={(i) => String(i.id)}
          columnOf={(i) => i.stage}
          onCardClick={setSelected}
          renderCard={(item) => (
            <div>
              <div className="text-[13px] font-medium text-ink">{item.title}</div>
              {item.planned_release_date && (
                <div className="mt-1 text-[12px] text-muted">
                  {new Date(item.planned_release_date).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          )}
        />
      )}

      <CreateContentModal open={creating} onClose={() => setCreating(false)} />
      <ContentDetailDrawer item={selected} onClose={() => setSelected(null)} />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Маркетинг»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
