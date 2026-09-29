import { format } from 'date-fns'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { BlockReadiness, ReadinessState } from '../types'

/** Состояние материалов из оценки готовности (0084-b). Сервер уже вычислил
 * состояние и его подпись; здесь только тон и запасная подпись. */

const READINESS_TONE: Record<ReadinessState, ChipTone> = {
  insufficient_data: 'warning',
  needs_reconciliation: 'warning',
  shortfall: 'danger',
  provided: 'success',
  not_required: 'neutral',
}

export const READINESS_LABEL: Record<ReadinessState, string> = {
  insufficient_data: 'Недостаточно данных',
  needs_reconciliation: 'Нужна сверка',
  shortfall: 'Нехватка материалов',
  provided: 'Материалы обеспечены',
  not_required: 'Материалы не требуются',
}

/** Состояния, при которых по материалам есть что делать человеку. */
export function isProblemState(state: ReadinessState): boolean {
  return state === 'insufficient_data' || state === 'needs_reconciliation' || state === 'shortfall'
}

export function ReadinessBadge({ state, label }: { state: ReadinessState; label?: string }) {
  return <Chip tone={READINESS_TONE[state]}>{label ?? READINESS_LABEL[state]}</Chip>
}

/** «время факта: ДД.ММ ЧЧ:ММ» — последнее изменение входных данных оценки. */
export function FactsTime({ factsAt }: { factsAt: string | null }) {
  return (
    <span className="text-[11px] text-muted">
      {factsAt ? `время факта: ${format(new Date(factsAt), 'dd.MM HH:mm')}` : 'время факта неизвестно'}
    </span>
  )
}

/** «Допущен» / «Ждёт: <блоки>» — по `admitted` и `waiting_on` из оценки сервера. */
export function AdmissionChip({ readiness }: { readiness: BlockReadiness }) {
  return (
    <span
      className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${
        readiness.admitted ? 'bg-brand/10 text-brand-dark' : 'bg-warning/10 text-warning'
      }`}
    >
      {readiness.admitted ? 'Допущен' : `Ждёт: ${readiness.waiting_on.map((w) => w.name).join(', ')}`}
    </span>
  )
}
