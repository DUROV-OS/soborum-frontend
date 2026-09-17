import { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SectionAnalyticsCard } from '@/ai/components/SectionAnalyticsCard'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { EmptyState } from '@/shared/ui/EmptyState'
import { HelpButton } from '@/shared/ui/HelpButton'
import { LoadingState } from '@/shared/ui/LoadingState'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { useMontageStore } from '../store'
import { INSTALLATION_STAGES } from '../types'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Производства, готовые к монтажу',
    body: (
      <p>
        Список содержит все производства, по которым уже можно начинать монтаж на объекте клиента.
      </p>
    ),
  },
  {
    title: 'Начать монтаж',
    body: (
      <p>
        Пока монтаж не запущен, у строки есть кнопка «Начать монтаж» — нажмите её, чтобы создать монтажную
        карточку для этого клиента.
      </p>
    ),
  },
  {
    title: 'Ход монтажа',
    body: (
      <p>
        После старта появляется бейдж со стадией монтажа, а кнопка «Открыть» ведёт в детальную карточку — там
        отмечаются доставка, установка и проработка на объекте.
      </p>
    ),
  },
]

export function MontageOverviewPage() {
  const cycles = useMontageStore((s) => s.cycles)
  const loading = useMontageStore((s) => s.loading)
  const loadCycles = useMontageStore((s) => s.loadCycles)
  const start = useMontageStore((s) => s.start)
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onboarding = useSectionOnboarding('installation')
  const canEdit = accessLevelAtLeast(useAccessLevel('installation'), 'edit')

  useEffect(() => {
    loadCycles()
  }, [loadCycles])

  const ready = cycles.filter((c) => c.production)

  async function handleStart(cycleId: number) {
    setBusyId(cycleId)
    const result = await start(cycleId)
    setBusyId(null)
    setError(result.ok ? null : result.reason ?? 'Не удалось начать монтаж')
  }

  return (
    <div>
      <SectionAnalyticsCard section="installation" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Монтаж</h1>
          <p className="mt-1 text-[13px] text-muted">Доставка, установка и проработка на объекте клиента</p>
        </div>
        <HelpButton onClick={onboarding.show} />
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}

      {loading && cycles.length === 0 ? (
        <LoadingState label="Загружаем производства для монтажа…" />
      ) : ready.length === 0 ? (
        <EmptyState icon={<Truck size={28} />} title="Пока нет производств для монтажа" />
      ) : (
        <div className="flex flex-col gap-3">
          {ready.map((cycle) => (
            <div key={cycle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
              <div>
                <div className="text-[14px] font-medium text-ink">{cycle.client?.full_name ?? `Цикл №${cycle.id}`}</div>
                {cycle.installation && (
                  <Chip tone="brand">{INSTALLATION_STAGES.find((s) => s.key === cycle.installation!.stage)?.label}</Chip>
                )}
              </div>
              {cycle.installation ? (
                <Button size="sm" variant="secondary" onClick={() => navigate(`/montage/${cycle.installation!.id}`)}>
                  Открыть
                </Button>
              ) : canEdit ? (
                <Button size="sm" disabled={busyId === cycle.id} onClick={() => handleStart(cycle.id)}>
                  {busyId === cycle.id ? 'Запуск…' : 'Начать монтаж'}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Монтаж»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
