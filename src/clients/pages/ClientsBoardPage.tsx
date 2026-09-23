import { useEffect, useState } from 'react'
import { AlertTriangle, Building2, CalendarClock, Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { HelpButton } from '@/shared/ui/HelpButton'
import { KanbanBoard } from '@/shared/ui/KanbanBoard'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { DateFilter, DEFAULT_DATE_FILTER, dateFilterRange, matchesDateFilter } from '@/shared/lib/dateFilter'
import { useClientsStore } from '../store'
import { deadlineLabel, nearestOpenTask } from '../taskDeadline'
import { Client, CLIENT_STAGES } from '../types'
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
    title: 'Поиск клиента',
    body: (
      <p>
        Строка поиска вверху находит клиента по фамилии, имени или номеру телефона — сразу по всем стадиям и
        без ограничения периодом. Телефон можно вводить в любом виде: «+7 900 …», «8 900 …» или последние
        цифры.
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
  const searchResults = useClientsStore((s) => s.searchResults)
  const searching = useClientsStore((s) => s.searching)
  const runSearch = useClientsStore((s) => s.search)
  const [query, setQuery] = useState('')
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

  // Поиск идёт по всем стадиям и без ограничения периодом — иначе «найти
  // среди всех сразу» не работает: по умолчанию доска показывает только
  // текущий месяц (0079-f).
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const range = dateFilterRange(dateFilter)
  const filtered =
    searchResults ?? clients.filter((c) => matchesDateFilter(c.created_at, range))

  return (
    <div>
      <SectionAnalyticsCard section="clients" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Клиенты</h1>
          <p className="mt-1 text-[13px] text-muted">Путь клиента от первого обращения до принятого дома</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фамилия или телефон"
              aria-label="Поиск клиента по фамилии или телефону"
              className="w-56 pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-pill p-1 text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>
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

      {searchResults !== null && (
        <p className="mb-3 text-[12px] text-muted">
          Поиск идёт по всем стадиям и не зависит от выбранного периода. Найдено: {searchResults.length}.
        </p>
      )}

      <KanbanBoard
        columns={CLIENT_STAGES}
        items={filtered}
        keyOf={(c) => String(c.id)}
        columnOf={(c) => c.stage}
        onCardClick={(c) => navigate(`/clients/${c.id}`)}
        loading={loading || searching}
        focusKey={advancedStage}
        renderCard={(client) => <ClientCard client={client} />}
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

/** Карточка на доске: кто клиент, откуда пришёл и что по нему горит.
 * Ближайшая открытая задача со сроком — то самое «уведомление» о клиенте,
 * которое видно, не открывая карточку (0079-e). */
function ClientCard({ client }: { client: Client }) {
  const task = nearestOpenTask(client.tasks)
  const due = task ? deadlineLabel(task.deadline) : null
  const dueTone = due?.overdue ? 'text-danger' : due?.urgent ? 'text-brand-dark' : 'text-muted'

  return (
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
      {task && (
        <div className={`mt-2 flex items-start gap-1 text-[12px] ${dueTone}`}>
          {due?.overdue ? (
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          ) : (
            <CalendarClock size={12} className="mt-0.5 shrink-0" />
          )}
          <span>
            {task.title}
            {due && ` — ${due.text}`}
          </span>
        </div>
      )}
    </div>
  )
}
