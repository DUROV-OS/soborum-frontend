import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { journalDate, journalMoney } from '@/purchasing/JournalControls'
import { PurchaseDocumentSections } from '@/purchasing/PurchaseDocumentSections'
import { apiRequest } from '@/shared/lib/httpClient'
import { DataTable } from '@/shared/ui/DataTable'

type InvoiceCard = {
  number: string
  date: string | null
  agent_name: string | null
  counterparty_id: number | null
  warehouse: string | null
  status_label: string
  amount: string | null
  currency: string | null
  comment: string | null
  archived: boolean
  positions: { number: number; name: string; quantity: number | null; unit: string | null;
    vat: number | null; price: string | null; amount: string | null }[]
}

export function SupplierInvoiceDetail({ id }: { id: number }) {
  const [invoice, setInvoice] = useState<InvoiceCard | null>(null)
  const [error, setError] = useState('')
  const canEdit = accessLevelAtLeast(useAccessLevel('accounting'), 'edit')
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0 })
    let current = true
    apiRequest<InvoiceCard>({ section: 'purchasing', path: `/supplier-invoices/${id}` })
      .then(result => { if (current) setInvoice(result) })
      .catch(error => { if (current) setError(error.message) })
    return () => { current = false }
  }, [id])

  const amount = (value: string | null) => value === null ? '—'
    : invoice?.currency ? journalMoney(Number(value), invoice.currency)
      : Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <section aria-label={`Счёт поставщика № ${invoice?.number ?? id}`} className="min-w-0 space-y-5 text-sm">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-medium text-ink">Счёт поставщика № {invoice?.number ?? id}</h1>
        {invoice && <p className="mt-1 text-muted">{[
          journalDate(invoice.date), invoice.status_label, invoice.warehouse, invoice.archived && 'Архив',
        ].filter(Boolean).join(' · ')}</p>}
      </div>
      <Link to="/moysklad?type=invoicein" className="rounded-lg border border-border bg-surface px-3 py-2 font-medium text-brand-dark hover:border-brand">
        К списку счетов
      </Link>
    </header>
    {error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-danger">{error}</p>}
    {!error && !invoice && <p role="status" className="text-muted">Загружаем счёт поставщика…</p>}
    {invoice && <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3">
        <span>{invoice.counterparty_id ? <Link to={`/suppliers?counterparty=${invoice.counterparty_id}`} className="font-medium text-brand-dark underline">
          {invoice.agent_name ?? 'Контрагент'}
        </Link> : invoice.agent_name ?? 'Контрагент не указан'}</span>
        <span className="font-semibold tabular-nums">{amount(invoice.amount)}</span>
      </div>
      <PurchaseDocumentSections resource="supplier-invoices" id={id} canUpload={canEdit && !invoice.archived} positions={<>
        <DataTable rows={invoice.positions} keyOf={row => String(row.number)} emptyLabel="В счёте нет сохранённых позиций"
          columns={[
            { header: '№', accessor: row => row.number },
            { header: 'Наименование', accessor: row => row.name },
            { header: 'Количество', accessor: row => row.quantity == null ? '—' : `${row.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 6 })} ${row.unit ?? ''}` },
            { header: 'НДС', align: 'right', accessor: row => row.vat == null ? '—' : `${row.vat}%` },
            { header: 'Цена', align: 'right', accessor: row => amount(row.price) },
            { header: 'Сумма', align: 'right', accessor: row => amount(row.amount) },
          ]} />
        {invoice.comment && <p className="mt-3 whitespace-pre-wrap">{invoice.comment}</p>}
      </>} />
    </>}
  </section>
}
