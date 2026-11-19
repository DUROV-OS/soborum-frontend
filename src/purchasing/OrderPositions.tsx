import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Modal } from '@/shared/ui/Modal'
import { journalMoney } from './JournalControls'

type Position = {
  number: number
  name: string
  quantity: number
  unit: string
  received_quantity: number
  stock_unit: string | null
  stock: string | null
  available: string | null
  vat: 'included' | 'exempt' | null
  vat_rate: string | null
  unit_price: number
  amount_with_vat: string | null
  amount: string
}

function quantity(value: number | string | null, unit?: string | null) {
  if (value === null) return '—'
  const number = Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
  return unit ? `${number} ${unit}` : number
}

const materialLinkStyle = 'text-left font-medium text-brand-dark underline underline-offset-2 hover:text-brand'

export function OrderMaterialLink({ materialId, name, amount, unit, canOpenMaterial }: {
  materialId: number | null
  name: string
  amount: number
  unit: string
  canOpenMaterial: boolean
}) {
  const [open, setOpen] = useState(false)
  if (materialId && canOpenMaterial) return <Link className={materialLinkStyle}
    to={`/warehouse?tab=materials&material=${materialId}`} target="_blank" rel="noopener">{name}</Link>
  return <>
    <button type="button" className={materialLinkStyle} onClick={() => setOpen(true)}>{name}</button>
    {open && <Modal open title={name} onClose={() => setOpen(false)}>
      <p>Количество в заказе {quantity(amount, unit)}</p>
    </Modal>}
  </>
}

export function OrderPositions({ orderId, version, currency, materialIds, canOpenMaterial }: {
  orderId: number
  version: number
  currency: string
  materialIds: (number | null)[]
  canOpenMaterial: boolean
}) {
  const [items, setItems] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    apiRequest<Position[]>({ section: 'purchasing', path: `/orders/${orderId}/positions` })
      .then(rows => { if (current) setItems(rows) })
      .catch(e => { if (current) setError(e.message) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [orderId, version, retry])

  const money = (value: number | string | null) => value === null ? '—' : journalMoney(Number(value), currency)
  return <section className="space-y-3" aria-label="Позиции заказа">
    {error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-bg p-3 text-danger">
      {error}<Button variant="secondary" onClick={() => setRetry(n => n + 1)}>Повторить</Button>
    </div> : <DataTable rows={items} loading={loading} keyOf={row => String(row.number)}
      emptyLabel="В заказе нет позиций."
      columns={[
        { header: '№', accessor: row => row.number, align: 'right' },
        { header: 'Наименование', accessor: row => <OrderMaterialLink materialId={materialIds[row.number - 1] ?? null}
          name={row.name} amount={row.quantity} unit={row.unit} canOpenMaterial={canOpenMaterial} />, className: 'min-w-[180px]' },
        { header: 'Количество', accessor: row => <div>
          {quantity(row.quantity, row.unit)}
          {row.received_quantity > 0 && <p className="mt-0.5 text-xs text-muted">Принято {quantity(row.received_quantity)}</p>}
        </div>, align: 'right', className: 'whitespace-nowrap tabular-nums' },
        { header: 'Доступно', accessor: row => quantity(row.available, row.stock_unit), align: 'right', className: 'whitespace-nowrap tabular-nums' },
        { header: 'Остаток на складе', accessor: row => quantity(row.stock, row.stock_unit), align: 'right', className: 'whitespace-nowrap tabular-nums' },
        { header: 'НДС', accessor: row => row.vat === 'exempt' ? 'Без НДС' : row.vat_rate === null ? '—' : `${quantity(row.vat_rate)} %`, align: 'right', className: 'whitespace-nowrap' },
        { header: 'Цена', accessor: row => money(row.unit_price), align: 'right', className: 'whitespace-nowrap tabular-nums' },
        { header: 'Сумма с НДС', accessor: row => money(row.amount_with_vat), align: 'right', className: 'whitespace-nowrap tabular-nums' },
        { header: 'Сумма', accessor: row => money(row.amount), align: 'right', className: 'whitespace-nowrap tabular-nums' },
      ]} />}
    {!loading && !error && items.some(row => row.vat === null) && <p className="text-xs text-muted">Если ставка НДС не подтверждена, в «Сумме» показана стоимость позиции по заказу.</p>}
  </section>
}
