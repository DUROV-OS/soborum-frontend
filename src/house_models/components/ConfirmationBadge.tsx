import { Chip, ChipTone } from '@/shared/ui/Chip'
import { HouseModelConfirmation } from '../types'

const TONE: Record<HouseModelConfirmation, ChipTone> = {
  confirmed: 'success',
  partial: 'warning',
  none: 'danger',
}

const SHORT_LABEL: Record<HouseModelConfirmation, string> = {
  confirmed: '✅ подтверждено',
  partial: '⚠ частично',
  none: '❌ нет опыта',
}

/** Короткий бейдж для списка — как в сводной таблице MOC_Models источника.
 * Полная формулировка (`confirmation_label`) показывается на детальной карточке. */
export function ConfirmationBadge({ confirmation }: { confirmation: HouseModelConfirmation }) {
  return <Chip tone={TONE[confirmation]}>{SHORT_LABEL[confirmation]}</Chip>
}
