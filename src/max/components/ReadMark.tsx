import { Check, CheckCheck } from 'lucide-react'
import { MaxReadStatus } from '../types'

/** Галочки прочтения исходящего сообщения MAX (0101): одна — отправлено,
 * две акцентные — прочитано. Без статуса ничего не рисует. */
export function ReadMark({ status }: { status?: MaxReadStatus | null }) {
  if (status === 'read') {
    return (
      <span title="Прочитано" aria-label="Прочитано" className="inline-flex align-[-2px] text-brand">
        <CheckCheck size={13} />
      </span>
    )
  }
  if (status === 'sent') {
    return (
      <span title="Отправлено, ещё не прочитано" aria-label="Не прочитано" className="inline-flex align-[-2px] text-muted">
        <Check size={13} />
      </span>
    )
  }
  return null
}
