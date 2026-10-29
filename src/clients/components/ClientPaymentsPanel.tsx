import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMovements } from '@/accounting/api'
import { ASSESSMENT_LABEL, STATUS_LABEL, type MoneyMovement } from '@/accounting/types'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { type Client } from '../types'
import { Section } from './PanelPrimitives'

const DISPLAY_LIMIT = 100

function money(amount: number, currency: string) {
  const value = amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value} ${currency === 'RUB' ? '₽' : currency}`
}

function dateLabel(value: string | null) {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : date.toLocaleDateString('ru-RU')
}

/** Показывает только операции, явно привязанные к клиенту. Сверка с банком,
 * возвраты и другие непривязанные платежи требуют отдельной проверки. */
export function ClientPaymentsPanel({ client }: { client: Client }) {
  const hasAccounting = useAuthStore(s => s.hasAccess('accounting'))
  const userId = useAuthStore(s => s.current?.id)
  const [rows, setRows] = useState<MoneyMovement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)

  const load = useCallback(async () => {
    const request = ++sequence.current
    if (!hasAccounting || !userId) { setRows(null); setError(null); setBusy(false); return }
    setRows(null)
    setBusy(true)
    setError(null)
    try {
      const result = await listMovements({ client_id: client.id, subkind: 'sale_income', limit: DISPLAY_LIMIT + 1 })
      if (request === sequence.current) setRows(result)
    } catch {
      if (request === sequence.current) setError('Не удалось загрузить платежи. Проверьте подключение и повторите попытку.')
    } finally {
      if (request === sequence.current) setBusy(false)
    }
  }, [client.id, client.is_paid, client.balance_paid, hasAccounting, userId])

  useEffect(() => {
    void load()
    return () => { sequence.current++ }
  }, [load])

  if (!hasAccounting) return null
  const shown = rows?.slice(0, DISPLAY_LIMIT) ?? []
  const totals = new Map<string, number>()
  for (const row of shown) {
    if (row.status === 'posted' && row.assessment === 'actual' && row.direction === 'income') {
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + Math.round(Number(row.amount) * 100))
    }
  }
  const unverifiedMark = rows && rows.length <= DISPLAY_LIMIT && totals.size === 0 && (client.is_paid || client.balance_paid)

  return <div id="client-payments"><Section title="Платежи в бухгалтерии">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-muted">Операции, привязанные к этому клиенту. Непривязанные платежи и возвраты требуют сверки.</p>
      <Button size="sm" variant="ghost" onClick={() => void load()} disabled={busy}>Обновить</Button>
    </div>
    {busy && <p role="status" className="mt-3 text-[13px] text-muted">Загружаем платежи…</p>}
    {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
    {rows && <div className="mt-3 space-y-3">
      {rows.length === 0 ? <p className="text-[13px] text-muted">Привязанных операций пока нет.</p> : <>
        <div className="rounded-md bg-surface-muted p-3 text-[13px]">
          <p className="font-medium">Проведённые фактические поступления{rows.length > DISPLAY_LIMIT ? ' среди показанных' : ''}</p>
          {totals.size ? [...totals].map(([currency, cents]) => <p key={currency} className="mt-1 tabular-nums">{money(cents / 100, currency)}</p>) : <p className="mt-1 text-muted">Нет проведённых фактических поступлений</p>}
        </div>
        {rows.length > DISPLAY_LIMIT && <p className="text-[12px] text-muted">Показаны последние {DISPLAY_LIMIT} операций; полный реестр доступен в бухгалтерии.</p>}
        <div className="space-y-2">{shown.map(row => <Link key={row.id} to={`/accounting?movement=${row.id}`} className="block rounded-md border border-border p-3 hover:border-brand/40">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"><span>{dateLabel(row.doc_date ?? row.posted_at ?? row.created_at)} · {STATUS_LABEL[row.status]}</span><span className="font-medium tabular-nums">{money(Number(row.amount), row.currency)}</span></div>
          <p className="mt-1 text-[12px] text-muted">{ASSESSMENT_LABEL[row.assessment]}{row.account_name ? ` · ${row.account_name}` : ''}</p>
        </Link>)}</div>
      </>}
      {unverifiedMark && <p className="rounded-md bg-warning-bg p-3 text-[13px] text-warning">В карточке отмечена оплата, но проведённых фактических поступлений среди привязанных операций нет. Сверьте отметку с бухгалтерией.</p>}
    </div>}
  </Section></div>
}
