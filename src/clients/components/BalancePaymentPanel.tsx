import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as accountingApi from '@/accounting/api'
import { useAccessLevel } from '@/app/AccessGate'
import { useAuthStore } from '@/auth/store'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { Input } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { BALANCE_STATE_LABEL, BalanceState, Client, ClientStage, planHasBalance } from '../types'
import { Section } from './PanelPrimitives'

const BALANCE_STATE_TONE: Record<BalanceState, ChipTone> = {
  not_applicable: 'neutral',
  no_due_date: 'warning',
  pending: 'info',
  overdue: 'danger',
  paid: 'success',
}

/** Стадии, на которых уже известен формат расчёта и можно договориться о
 * сроке остатка (0084-j): от «Ипотеки/Одобрения» до «Приёмки». */
const DUE_DATE_STAGES: ClientStage[] = ['approval', 'payment', 'postpayment', 'acceptance']

/** Срок оплаты остатка по договору (0084-j): вводится вручную. Без срока —
 * «Срок оплаты не указан», просрочка — только после срока. */
function BalanceDueDateField({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const updateBalanceDueDate = useClientsStore((s) => s.updateBalanceDueDate)
  const [value, setValue] = useState(client.balance_due_date ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = canEdit && !client.balance_paid
  const changed = value !== (client.balance_due_date ?? '')

  async function save() {
    setSaving(true)
    const result = await updateBalanceDueDate(client.id, value || null)
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить срок')
  }

  return (
    <div className="mt-3">
      <div className="mb-1 text-[12px] text-muted">Срок оплаты остатка</div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {changed && (
            <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить срок'}
            </Button>
          )}
        </div>
      ) : (
        <span className="text-[13px] text-ink">
          {client.balance_due_date ? new Date(`${client.balance_due_date}T00:00:00`).toLocaleDateString('ru-RU') : '—'}
        </span>
      )}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

/**
 * Остаток после получения дома — только для форматов расчёта с остатком
 * (аванс + оплата после получения / оплата после получения). Для полной
 * предоплаты блок не показывается. Срок остатка (0084-j) задают с
 * «Ипотеки/Одобрения» по «Приёмку»; принять остаток — на стадии «Постоплата».
 * Пока остаток не принят, бэкенд не даёт завершить цикл (кнопка завершения
 * монтажа вернёт 400 с причиной).
 */
export function BalancePaymentPanel({ client }: { client: Client }) {
  const markBalancePayment = useClientsStore((s) => s.markBalancePayment)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const hasAccounting = useAuthStore((s) => s.hasAccess('accounting'))
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementId, setMovementId] = useState<number | null>(null)

  if (!DUE_DATE_STAGES.includes(client.stage) || !planHasBalance(client.payment_plan)) return null
  const canAccept = client.stage === 'postpayment'

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
        <Chip tone={BALANCE_STATE_TONE[client.balance_state]}>{BALANCE_STATE_LABEL[client.balance_state]}</Chip>
        {client.balance_paid && client.balance_paid_at && (
          <span className="text-[12px] text-muted">
            {new Date(client.balance_paid_at).toLocaleDateString('ru-RU')}
          </span>
        )}
        {!client.balance_paid && balanceDue != null && (
          <span className="text-[12px] text-muted">К приёму: {balanceDue.toLocaleString('ru-RU')} ₽</span>
        )}
      </div>

      <BalanceDueDateField key={client.balance_due_date ?? ''} client={client} canEdit={canEdit} />

      {!client.balance_paid && canAccept && (
        <>
          <p className="mt-3 text-[12px] text-muted">
            Пока остаток не принят, завершить цикл нельзя — кнопка завершения монтажа будет недоступна.
          </p>
          {canEdit && (
            <div className="mt-4">
              <Button size="sm" onClick={markPaid} disabled={saving}>
                {saving ? 'Сохранение…' : 'Отметить приём остатка'}
              </Button>
            </div>
          )}
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
