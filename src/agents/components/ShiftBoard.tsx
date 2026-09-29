import { useEffect } from 'react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { AGENT_WATCHES, AGENTS } from '../data'
import { useAgentsStore } from '../store'
import { AgentId, AgentShift, ShiftApproval, ShiftChart, ShiftItem, ShiftReview } from '../types'

function titleOf(id: AgentId) {
  return AGENTS.find((agent) => agent.id === id)?.title ?? id
}

function citationTitle(raw: string) {
  const title = raw.split(' (')[0]?.trim() ?? ''
  if (!title || title.includes('не дал профильного')) return ''
  return title
}

function twoSentences(text: string) {
  const parts = text.match(/[^.!?…]+[.!?…]?/g) ?? [text]
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
}

function chartsFor(agentId: AgentId, charts: ShiftChart[]) {
  return charts.filter((chart) => (chart.agents ?? []).includes(agentId) && chart.bars.length > 0)
}

function liveStance(agentId: AgentId, charts: ShiftChart[]) {
  return chartsFor(agentId, charts)
    .map((chart) => chart.lead)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
}

function readableStance(item: ShiftItem, charts: ShiftChart[]) {
  const live = liveStance(item.agent_id, chartsFor(item.agent_id, charts))
  if (live) return live
  if (!/По запросу|Опираюсь на:|Не моё:/.test(item.stance)) return twoSentences(item.stance)
  const note = citationTitle(item.citations[0] ?? '')
  if (item.agent_id === 'lawyer') {
    return 'Ворованную базу конкурента нельзя. Договор без вас не выпускаем.'
  }
  if (!note) return 'Живого факта нет — сделки и остатки не выдумываю.'
  return `В пакете: «${note}».`
}

function cardNotes(item: ShiftItem, charts: ShiftChart[]) {
  // Графики смены строит бэкенд из собственной базы DurovOS (connectors.live_charts),
  // а не из amoCRM/МойСклад — не подписываем чужой источник.
  if (chartsFor(item.agent_id, charts).length) return ['база DurovOS']
  return item.citations.map(citationTitle).filter(Boolean).slice(0, 2)
}

function approvalTitle(approval: ShiftApproval) {
  if (approval.kind === 'pricing' || /финансист|цен/i.test(approval.title)) return 'Цена и скидка — только вы'
  if (approval.kind === 'legal' || /юрист/i.test(approval.title)) return 'Юрист просит вас посмотреть'
  return approval.title
}

function readableSummary(shift: AgentShift) {
  const pending = shift.approvals.filter((item) => item.status === 'pending').length
  if (/Смена:|escalate_human|Движок:|шаблон \+ vault|сверилась с базой/.test(shift.summary)) {
    return pending ? `Вам решить ${pending} вопрос.` : 'Сейчас от вас ничего не нужно.'
  }
  return twoSentences(shift.summary)
}

function readableReview(text: string, escalate: boolean, status?: ShiftReview['status']) {
  if (!status) return 'Не проверено.'
  if (status === 'not_checked') return text || 'Не проверено.'
  if (/legal gate|вердикт|allow|block/i.test(text)) {
    return escalate
      ? 'Юрист отправил это в очередь: без вашего «да» действие не выпускаем.'
      : 'Юрист посмотрел: стоп-факторов нет. Ворованную базу конкурента по-прежнему нельзя.'
  }
  if (text.includes('Не моё:')) return 'Посмотрел черновик и своего стоп-фактора не нашёл.'
  if (/автономной цены|скидка сверх/i.test(text)) {
    return 'Нельзя самому ставить окончательную цену или скидку больше 5%. Это решает человек.'
  }
  return text.replace(/\s+\S+\.md\S*/g, '').trim()
}

