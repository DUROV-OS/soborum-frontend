import { ChevronRight, ClipboardList, FileCheck2, FileText, PackageCheck, RotateCcw, Wallet, type LucideIcon } from 'lucide-react'
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

type DocumentStage = { title: string; destination: string; icon: LucideIcon }
type Stage = DocumentStage & { cards: Card[]; empty?: string }

export const documentStages = {
  order: { title: 'Заказ поставщику', destination: 'Заказы поставщикам → Позиции', icon: ClipboardList },
  invoice: { title: 'Счет поставщика', destination: 'Счета поставщиков', icon: FileText },
  payment: { title: 'Исходящий платеж', destination: 'Деньги', icon: Wallet },
  receipt: { title: 'Приемка', destination: 'Приёмки', icon: PackageCheck },
  facture: { title: 'Счет-фактура полученный', destination: 'Счета-фактуры полученные', icon: FileCheck2 },
  return: { title: 'Возврат поставщику', destination: 'Возвраты поставщикам', icon: RotateCcw },
  refund: { title: 'Возврат денег', destination: 'Деньги', icon: Wallet },
} satisfies Record<string, DocumentStage>

export type RelatedDocument = OrderDocument & {
  kind: keyof typeof documentStages
  source_type?: 'paymentout' | 'cashout'
}

export function RelatedDocumentCards({ documents }: { documents: RelatedDocument[] }) {
  const stages: Stage[] = []
  for (const kind of Object.keys(documentStages) as RelatedDocument['kind'][]) {
    const cards = documents.filter(row => row.kind === kind).map(row => {
      const routes = {
        order: `/purchasing?tab=orders&order=${row.id}`,
        invoice: `/moysklad?type=invoicein&record=${row.id}`,
        payment: row.source_type ? `/moysklad?type=${row.source_type}&workspace=purchasing&record=${row.id}`
          : `/accounting?tab=register&workspace=purchasing&movement=${row.id}`,
        receipt: `/purchasing?tab=receipts&receipt=${row.id}`,
        facture: `/moysklad?type=facturein&record=${row.id}`,
        return: `/purchasing?tab=returns&return=${row.id}`,
        refund: `/accounting?tab=register&workspace=purchasing&movement=${row.id}`,
      }
      return { ...row, id: `${kind}-${row.source_type ?? 'native'}-${row.id}`, href: routes[kind] }
    })
    if (cards.length) stages.push({ ...documentStages[kind], cards })
  }
  return stages.length ? <DocumentCardGrid stages={stages} />
    : <p className="rounded-lg border border-dashed border-border p-4 text-muted">Связанных документов пока нет.</p>
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
  const stages: Stage[] = [
    { ...documentStages.order, cards: [order] },
    {
      ...documentStages.invoice, empty: 'Счетов по заказу нет',
      cards: invoices.map(row => ({ ...row, id: 'invoice-' + row.id, href: `/moysklad?type=invoicein&record=${row.id}` })),
    },
    {
      ...documentStages.payment, empty: 'Связанных платежей нет',
      cards: paymentCards.filter(row => !row.refund),
    },
    {
      ...documentStages.receipt, empty: 'Приёмок по заказу нет',
      cards: documents.receipts.map(row => ({
        id: 'receipt-' + row.id, number: row.number, date: row.occurred_at, currency: order.currency,
        amount: row.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_price), 0),
        status: row.status === 'posted' ? 'Проведена' : row.status === 'draft' ? 'Черновик' : row.status,
        evidence: row.via_supplier_invoice ? 'Связана через счёт' : undefined,
        href: `/purchasing?tab=receipts&receipt=${row.id}`,
      })),
    },
    {
      ...documentStages.facture, empty: 'Счета-фактуры не привязаны',
      cards: (documents.factures ?? []).map(row => ({
        ...row, id: 'facture-' + row.id, href: `/moysklad?type=facturein&record=${row.id}`,
        evidence: 'К приёмке № ' + row.receipt_ids.map(receiptNumber).filter(Boolean).join(', '),
      })),
    },
  ]
  if (documents.returns.length) stages.push({
    ...documentStages.return,
    cards: documents.returns.map(row => ({
      ...row, id: 'return-' + row.id, date: row.occurred_at,
      status: row.cancelled ? 'Отменён' : 'Проведён',
      evidence: receiptNumber(row.receipt_id) ? 'К приёмке № ' + receiptNumber(row.receipt_id) : undefined,
      href: `/purchasing?tab=returns&return=${row.id}`,
    })),
  })
  const refunds = paymentCards.filter(row => row.refund)
  if (refunds.length) stages.push({ ...documentStages.refund, cards: refunds })

  return (
    <section aria-label="Связанные документы заказа" className="space-y-4">
      <DocumentCardGrid stages={stages} currentId={order.id} confirmLeave={confirmLeave} />
      {!!documents.opening_paid && (
        <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted">
          Оплата, сохранённая в заказе на дату переноса — {journalMoney(documents.opening_paid, order.currency ?? 'RUB')}.
        </p>
      )}
    </section>
  )
}

function DocumentCardGrid({ stages, currentId, confirmLeave }: { stages: Stage[]; currentId?: string; confirmLeave?: () => boolean }) {
  return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,146px),1fr))] gap-3 lg:gap-4">
        {stages.map(({ title, destination, icon: Icon, cards, empty }) => (
          <section key={title} aria-label={title} className="min-w-0 space-y-2">
            {cards.map(card => (
              <Link key={card.id} to={card.href}
                onClick={event => { if (card.id !== currentId && confirmLeave && !confirmLeave()) event.preventDefault() }}
                className={'group flex aspect-square min-h-48 flex-col rounded-xl border bg-surface text-ink shadow-card transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand '
                  + (card.id === currentId ? 'border-brand/50' : 'border-border')}>
                <span className={'flex items-start gap-2 rounded-t-xl border-b border-border px-3 py-2 text-sm font-semibold leading-tight '
                  + (card.id === currentId ? 'bg-brand/10 text-brand-dark' : 'bg-surface-muted')}>
                  <Icon size={16} className="shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 break-words">{title}</span>
                </span>
                <span className="flex flex-1 flex-col items-start gap-1 px-3 py-2">
                  <span className="max-w-full break-words font-semibold text-brand-dark">{card.number === 'Без номера' ? card.number : '№ ' + card.number}</span>
                  <span className="text-xs text-muted">{journalDate(card.date)}</span>
                  <span className="max-w-full break-words font-semibold tabular-nums">{money(card.amount, card.currency)}</span>
                  {card.evidence && <span className="max-w-full break-words text-xs text-muted">{card.evidence}</span>}
                  {card.status && <span className="mt-auto max-w-full break-words rounded-md bg-surface-muted px-2 py-1 text-xs font-medium">{card.status}</span>}
                </span>
                <span className="flex items-center justify-between gap-1 rounded-b-xl border-t border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-brand-dark group-hover:bg-brand/10">
                  <span className="min-w-0 break-words">{destination}</span>
                  <ChevronRight size={16} className="shrink-0" aria-hidden />
                </span>
              </Link>
            ))}
            {!cards.length && <div className="space-y-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted">
              <h3 className="flex items-start gap-2 font-semibold text-ink">
                <Icon size={16} className="shrink-0 text-brand" aria-hidden /> {title}
              </h3>
              <p>{empty}</p>
            </div>}
          </section>
        ))}
      </div>
  )
}
