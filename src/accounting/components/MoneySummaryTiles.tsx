import { StatWidget } from '@/shared/ui/StatWidget'
import { MoneyTotals } from '../types'

/** Рубли без копеек: в сводке важен порядок величины, а не копейка. */
export function rubles(amount: number): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`
}

/**
 * Приход / расход / сальдо за выбранный период (0081-b). Расход всегда красный,
 * сальдо — красное, только когда ушло больше, чем пришло.
 */
export function MoneySummaryTiles({
  totals,
  loading,
  hint,
}: {
  totals: MoneyTotals | null
  loading: boolean
  hint?: string
}) {
  const income = totals?.income ?? 0
  const expense = totals?.expense ?? 0
  const balance = totals?.balance ?? 0
  const placeholder = loading && !totals ? '…' : null

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatWidget label="Приход" value={placeholder ?? rubles(income)} tone="success" hint={hint} />
      <StatWidget label="Расход" value={placeholder ?? rubles(expense)} tone="danger" hint={hint} />
      <StatWidget
        label="Сальдо"
        value={placeholder ?? rubles(balance)}
        tone={balance < 0 ? 'danger' : 'neutral'}
        hint={hint ?? 'Приход минус расход'}
      />
    </div>
  )
}