function approvalDetail(approval: ShiftApproval) {
  if (approval.kind === 'pricing' || /финансист|цен/i.test(approval.title)) {
    return 'Финансист не даёт продажнику самому ставить окончательную цену или скидку больше 5%. Пока нет вашего «да» или «нет», цена клиенту не едет.'
  }
  return approval.detail
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function nextCheckLabel(shift: AgentShift) {
  const next = shift.next_tick_at ? new Date(shift.next_tick_at) : null
  if (!next || Number.isNaN(next.getTime())) return 'Следующая сверка сама, примерно через час.'
  const minutes = Math.max(1, Math.round((next.getTime() - Date.now()) / 60000))
  if (minutes >= 60) return `Следующая сверка сама, примерно через ${Math.round(minutes / 60)} ч.`
  return `Следующая сверка сама, примерно через ${minutes} мин.`
}

export function ShiftBoard() {
  const current = useAuthStore((s) => s.current)
  const isAdmin = current?.role === 'admin'
  const shift = useAgentsStore((s) => s.shift)
  const shiftLoading = useAgentsStore((s) => s.shiftLoading)
  const shiftError = useAgentsStore((s) => s.shiftError)
  const loadShift = useAgentsStore((s) => s.loadShift)
  const startShift = useAgentsStore((s) => s.startShift)

  useEffect(() => {
    void loadShift()
    const timer = window.setInterval(() => void loadShift(), 30000)
    return () => window.clearInterval(timer)
  }, [loadShift])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">Команда работает сама</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink">
              Сверка сама раз в час. Вас зовут только из‑за денег, договора или кадра.
            </p>
          </div>
          {isAdmin && (
            <Button type="button" disabled={shiftLoading} onClick={() => void startShift()}>
              {shiftLoading ? 'Смена идёт…' : 'Начать смену'}
            </Button>
          )}
        </div>
        {shift && (
          <p className="mt-3 text-[12px] text-muted">
            Последняя сверка {formatWhen(shift.created_at)}. {nextCheckLabel(shift)}
          </p>
        )}
      </section>

      {shiftError && <p className="text-[13px] text-danger">{shiftError}</p>}
      {shiftLoading && !shift && <LoadingState label="Команда сверяется с базой…" />}

      {!shiftLoading && !shift && !shiftError && (
        <EmptyState
          title="Первая сверка ещё идёт"
          description={
            isAdmin
              ? 'Можно подождать час или нажать «Начать смену».'
              : 'Как только команда допишет, здесь появится очередь и карточки.'
          }
        />
      )}

      {shift && (
        <>
          <p className="text-[13px] leading-relaxed text-ink">{readableSummary(shift)}</p>
          <ApprovalQueue shift={shift} canDecide={isAdmin} />
          <section>
            <h2 className="mb-3 text-[18px] font-semibold tracking-tight text-ink">Что каждый посмотрел</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {shift.items.map((item) => (
                <ShiftCard key={item.id} item={item} charts={shift.charts ?? []} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function approvalStatusLabel(status: ShiftApproval['status']) {
  if (status === 'pending') return 'ждёт вас'
  if (status === 'approved') return 'Согласовано · не исполнено'
  return 'Отклонено'
}

function ApprovalQueue({ shift, canDecide }: { shift: AgentShift; canDecide: boolean }) {
  const decideApproval = useAgentsStore((s) => s.decideApproval)
  const approvalError = useAgentsStore((s) => s.approvalError)
  const pending = shift.approvals.filter((item) => item.status === 'pending')
  const done = shift.approvals.filter((item) => item.status !== 'pending')

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Что решить вам</h2>
        <p className="mt-1 text-[12px] text-muted">Нет карточки — ничего нажимать не нужно.</p>
        {approvalError && <p className="mt-2 text-[12px] text-danger">{approvalError}</p>}
      </div>
      {shift.approvals.length === 0 ? (
        <div className="px-5 py-6 sm:px-6">
          <EmptyState title="Сейчас от вас ничего не нужно" description="Команда держит смену сама." />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {pending.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} canDecide={canDecide} onDecide={decideApproval} />
          ))}
          {done.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} canDecide={false} onDecide={decideApproval} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ApprovalRow({
  approval,
  canDecide,
  onDecide,
}: {
  approval: ShiftApproval
  canDecide: boolean
  onDecide: (id: number, status: 'approved' | 'rejected', subjectHash: string) => Promise<void>
}) {
  const subjectHash = approval.subject_hash ?? ''
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-ink">{approvalTitle(approval)}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{approvalDetail(approval)}</p>
        </div>
        <Chip tone={approval.status === 'pending' ? 'warning' : approval.status === 'approved' ? 'info' : 'danger'}>
          {approvalStatusLabel(approval.status)}
        </Chip>
      </div>
      {approval.status === 'approved' && (
        <p className="mt-2 text-[12px] text-muted">Исполнитель согласований появится в P1 — сейчас ничего не выполняется.</p>
      )}
      {canDecide && approval.status === 'pending' && !subjectHash && (
        <p className="mt-3 text-[12px] text-muted">
          У пункта нет снимка того, что согласуется, — решение примем на следующей смене.
        </p>
      )}
      {canDecide && approval.status === 'pending' && subjectHash && (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={() => void onDecide(approval.id, 'approved', subjectHash)}>
            Да
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void onDecide(approval.id, 'rejected', subjectHash)}
          >
            Нет
          </Button>
        </div>
      )}
    </li>
  )
}

function formatChartValue(value: number, unit: string) {
  if (unit === '₽') return `${Math.round(value).toLocaleString('ru-RU')} ₽`
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`
}

function barColor(chart: ShiftChart, value: number) {
  if (value < 0 || chart.tone === 'danger') return 'bg-[rgb(var(--danger))]'
  if (chart.tone === 'warning') return 'bg-[rgb(var(--warning))]'
  if (chart.tone === 'timber' || chart.unit === '₽') return 'bg-[rgb(var(--timber))]'
  return 'bg-[rgb(var(--brand))]'
}

function MiniChart({ chart }: { chart: ShiftChart }) {
  const bars = chart.bars.slice(0, 6)
  const max = Math.max(...bars.map((bar) => Math.abs(bar.value)), 1)
  return (
    <div className="rounded-xl border border-border bg-[rgb(var(--surface-muted))] px-3.5 py-3">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[12px] font-semibold leading-tight text-ink">{chart.title}</p>
        <p className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted">{chart.unit}</p>
      </div>
      <ul className="mt-3 space-y-2">
        {bars.map((bar) => (
          <li key={`${chart.id}-${bar.label}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] text-ink">{bar.label}</span>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink">
                {formatChartValue(bar.value, chart.unit)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${barColor(chart, bar.value)}`}
                style={{ width: `${Math.max(10, (Math.abs(bar.value) / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ShiftCard({ item, charts }: { item: ShiftItem; charts: ShiftChart[] }) {
  const disagreements = item.reviews.filter((review) => review.escalate)
  const notes = cardNotes(item, charts)
  const mine = chartsFor(item.agent_id, charts)
  // Позицию написал Claude без живого факта из базы — это не данные системы.
  const withoutFacts = item.stance_source === 'llm_without_facts' && !liveStance(item.agent_id, mine)
  return (
    <article className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold text-ink">{titleOf(item.agent_id)}</h3>
          <Chip tone={disagreements.length ? 'warning' : 'success'}>
            {disagreements.length ? 'спросил вас' : 'держит сам'}
          </Chip>
        </div>
        <p className="mt-1 text-[12px] text-muted">{AGENT_WATCHES[item.agent_id]}</p>
      </div>
      <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-ink sm:px-6">
        <p>{readableStance(item, charts)}</p>
        {withoutFacts && (
          <p>
            <Chip tone="warning">без данных из системы</Chip>
          </p>
        )}
        {mine.length > 0 && (
          <div className="space-y-2">
            {mine.map((chart) => (
              <MiniChart key={chart.id} chart={chart} />
            ))}
          </div>
        )}
        {notes.length > 0 && <p className="text-[12px] text-muted">Из базы: {notes.join(', ')}</p>}
        {item.reviews.length > 0 && (
          <ul className="space-y-2 border-t border-border pt-3">
            {item.reviews.map((review, index) => (
              <li key={`${review.reviewer}-${index}`} className="text-[12px] leading-relaxed">
                <span className={review.escalate ? 'font-medium text-warning' : 'text-muted'}>
                  {titleOf(review.reviewer as AgentId)}
                  {review.escalate ? ' не согласен' : ' посмотрел'}
                  {': '}
                </span>
                <span className="text-ink">
                  {twoSentences(readableReview(review.text, review.escalate, review.status))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
