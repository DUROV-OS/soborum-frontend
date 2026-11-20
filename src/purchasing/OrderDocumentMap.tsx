import { ArrowUpRight, ClipboardList, FileCheck2, FileText, PackageCheck, RotateCcw, Wallet, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { journalDate, journalMoney } from './JournalControls'

type DocumentSummary = {
  number: string
  date: string | null
  amount: string | number | null
  currency: string | null
}

type OrderDocument = DocumentSummary & { id: number; status?: string | null }

export type LinkedDocuments = {
  invoices?: OrderDocument[]
  receipts: {
    id: number
    number: string
    occurred_at: string
    status: string
    via_supplier_invoice?: boolean
    lines: { quantity: number; unit_price: number }[]
  }[]
  payments: (Omit<DocumentSummary, 'number' | 'date'> & {
    id: number | null
    number: string | null
    created_at?: string
    date?: string | null
    status: string
    refund: boolean
    source_record_id?: number
    source_type?: 'paymentout' | 'cashout'
    invoice_ids?: number[]
  })[]
  factures?: (OrderDocument & { receipt_ids: number[] })[]
  returns: {
    id: number
    number: string
    receipt_id: number
    occurred_at: string
    amount: number
    currency: string
    cancelled: boolean
  }[]
  opening_paid: number
}

type Card = DocumentSummary & {
  id: string
  href: string
  status?: string | null
  evidence?: string
}

const paymentStatus: Record<string, string> = {
  draft: 'На согласовании',
  approved: 'Согласован',
  posted: 'Проведён',
  cancelled: 'Отменён',
}

function money(amount: Card['amount'], currency: Card['currency']) {
  if (amount === null) return 'Сумма не указана'
  return currency ? journalMoney(Number(amount), currency) : Number(amount).toLocaleString('ru-RU')
}

export function OrderDocumentMap({ order, documents, confirmLeave }: {
  order: Card
  documents: LinkedDocuments
  confirmLeave: () => boolean
}) {
  const invoices = documents.invoices ?? []
  const receiptNumber = (id: number) => documents.receipts.find(receipt => receipt.id === id)?.number
  const invoiceNumber = (id: number) => invoices.find(invoice => invoice.id === id)?.number
  const paymentCards = documents.payments.map(row => {
    const numbers = row.invoice_ids?.map(invoiceNumber).filter(Boolean) ?? []
    return {
      ...row, id: 'payment-' + (row.source_record_id !== undefined ? 'source-' + row.source_record_id : row.id),
      number: row.number || (row.id === null ? 'Без номера' : String(row.id)),
      date: row.date ?? row.created_at ?? null, status: paymentStatus[row.status] || row.status,
      evidence: numbers.length ? 'К счёту № ' + numbers.join(', ') : undefined,
      href: row.id !== null ? `/accounting?tab=register&workspace=purchasing&movement=${row.id}`
        : `/moysklad?type=${row.source_type}&workspace=purchasing&record=${row.source_record_id}`,
    }
  })
  const stages: { title: string; icon: LucideIcon; cards: Card[]; empty: string }[] = [
    { title: 'Заказ поставщику', icon: ClipboardList, cards: [order], empty: '' },
    {
      title: 'Счета поставщика', icon: FileText, empty: 'Счетов по заказу нет',
      cards: invoices.map(row => ({ ...row, id: 'invoice-' + row.id, href: `/moysklad?type=invoicein&record=${row.id}` })),
    },
    {
      title: 'Исходящие платежи', icon: Wallet, empty: 'Связанных платежей нет',
      cards: paymentCards.filter(row => !row.refund),
    },
    {
      title: 'Приёмки', icon: PackageCheck, empty: 'Приёмок по заказу нет',
      cards: documents.receipts.map(row => ({
        id: 'receipt-' + row.id, number: row.number, date: row.occurred_at, currency: order.currency,
        amount: row.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0),
        status: row.status === 'posted' ? 'Проведена' : row.status === 'draft' ? 'Черновик' : row.status,
        evidence: row.via_supplier_invoice ? 'Связана через счёт' : undefined,
        href: `/purchasing?tab=receipts&receipt=${row.id}`,
      })),
    },
    {
      title: 'Счета-фактуры полученные', icon: FileCheck2, empty: 'Счета-фактуры не привязаны',
      cards: (documents.factures ?? []).map(row => ({
        ...row, id: 'facture-' + row.id, href: `/moysklad?type=facturein&record=${row.id}`,
        evidence: 'К приёмке № ' + row.receipt_ids.map(receiptNumber).filter(Boolean).join(', '),
      })),
    },
  ]
  if (documents.returns.length) stages.push({
    title: 'Возвраты поставщику', icon: RotateCcw, empty: '',
    cards: documents.returns.map(row => ({
      ...row, id: 'return-' + row.id, date: row.occurred_at,
      status: row.cancelled ? 'Отменён' : 'Проведён',
      evidence: receiptNumber(row.receipt_id) ? 'К приёмке № ' + receiptNumber(row.receipt_id) : undefined,
      href: `/purchasing?tab=returns&return=${row.id}`,
    })),
  })
  const refunds = paymentCards.filter(row => row.refund)
  if (refunds.length) stages.push({ title: 'Возвраты денег', icon: Wallet, cards: refunds, empty: '' })

  return (
    <section aria-label="Связанные документы заказа" className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        {stages.map(({ title, icon: Icon, cards, empty }) => (
          <section key={title} aria-label={title} className="min-w-0 space-y-2">
            <h3 className="flex min-h-9 items-start gap-2 text-xs font-semibold text-muted">
              <Icon size={17} className="shrink-0 text-brand" aria-hidden /> <span>{title}</span>
            </h3>
            {cards.map(card => (
              <Link key={card.id} to={card.href}
                onClick={event => { if (card.id !== order.id && !confirmLeave()) event.preventDefault() }}
                className="group flex aspect-square min-h-36 flex-col gap-2 rounded-xl border border-border border-t-2 border-t-brand/65 bg-surface p-3 text-ink shadow-sm transition-colors hover:border-brand hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <span className="flex min-w-0 items-start justify-between gap-1">
                  <span className="break-words font-semibold text-brand-dark">{card.number === 'Без номера' ? card.number : '№ ' + card.number}</span>
                  <ArrowUpRight size={16} className="shrink-0 text-brand" aria-hidden />
                </span>
                <span className="text-xs text-muted">{journalDate(card.date)}</span>
                <span className="break-words font-semibold tabular-nums">{money(card.amount, card.currency)}</span>
                {card.evidence && <span className="break-words text-xs text-muted">{card.evidence}</span>}
                {card.status && <span className="mt-auto rounded-md bg-surface-muted px-2 py-1 text-xs font-medium">{card.status}</span>}
              </Link>
            ))}
            {!cards.length && <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted">{empty}</p>}
          </section>
        ))}
      </div>
      {!!documents.opening_paid && (
        <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted">
          Оплата, сохранённая в заказе на дату переноса — {journalMoney(documents.opening_paid, order.currency ?? 'RUB')}.
        </p>
      )}
    </section>
  )
}
