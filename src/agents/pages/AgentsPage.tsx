import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { HelpButton } from '@/shared/ui/HelpButton'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { AdminAgentsPanel } from '../components/AdminAgentsPanel'
import { AutonomyPanel } from '../components/AutonomyPanel'
import { AgentConstellation } from '../components/AgentConstellation'
import { AgentPassportCard } from '../components/AgentPassportCard'
import { PlanLists } from '../components/PlanLists'
import { RunTaskForm } from '../components/RunTaskForm'
import { ConsultPanel } from '../components/ConsultPanel'
import { ShiftBoard } from '../components/ShiftBoard'
import { AGENTS } from '../data'
import { AgentId } from '../types'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Не совет директоров',
    body: (
      <p>
        Совет директоров — дерево направлений бизнеса. Здесь — операционная команда из восьми агентов. Это разные
        контуры, поэтому вкладка отдельная.
      </p>
    ),
  },
  {
    title: 'Карта команды',
    body: (
      <p>
        Координатор в центре. Нажмите на роль, чтобы увидеть зону и запреты. Юрист сверху — фильтр: ворованные
        данные конкурентов он блокирует до любого черновика.
      </p>
    ),
  },
  {
    title: 'Смена сама, не чат',
    body: (
      <p>
        Смена идёт сама раз в час. Кнопка «Начать смену» — если нужно прямо сейчас. Одна общая модель читает
        базу, восемь ролей — восемь инструкций. Вам только очередь да/нет.
      </p>
    ),
  },
  {
    title: 'Консультация — один чат',
    body: (
      <p>
        Вкладка «Консультация» — единый разговор, без «нового чата». Если тема сменилась, сервер забывает старую
        нить, чтобы она не попала в базу знаний. У вас на экране переписка остаётся, пока не нажмёте «Очистить чат».
      </p>
    ),
  },
  {
    title: 'Панель администратора',
    body: (
      <p>
        Администратору доступна вкладка «Панель»: живые следы, смены и контракт разметки. Gold — не «агент уже
        обучен».
      </p>
    ),
  },
]

type TabKey = 'shift' | 'consult' | 'team' | 'panel'

function isTab(value: string | null): value is TabKey {
  return value === 'shift' || value === 'consult' || value === 'team' || value === 'panel'
}

export function AgentsPage() {
  const current = useAuthStore((s) => s.current)
  const isAdmin = current?.role === 'admin'
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const [tab, setTab] = useState<TabKey>(isTab(requested) ? requested : 'shift')
  const [selectedId, setSelectedId] = useState<AgentId>('coordinator')
  const onboarding = useSectionOnboarding('agents')
  const selected = useMemo(() => AGENTS.find((agent) => agent.id === selectedId) ?? AGENTS[0], [selectedId])
  const draftMessage = typeof location.state?.draftMessage === 'string' ? location.state.draftMessage : ''

  useEffect(() => {
    if (!isTab(requested)) return
    if (requested === 'panel' && !isAdmin) return
    setTab(requested)
  }, [requested, isAdmin])

  function changeTab(next: TabKey) {
    setTab(next)
    if (next === 'shift') setSearchParams({})
    else setSearchParams({ tab: next })
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Операционная команда</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
            Агенты<span className="text-brand">.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] text-muted">
            Смена идёт сама. Спросить можно во вкладке «Консультация» — один чат, без новых переписок.
          </p>
        </div>
        <HelpButton onClick={onboarding.show} />
      </div>

      <Tabs
        tabs={[
          { key: 'shift', label: 'Смена' },
          { key: 'consult', label: 'Консультация' },
          { key: 'team', label: 'Команда' },
          ...(isAdmin ? [{ key: 'panel' as const, label: 'Панель' }] : []),
        ]}
        activeKey={tab}
        onChange={changeTab}
      />

      {tab === 'shift' && <ShiftBoard />}

      {tab === 'consult' && <ConsultPanel initialMessage={draftMessage} />}

      {tab === 'team' && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <AgentConstellation selectedId={selectedId} onSelect={setSelectedId} />
            <AgentPassportCard agent={selected} />
          </div>
          <RunTaskForm />
          <section className="rounded-2xl border border-border bg-surface px-5 py-4 sm:px-6">
            <p className="text-[13px] text-ink">
              Юрист не голосует «за идею». Если фильтр дал block — координатор не будит коммерческих специалистов.
              Пример: ворованную или слитую базу конкурента использовать нельзя.
            </p>
          </section>
          <PlanLists />
        </div>
      )}

      {tab === 'panel' && isAdmin && (
        <div className="space-y-8">
          <AutonomyPanel />
          <AdminAgentsPanel />
        </div>
      )}

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Агенты»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
