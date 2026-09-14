import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as accountingApi from '@/accounting/api'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { useClientsStore } from '../store'
import { Client, planHasBalance } from '../types'
import { Section } from './PanelPrimitives'

/**
 * Приём остатка после получения дома — только на стадии «Постоплата» и только
 * для форматов расчёта с остатком (аванс + оплата после получения / оплата
 * после получения). Для полной предоплаты блок не показывается.
 * Пока остаток не принят, бэкенд не даёт завершить цикл (кнопка завершения
 * монтажа вернёт 400 с причиной).
 */
export function BalancePaymentPanel({ client }: { client: Client }) {
  const markBalancePayment = useClientsStore((s) => s.markBalancePayment)
  const hasAccounting = useAuthStore((s) => s.hasAccess('accounting'))
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementId, setMovementId] = useState<number | null>(null)

  if (client.stage !== 'postpayment' || !planHasBalance(client.payment_plan)) return null

  const balanceDue =
    client.payment_plan === 'advance_then_balance' && client.final_price != null && client.advance_amount != null
      ? client.final_price - client.advance_amount
      : client.final_price

  async function markPaid() {
    setSaving(true)
    const result = await markBalancePayment(client.id)
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось отметить приём остатка')
    // 0011-f: balance_paid -> true может породить проводку «доход от продажи».
    if (result.ok && hasAccounting) {
      accountingApi
        .listMovements({ client_id: client.id, subkind: 'sale_income' })
        .then((movements) => movements[0] && setMovementId(movements[0].id))
        .catch(() => {})
    }
  }

  return (
    <Section title="Оплата после получения">
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={client.balance_paid ? 'success' : 'warning'}>
          {client.balance_paid ? 'Остаток принят' : 'Остаток не принят'}
        </Chip>
        {client.balance_paid && client.balance_paid_at && (
          <span className="text-[12px] text-muted">
            {new Date(client.balance_paid_at).toLocaleDateString('ru-RU')}
          </span>
        )}
        {!client.balance_paid && balanceDue != null && (
          <span className="text-[12px] text-muted">К приёму: {balanceDue.toLocaleString('ru-RU')} ₽</span>
        )}
      </div>

      {!client.balance_paid && (
        <>
          <p className="mt-3 text-[12px] text-muted">
            Пока остаток не принят, завершить цикл нельзя — кнопка завершения монтажа будет недоступна.
          </p>
          <div className="mt-4">
            <Button size="sm" onClick={markPaid} disabled={saving}>
              {saving ? 'Сохранение…' : 'Отметить приём остатка'}
            </Button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {movementId && (
        <button
          type="button"
          onClick={() => navigate(`/accounting?movement=${movementId}`)}
          className="mt-2 text-[12px] text-brand hover:text-brand-dark"
        >
          Создана проводка в «Бухгалтерии» →
        </button>
      )}
    </Section>
  )
}
