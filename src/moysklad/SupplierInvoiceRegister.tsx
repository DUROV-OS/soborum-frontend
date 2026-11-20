import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import type { DataTableColumn } from '@/shared/ui/DataTable'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { journalDate, journalMoney } from '@/purchasing/JournalControls'

export type InvoiceFields = {
  number: string
  agent_name: string | null
  counterparty_id: number | null
  warehouse: string | null
  currency: string | null
  amount: string | null
  paid: string | null
  accepted: string | null
  planned_payment_date: string | null
  incoming_number: string | null
  incoming_date: string | null
  comment: string | null
  status_code: string
  status_label: string
  automatic_label: string
  status_id: number | null
  status_version: number
  can_change_status: boolean
}

export type InvoiceStatus = { id: number; code: string | null; label: string; version: number }

type InvoiceRow = {
  id: number
  title: string
  moment?: string
  agent?: string
  state: string | null
  invoice?: InvoiceFields
}

export type ReceivedFactureFields = {
  number: string
  agent_name: string | null
  counterparty_id: number | null
  organization: string | null
  amount: string | null
  currency: string | null
  incoming_number: string | null
  incoming_date: string | null
  comment: string | null
}

const quantityStyle = 'whitespace-nowrap tabular-nums'
const standardLink = 'font-medium text-brand-dark underline underline-offset-2 hover:text-brand'
const value = (text?: string | null) => text || '—'
const amount = (value?: string | null, currency?: string | null) => {
  if (value == null) return '—'
  if (currency) return journalMoney(Number(value), currency)
  return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function receivedFactureColumns<Row extends InvoiceRow & { facture?: ReceivedFactureFields }>(
  open: (row: Row) => void,
): DataTableColumn<Row>[] {
  return [
    { header: '№', className: 'whitespace-nowrap', accessor: row => (
      <button type="button" className={standardLink}
        onClick={event => { event.stopPropagation(); open(row) }}>{row.facture?.number || row.title}</button>
    ) },
    { header: 'Дата', className: 'whitespace-nowrap', accessor: row => journalDate(row.moment?.slice(0, 10)) },
    { header: 'Контрагент', className: 'min-w-[170px]', accessor: row => {
      const name = value(row.facture?.agent_name || row.agent)
      return row.facture?.counterparty_id ? (
        <Link className={standardLink} to={`/suppliers?counterparty=${row.facture.counterparty_id}`}
          onClick={event => event.stopPropagation()}>{name}</Link>
      ) : name
    } },
    { header: 'Организация', className: 'min-w-32', accessor: row => value(row.facture?.organization) },
    { header: 'Сумма', className: quantityStyle, align: 'right', accessor: row => amount(row.facture?.amount, row.facture?.currency) },
    { header: 'Входящий номер', className: 'whitespace-nowrap', accessor: row => value(row.facture?.incoming_number) },
    { header: 'Входящая дата', className: 'whitespace-nowrap', accessor: row => journalDate(row.facture?.incoming_date) },
    { header: 'Комментарий', className: 'min-w-[180px] max-w-xs', accessor: row => (
      <span className="line-clamp-2" title={row.facture?.comment || ''}>{value(row.facture?.comment)}</span>
    ) },
  ]
}

export function invoiceColumns<Row extends InvoiceRow>(
  statuses: InvoiceStatus[],
  open: (row: Row) => void,
  change: (row: Row, status: number | null) => void,
  savingId: number | null,
): DataTableColumn<Row>[] {
  const moneyColumn = (header: string, field: 'amount' | 'paid' | 'accepted'): DataTableColumn<Row> => ({
    header, align: 'right', className: quantityStyle,
    accessor: row => amount(row.invoice?.[field], row.invoice?.currency),
  })
  const manual = statuses.filter(status => status.code === null || status.code === 'waiting')
  return [
    { header: '№ счета', className: 'whitespace-nowrap', accessor: row => <button type="button" className={standardLink}
      onClick={event => { event.stopPropagation(); open(row) }}>{row.invoice?.number || row.title}</button> },
    { header: 'Дата', className: 'whitespace-nowrap', accessor: row => journalDate(row.moment) },
    { header: 'Контрагент', className: 'min-w-[170px]', accessor: row => row.invoice?.counterparty_id ?
      <Link className={standardLink} to={`/suppliers?counterparty=${row.invoice.counterparty_id}`}
        onClick={event => event.stopPropagation()}>{value(row.invoice.agent_name)}</Link> : value(row.invoice?.agent_name || row.agent) },
    { header: 'На склад', accessor: row => value(row.invoice?.warehouse), className: 'min-w-32' },
    moneyColumn('Сумма', 'amount'),
    moneyColumn('Оплачено', 'paid'),
    moneyColumn('Принято', 'accepted'),
    { header: 'Плановая дата оплаты', accessor: row => journalDate(row.invoice?.planned_payment_date), className: 'whitespace-nowrap' },
    { header: 'Входящий номер', accessor: row => value(row.invoice?.incoming_number), className: 'whitespace-nowrap' },
    { header: 'Входящая дата', accessor: row => journalDate(row.invoice?.incoming_date), className: 'whitespace-nowrap' },
    { header: 'Статус', className: 'min-w-44', accessor: row => {
      const invoice = row.invoice
      if (!invoice?.can_change_status) {
        return <Chip tone={invoice?.status_code === 'paid' ? 'success' : 'neutral'}>{value(invoice?.status_label || row.state)}</Chip>
      }
      return <div onClick={event => event.stopPropagation()}>
        <Select aria-label={`Статус счёта № ${invoice.number}`}
          disabled={savingId !== null} value={invoice.status_id || ''}
          onChange={e => change(row, Number(e.target.value) || null)}>
          <option value="">{invoice.automatic_label} · автоматически</option>
          {manual.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}
        </Select>
      </div>
    } },
    { header: 'Комментарий', className: 'min-w-40 max-w-xs', accessor: row =>
      <span className="line-clamp-2 whitespace-pre-wrap break-words" title={row.invoice?.comment || undefined}>{value(row.invoice?.comment)}</span> },
  ]
}

export function InvoiceStatusSettings({ statuses, close, saved }: {
  statuses: InvoiceStatus[]
  close: () => void
  saved: () => void
}) {
  const [id, setId] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = statuses.find(status => String(status.id) === id)
  async function save() {
    if (busy || !label.trim()) return
    setBusy(true)
    setError('')
    try {
      await apiRequest<InvoiceStatus>({
        section: 'moysklad', path: '/supplier-invoice-statuses' + (editing ? `/${editing.id}` : ''),
        method: editing ? 'PATCH' : 'POST',
        body: editing ? { label, version: editing.version } : { label },
      })
      saved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return <Modal open onClose={() => { if (!busy) close() }} title="Статусы счетов поставщиков" footer={<>
    <Button variant="secondary" disabled={busy} onClick={close}>Отмена</Button>
    <Button disabled={busy || !label.trim() || label.trim() === editing?.label} onClick={() => void save()}>
      {editing ? 'Переименовать' : 'Добавить'}
    </Button>
  </>}>
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <Field label="Статус"><Select aria-label="Статус для настройки" value={id} disabled={busy} onChange={event => {
        setId(event.target.value)
        setLabel(statuses.find(status => String(status.id) === event.target.value)?.label || '')
        setError('')
      }}>
        <option value="">Новый статус</option>
        {statuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}
      </Select></Field>
      <Field label="Название"><Input aria-label="Название статуса" maxLength={64} value={label}
        disabled={busy} onChange={e => setLabel(e.target.value)} /></Field>
      <p className="text-xs text-muted">Переименование применяется ко всем счетам с этим статусом. Суммы оплаты определяются по документам.</p>
    </div>
  </Modal>
}
