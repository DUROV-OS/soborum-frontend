import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { useAuthStore } from '@/auth/store'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { HelpButton } from '@/shared/ui/HelpButton'
import { KanbanBoard } from '@/shared/ui/KanbanBoard'
import { Input, Select } from '@/shared/ui/Field'
import { DateFilterSelect } from '@/shared/ui/DateFilterSelect'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { DateFilter, dateFilterRange, matchesDateFilter } from '@/shared/lib/dateFilter'
import { useTasksStore } from '../store'
import { TASK_STATES, Task } from '../types'
import { CreateTaskModal } from '../components/CreateTaskModal'
import { MyTasksPanel } from '../components/MyTasksPanel'
import { TaskDetailDrawer } from '../components/TaskDetailDrawer'
import { TaskPeopleBadges } from '../components/TaskPeopleBadges'

type SubTab = 'mine' | 'all'

function isClaimable(task: Task): boolean {
  return task.status === 'ready' && task.assignees.length === 0
}

type SourceFilter = 'all' | 'manual' | 'clients' | 'production' | 'marketing' | 'warehouse'

function sourceOf(task: Task): SourceFilter {
  if (task.block_id !== null) return 'production'
  if (task.link_type === 'client_stage') return 'clients'
  if (task.link_type === 'content_stage') return 'marketing'
  if (task.link_type === 'warehouse_request' || task.link_type === 'warehouse_shortage') return 'warehouse'
  return 'manual'
}

const SOURCE_LABEL: Record<SourceFilter, string> = {
  all: 'Все разделы',
  manual: 'Ручная',
  clients: 'Клиенты',
  production: 'Производство',
  marketing: 'Маркетинг',
  warehouse: 'Склад',
}

const EMPLOYEE_ALL = 'all'
const EMPLOYEE_UNASSIGNED = 'unassigned'

/**
 * Список сотрудников для фильтра строится из фактических исполнителей уже
 * загруженных задач (а не из useAuthStore().accounts — тот список грузится
 * только для admin, см. src/auth/store.ts).
 */
function employeeOptions(tasks: Task[]): { id: number; full_name: string }[] {
  const byId = new Map<number, string>()
  for (const task of tasks) {
    for (const assignee of task.assignees) byId.set(assignee.id, assignee.full_name)
  }
  return Array.from(byId, ([id, full_name]) => ({ id, full_name })).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'ru'),
  )
}

function matchesEmployee(task: Task, employeeFilter: string): boolean {
  if (employeeFilter === EMPLOYEE_ALL) return true
  if (employeeFilter === EMPLOYEE_UNASSIGNED) return task.assignees.length === 0
  const id = Number(employeeFilter)
  return task.assignees.some((a) => a.id === id)
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Мои задачи',
    body: (
      <p>
        Раздел открывается на «Моих задачах» — здесь только то, что касается вас: задачи, где вы исполнитель
        или проверяющий, плюс свободные задачи, которые можно взять в работу.
      </p>
    ),
  },
  {
    title: 'Взять свободную задачу',
    body: (
      <p>
        На карточке свободной задачи есть кнопка «Взять задачу» — вы становитесь исполнителем, и задача
        остаётся на борде уже как ваша.
      </p>
    ),
  },
  {
    title: 'Все задачи',
    body: (
      <p>
        Вкладка «Все задачи» (видна не всем — нужен отдельный доступ) — общий борд по всем разделам и
        пользователям, с поиском по названию и описанию, фильтром по разделу-источнику, по сотруднику
        и по сроку.
      </p>
    ),
  },
  {
    title: 'Новая задача и вопрос ИИ',
    body: (
      <p>
        Кнопка «Новая задача» создаёт ручную задачу. Кнопка «Спросить ИИ» открывает чат с контекстом раздела
        задач. Клик по карточке открывает детали и позволяет сменить статус.
      </p>
    ),
  },
]

