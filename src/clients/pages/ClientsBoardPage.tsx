import { useEffect, useState } from 'react'
import { AlertTriangle, Building2, CalendarClock, Contact, Globe, Plus, Search, User, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { HelpButton } from '@/shared/ui/HelpButton'
import { KanbanBoard } from '@/shared/ui/KanbanBoard'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { DateFilter, dateFilterRange, matchesDateFilter } from '@/shared/lib/dateFilter'
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
    title: 'Заявки с сайта',
    body: (
      <p>
        Заявка, оставленная на сайте, сама становится лидом: карточка подсвечена меткой «Новая заявка с сайта», а в
        заголовке колонки «Лид» виден счётчик необработанных. Откройте карточку и нажмите «Взять в работу» — или просто
        поставьте задачу, напишите клиенту или переведите его на следующую стадию: подсветка снимется сама.
      </p>
    ),
  },
  {
    title: 'Новый клиент',
    body: (
      <p>
        Кнопка «Новый клиент» в правом верхнем углу открывает форму создания карточки — заполните имя, телефон и
        другие данные. Если клиента привёл риэлтор, агентство или другой партнёр, выберите его в поле «Кто
        рекомендовал» — из базы партнёров. На карточке появится метка, а у партнёра — этот клиент в списке
        приведённых.
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
        По умолчанию доска показывает всех клиентов — путь клиента идёт месяцами, и обрезать его по дате
        обращения незачем. Фильтр в правом верхнем углу оставляет только обратившихся за выбранный период
        (день, неделя, месяц, год и другие).
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
  // Не DEFAULT_DATE_FILTER («этот месяц»): клиент живёт месяцами — лид из
  // августа всё ещё лид, а дом в производстве идёт полгода. С месячным
  // фильтром по умолчанию доска обнулялась первого числа, пока в новом месяце
  // не появится первое обращение (0085). Фильтр остаётся как инструмент.
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [now, setNow] = useState(() => new Date())
  const onboarding = useSectionOnboarding('clients')
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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
  const matching = searchResults ?? clients.filter((c) => matchesDateFilter(c.created_at, range))
  const filtered = matching.filter((client) => {
    if (taskFilter === 'all') return true
    if (client.stage === 'completed') return false
    const task = nearestOpenTask(client.tasks)
    if (taskFilter === 'no_task') return !task
    const due = task && deadlineLabel(task.deadline, now)
    if (taskFilter === 'overdue') return Boolean(due?.overdue)
    if (taskFilter === 'today') return Boolean(due?.urgent && !due.overdue)
    return true
  })

  // Счётчик необработанных заявок с сайта (0111-b) — в заголовке колонки «Лид»,
  // считается по видимым карточкам: поиск и фильтр по периоду его не обманывают.
  const unprocessed = filtered.filter((c) => c.lead_unprocessed).length
  const columns = CLIENT_STAGES.map((stage) =>
    stage.key === 'lead' && unprocessed > 0
      ? {
          ...stage,
          badge: (
            <span
              title="Новые заявки с сайта, которые ещё не взяты в работу"
              className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-medium text-white"
            >
              {unprocessed} нов.
            </span>
          ),
        }
      : stage,
  )

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
          <Select aria-label="Фильтр задач по клиентам" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
            <option value="all">Все клиенты</option>
            <option value="no_task">Без открытой задачи</option>
            <option value="overdue">Есть просрочка</option>
            <option value="today">Задачи сегодня</option>
          </Select>
          <Link
            to="/partners"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-brand/40 px-4 text-sm text-brand hover:border-brand hover:bg-brand/5"
          >
            <Contact size={16} />
            База партнёров
          </Link>
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
          Поиск идёт по всем стадиям и не зависит от выбранного периода. Показано: {filtered.length}.
        </p>
      )}

      <KanbanBoard
        columns={columns}
        items={filtered}
        keyOf={(c) => String(c.id)}
        columnOf={(c) => c.stage}
        onCardClick={(c) => navigate(`/clients/${c.id}`)}
        loading={loading || searching}
        focusKey={advancedStage}
        cardClassName={(c) =>
          c.lead_unprocessed
            ? 'border-brand bg-brand/5 ring-1 ring-brand/30 hover:border-brand-dark'
            : undefined
        }
        renderCard={(client) => <ClientCard client={client} now={now} />}
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
function ClientCard({ client, now }: { client: Client; now: Date }) {
  const task = nearestOpenTask(client.tasks)
  const due = task ? deadlineLabel(task.deadline, now) : null
  const dueTone = due?.overdue ? 'text-danger' : due?.urgent ? 'text-brand-dark' : 'text-muted'

  return (
    <div>
      {client.lead_unprocessed && (
        <div className="mb-1.5 inline-flex items-center gap-1 rounded-pill bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
          <Globe size={11} className="shrink-0" />
          Новая заявка с сайта
        </div>
      )}
      <div className="text-[13px] font-medium text-ink">{client.full_name}</div>
      <div className="mt-0.5 text-[12px] text-muted">{client.phone || client.email}</div>
      {/* Ответственный менеджер (0080-a) — адресат уведомлений по клиенту,
          виден сразу на доске, не только в карточке. */}
      <div className="mt-2 flex max-w-full items-center gap-1 text-[11px] text-muted">
        <User size={11} className="shrink-0" />
        <span className="truncate">Менеджер: {client.manager?.full_name ?? 'не назначен'}</span>
      </div>
      {client.referrer && (
        <div className="mt-2 flex max-w-full items-center gap-1 text-[11px] text-muted">
          <Contact size={11} className="shrink-0" />
          <span className="truncate">Рекомендовал: {client.referrer.name}</span>
        </div>
      )}
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
      {!task && client.stage !== 'completed' && (
        <div className="mt-2 flex items-center gap-1 text-[12px] text-warning"><AlertTriangle size={12} />Нет открытой задачи</div>
      )}
    </div>
  )
}
