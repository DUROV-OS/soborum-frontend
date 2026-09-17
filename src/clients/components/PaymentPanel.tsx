import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as accountingApi from '@/accounting/api'
import { useAccessLevel } from '@/app/AccessGate'
import { useAuthStore } from '@/auth/store'
import { accessLevelAtLeast } from '@/auth/types'
import { Chip } from '@/shared/ui/Chip'
import { useClientsStore } from '../store'
import { isGroupEditable, isGroupVisible, paymentStageRule } from '../rules'
import { Client } from '../types'
import { Section } from './PanelPrimitives'

function PaymentEditUnlockToggle({ client }: { client: Client }) {
  const setPaymentEditUnlocked = useClientsStore((s) => s.setPaymentEditUnlocked)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setPending(true)
    const result = await setPaymentEditUnlocked(client.id, !client.payment_edit_unlocked)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
    setPending(false)
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={client.payment_edit_unlocked}
        disabled={pending}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-50 ${
          client.payment_edit_unlocked ? 'bg-brand' : 'bg-surface-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            client.payment_edit_unlocked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-[13px] text-ink">Разрешить редактирование</span>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}

export function PaymentPanel({ client }: { client: Client }) {
  const updatePayment = useClientsStore((s) => s.updatePayment)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')
  const locked = client.payment_locked_at !== null
  const editable = isGroupEditable(client, 'payment') && accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const hasAccounting = useAuthStore((s) => s.hasAccess('accounting'))
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [movementId, setMovementId] = useState<number | null>(null)

  if (!isGroupVisible(client, 'payment')) return null

  const rule = paymentStageRule(client.payment_plan)

  async function set(value: boolean) {
    const wasPaid = client.is_paid
    const result = await updatePayment(client.id, value)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
    // 0011-f: is_paid -> true может породить проводку «доход от продажи» —
    // короткое уведомление со ссылкой, необязательное (нет доступа/ошибка — тихо).
    if (result.ok && value && !wasPaid && hasAccounting) {
      accountingApi
        .listMovements({ client_id: client.id, subkind: 'sale_income' })
        .then((movements) => movements[0] && setMovementId(movements[0].id))
        .catch(() => {})
    }
  }

  // Оплата после получения — подтверждать нечего, переход доступен сразу.
  if (!rule.requiresConfirmation) {
    return (
      <Section title="Оплата">
        <Chip tone="info">Подтверждение не требуется</Chip>
        <p className="mt-3 text-[12px] text-muted">{rule.note}</p>
      </Section>
    )
  }

  if (!editable) {
    return (
      <Section title="Оплата">
        <Chip tone={client.is_paid ? 'success' : 'warning'}>
          {client.is_paid ? rule.paidLabel : rule.unpaidLabel}
        </Chip>
        <p className="mt-3 text-[12px] text-muted">{rule.note}</p>
        {locked && isAdmin && <PaymentEditUnlockToggle client={client} />}
      </Section>
    )
  }

  return (
    <Section title="Оплата">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => set(true)}
          className={`rounded-pill px-4 py-2 text-[13px] font-medium transition-colors ${
            client.is_paid === true ? 'bg-success text-white' : 'border border-border text-ink hover:border-success'
          }`}
        >
          {rule.paidLabel}
        </button>
        <button
          type="button"
          onClick={() => set(false)}
          className={`rounded-pill px-4 py-2 text-[13px] font-medium transition-colors ${
            client.is_paid === false ? 'bg-warning text-white' : 'border border-border text-ink hover:border-warning'
          }`}
        >
          {rule.unpaidLabel}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-muted">{rule.note}</p>
      {locked && isAdmin && <PaymentEditUnlockToggle client={client} />}
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