export function TasksPage() {
  const tasks = useTasksStore((s) => s.tasks)
  const loading = useTasksStore((s) => s.loading)
  const load = useTasksStore((s) => s.load)
  const claim = useTasksStore((s) => s.claim)
  const canSeeAll = useAuthStore((s) => s.hasAccess('tasks_all'))
  const [creating, setCreating] = useState(false)
  const canEdit = accessLevelAtLeast(useAccessLevel('tasks'), 'edit')
  const [selected, setSelected] = useState<Task | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('mine')
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>(EMPLOYEE_ALL)
  // Борд задач по умолчанию — за всё время: авто-задачи из разделов (смена
  // стадии клиента, контента, нехватка на складе) создаются без дедлайна, и
  // период-фильтр по месяцу их полностью прятал.
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [query, setQuery] = useState('')
  const onboarding = useSectionOnboarding('tasks')

  useEffect(() => {
    if (!canSeeAll && subTab === 'all') setSubTab('mine')
  }, [canSeeAll, subTab])

  useEffect(() => {
    if (subTab !== 'all') setEmployeeFilter(EMPLOYEE_ALL)
  }, [subTab])

  useEffect(() => {
    load({ scope: subTab === 'all' && canSeeAll ? 'all' : 'mine' })
  }, [load, subTab, canSeeAll])

  async function handleClaim(taskId: number) {
    setClaimingId(taskId)
    setClaimError(null)
    const result = await claim(taskId)
    if (!result.ok) setClaimError(result.reason ?? 'Не удалось взять задачу')
    setClaimingId(null)
  }

  const range = dateFilterRange(dateFilter)
  const q = query.trim().toLowerCase()
  const employees = useMemo(() => employeeOptions(tasks), [tasks])
  const filtered = tasks
    .filter((t) => sourceFilter === 'all' || sourceOf(t) === sourceFilter)
    // Нет дедлайна (авто-задачи из разделов) → фильтруем по дате создания,
    // чтобы выбранный период их не терял целиком.
    .filter((t) => matchesDateFilter(t.deadline ?? t.created_at, range))
    .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
    .filter((t) => matchesEmployee(t, employeeFilter))

  return (
    <div>
      <SectionAnalyticsCard section="tasks" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Задачи</h1>
          <p className="mt-1 text-[13px] text-muted">
            {subTab === 'mine' ? 'Назначено на вас и свободные задачи, которые можно взять' : 'Общий борд, включая задачи из других разделов'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <AskAiButton domain="tasks" />
          {canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Новая задача
            </Button>
          )}
          <HelpButton onClick={onboarding.show} />
        </div>
      </div>

      {canSeeAll && (
        <div className="mb-4">
          <Tabs
            tabs={[
              { key: 'mine' as SubTab, label: 'Мои задачи' },
              { key: 'all' as SubTab, label: 'Все задачи' },
            ]}
            activeKey={subTab}
            onChange={setSubTab}
          />
        </div>
      )}

      {subTab === 'mine' && <MyTasksPanel onOpenTask={setSelected} />}

      {subTab === 'mine' && claimError && <p className="mb-3 text-[13px] text-danger">{claimError}</p>}

      {subTab === 'all' && (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию и описанию…"
            className="sm:max-w-xs"
          />
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} className="w-full sm:w-44">
            {Object.entries(SOURCE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="w-full sm:w-48">
            <option value={EMPLOYEE_ALL}>Все сотрудники</option>
            <option value={EMPLOYEE_UNASSIGNED}>Без исполнителя</option>
            {employees.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.full_name}
              </option>
            ))}
          </Select>
          <DateFilterSelect value={dateFilter} onChange={setDateFilter} />
        </div>
      )}

      <KanbanBoard
        columns={TASK_STATES}
        items={subTab === 'mine' ? tasks : filtered}
        keyOf={(t) => String(t.id)}
        columnOf={(t) => t.status}
        onCardClick={setSelected}
        loading={loading}
        renderCard={(task) => (
          <div>
            <div className="text-[13px] font-medium text-ink">{task.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="neutral">{SOURCE_LABEL[sourceOf(task)]}</Chip>
              {task.deadline && (
                <span className="text-[11px] text-muted">{new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
              )}
            </div>
            <div className="mt-1.5">
              <TaskPeopleBadges task={task} />
            </div>
            {subTab === 'mine' && isClaimable(task) && canEdit && (
              <Button
                size="sm"
                className="mt-2 h-7 px-2.5 text-[12px]"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClaim(task.id)
                }}
                disabled={claimingId === task.id}
              >
                {claimingId === task.id ? 'Беру…' : 'Взять задачу'}
              </Button>
            )}
          </div>
        )}
      />

      <CreateTaskModal open={creating} onClose={() => setCreating(false)} />
      <TaskDetailDrawer task={selected} onClose={() => setSelected(null)} />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Задачи»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
