import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { Stepper } from '@/shared/ui/Stepper'
import { Chip } from '@/shared/ui/Chip'
import * as cyclesApi from '../api'
import { Cycle, CYCLE_STAGES } from '../types'
import { CLIENT_STAGES } from '@/clients/types'
import { INSTALLATION_STAGES } from '@/montage/types'

export function CycleDetailPage() {
  const { id = '' } = useParams()
  const cycleId = Number(id)
  const [cycle, setCycle] = useState<Cycle | null>(null)

  useEffect(() => {
    cyclesApi.getCycle(cycleId).then(setCycle)
  }, [cycleId])

  if (!cycle) return <p className="text-[13px] text-muted">Загрузка…</p>

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/cycles" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        Все циклы
      </Link>

      <div className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-[18px] font-medium text-ink">{cycle.client?.full_name ?? `Цикл №${cycle.id}`}</h1>
          <AskAiButton
            domain="cycle"
            contextLabel={cycle.client ? `Клиент: ${cycle.client.full_name}` : `Цикл №${cycle.id}`}
            contextNote={`[cycle_id=${cycle.id}${cycle.client ? `, client_id=${cycle.client.id}` : ''}] `}
          />
        </div>
        <Stepper steps={CYCLE_STAGES} currentKey={cycle.status} />
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Клиент">
          {cycle.client ? (
            <>
              <Chip tone="brand">{CLIENT_STAGES.find((s) => s.key === cycle.client!.stage)?.label}</Chip>
              <Row label="Телефон" value={cycle.client.phone} />
              <Row label="Почта" value={cycle.client.email} />
              <LinkRow to={`/clients/${cycle.client.id}`} label="Открыть карточку клиента" />
            </>
          ) : (
            <Empty />
          )}
        </SectionCard>

        <SectionCard title="Производство">
          {cycle.productions && cycle.productions.length > 0 ? (
            <>
              {cycle.productions.length > 1 && (
                <p className="text-[13px] text-ink">{cycle.productions.length} дома в производстве</p>
              )}
              {cycle.productions.map((production) => (
                <div key={production.id} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-muted">
                    {cycle.productions.length > 1 ? production.name : 'Проект'} ·{' '}
                    {production.blocks.length} блок(ов)
                  </span>
                  <LinkRow to={`/production/${production.id}`} label="Открыть" />
                </div>
              ))}
            </>
          ) : (
            <Empty text="Начнётся после стадии «постоплата»" />
          )}
        </SectionCard>

        <SectionCard title="Монтаж">
          {cycle.installation ? (
            <>
              <Chip tone="warning">{INSTALLATION_STAGES.find((s) => s.key === cycle.installation!.stage)?.label}</Chip>
              <LinkRow to={`/montage/${cycle.installation.id}`} label="Открыть монтаж" />
            </>
          ) : (
            <Empty text="Начнётся после завершения производства" />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-3 text-[14px] font-medium text-ink">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}

function LinkRow({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-brand-dark hover:underline">
      {label}
      <ArrowRight size={13} />
    </Link>
  )
}

function Empty({ text = 'Пока нет данных' }: { text?: string }) {
  return <p className="text-[13px] text-muted">{text}</p>
}
