import type { ReactNode } from 'react'
import { ArrowRight, MessageSquare, Send, Wrench } from 'lucide-react'
import { Chip } from '@/shared/ui/Chip'
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, FeedbackEvent, FeedbackRequest } from '../types'

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Лента разбора заявки (0090): «Заявка отправлена», смены статуса,
 * комментарии администратора и изменения в системе — по порядку.
 * `highlightNew` — сколько последних записей не от автора подсветить как новые.
 */
export function FeedbackTimeline({ request, highlightNew = 0 }: { request: FeedbackRequest; highlightNew?: number }) {
  const fromOthers = request.events.filter((e) => e.author.id !== request.author.id)
  const fresh = new Set((highlightNew > 0 ? fromOthers.slice(-highlightNew) : []).map((e) => e.id))

  return (
    <ol className="flex flex-col gap-3">
      <TimelineRow icon={<Send size={13} />} date={request.created_at} who={request.author.full_name}>
        <span className="text-ink">Заявка отправлена</span>
      </TimelineRow>
      {request.events.map((event) => (
        <EventRow key={event.id} event={event} fresh={fresh.has(event.id)} />
      ))}
    </ol>
  )
}

function EventRow({ event, fresh }: { event: FeedbackEvent; fresh: boolean }) {
  if (event.kind === 'status' && event.old_status && event.new_status) {
    return (
      <TimelineRow icon={<ArrowRight size={13} />} date={event.created_at} who={event.author.full_name} fresh={fresh}>
        <span className="inline-flex flex-wrap items-center gap-1.5 text-ink">
          Статус:
          <Chip tone={FEEDBACK_STATUS_TONE[event.old_status]}>{FEEDBACK_STATUS_LABEL[event.old_status]}</Chip>
          <ArrowRight size={12} className="text-muted" />
          <Chip tone={FEEDBACK_STATUS_TONE[event.new_status]}>{FEEDBACK_STATUS_LABEL[event.new_status]}</Chip>
        </span>
      </TimelineRow>
    )
  }
  const isChange = event.kind === 'change'
  return (
    <TimelineRow
      icon={isChange ? <Wrench size={13} /> : <MessageSquare size={13} />}
      date={event.created_at}
      who={event.author.full_name}
      fresh={fresh}
    >
      <div
        className={`mt-1 rounded-xl p-3 text-[13px] ${isChange ? 'border border-success/30 bg-success-bg' : 'bg-surface-muted'}`}
      >
        {isChange && <p className="mb-1 text-[12px] font-medium text-success">Изменение в системе</p>}
        <p className="whitespace-pre-wrap text-ink">{event.text}</p>
      </div>
    </TimelineRow>
  )
}

function TimelineRow({
  icon,
  date,
  who,
  fresh = false,
  children,
}: {
  icon: ReactNode
  date: string
  who: string
  fresh?: boolean
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-surface-muted text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
          <span>{formatDate(date)}</span>
          <span>·</span>
          <span>{who}</span>
          {fresh && <Chip tone="brand">Новое</Chip>}
        </p>
        <div className="mt-0.5">{children}</div>
      </div>
    </li>
  )
}
