import { useEffect, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { HelpButton } from '@/shared/ui/HelpButton'
import { KanbanBoard } from '@/shared/ui/KanbanBoard'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { DateFilter, DEFAULT_DATE_FILTER, dateFilterRange, matchesDateFilter } from '@/shared/lib/dateFilter'
import { useClientsStore } from '../store'
import { CLIENT_STAGES } from '../types'
import { CreateClientModal } from '../components/CreateClientModal'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Доска клиентов',
    body: (
      <p>
        Каждая колонка — стадия пути клиента, от первого обращения до принятого дома. Карточка клиента
        находится в той колонке, которая соответствует его текущей стадии. Колонок восемь — доска
        прокручивается вбок.
      </p>
    ),
  },
  {
    title: 'Новый клиент',
    body: (
      <p>
        Кнопка «Новый клиент» в правом верхнем углу открывает форму создания карточки — заполните имя, телефон и
        другие данные. Если клиента привело агентство-партнёр, отметьте это в форме: на карточке появится метка с
        названием агентства, и связь с партнёром не потеряется.
      </p>
    ),
  },
  {
    title: 'Карточка клиента',
    body: (
      <p>
        Кликните по карточке, чтобы открыть детали клиента: там же можно перевести его на следующую стадию,
        добавить заметки и файлы.
      </p>
    ),
  },
  {
    title: 'Последние стадии — сами',
    body: (
      <p>
        «Дом в производстве», «Приёмка» и «Успешно реализовано» вручную не переводятся: клиент переезжает по
        ним сам, следом за ходом работ в разделе «Монтаж».
      </p>
    ),
  },
  {
    title: 'Фильтр по периоду',
    body: (
      <p>
        Фильтр в правом верхнем углу показывает клиентов, обратившихся за выбранный период (день, неделя, месяц,
        год и другие). По умолчанию показывается этот месяц.
      </p>
    ),
  },
]

export function ClientsBoardPage() {
  const clients = useClientsStore((s) => s.clients)
  const loading = useClientsStore((s) => s.loading)
  const load = useClientsStore((s) => s.load)
  const lastAdvancedId = useClientsStore((s) => s.lastAdvancedId)
  const clearLastAdvanced = useClientsStore((s) => s.clearLastAdvanced)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER)
  const onboarding = useSectionOnboarding('clients')
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')

  useEffect(() => {
    load()
  }, [load])

  const advancedStage = clients.find((c) => c.id === lastAdvancedId)?.stage ?? null

  useEffect(() => {
    if (advancedStage) clearLastAdvanced()
  }, [advancedStage, clearLastAdvanced])

  const range = dateFilterRange(dateFilter)
  const filtered = clients.filter((c) => matchesDateFilter(c.created_at, range))

  return (
    <div>
      <SectionAnalyticsCard section="clients" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Клиенты</h1>
          <p className="mt-1 text-[13px] text-muted">Путь клиента от первого обращения до принятого дома</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <DateFilterSelect value={dateFilter} onChange={setDateFilter} />
          {canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Новый клиент
            </Button>
          )}
          <HelpButton onClick={onboarding.show} />
        </div>
      </div>

      <KanbanBoard
        columns={CLIENT_STAGES}
        items={filtered}
        keyOf={(c) => String(c.id)}
        columnOf={(c) => c.stage}
        onCardClick={(c) => navigate(`/clients/${c.id}`)}
        loading={loading}
        focusKey={advancedStage}
        renderCard={(client) => (
          <div>
            <div className="text-[13px] font-medium text-ink">{client.full_name}</div>
            <div className="mt-0.5 text-[12px] text-muted">{client.phone}</div>
            {client.via_agency && (
              <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-pill bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
                <Building2 size={11} className="shrink-0" />
                <span className="truncate">{client.agency_name}</span>
              </div>
            )}
            {client.house_model && (
              <div className="mt-2 text-[12px] text-brand-dark">{client.house_model.title}</div>
            )}
          </div>
        )}
      />

      <CreateClientModal open={creating} onClose={() => setCreating(false)} />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Клиенты»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
