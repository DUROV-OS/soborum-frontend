import { useEffect, useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import * as api from '../api'
import { formatQty, parseQty } from './OperationLinesEditor'
import { useWarehouseStore } from '../store'

export function RequestApprovalQueue() {
  const canEdit = accessLevelAtLeast(useAccessLevel('warehouse'), 'edit')
  const reloadMaterials = useWarehouseStore((s) => s.load)
  const [rows, setRows] = useState<api.PendingMaterialRequest[] | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    try {
      const data = await api.listPendingRequests()
      setRows(data)
      setQuantities(Object.fromEntries(data.map((row) => [row.id, formatQty(Math.max(0, Math.min(row.quantity, row.available_quantity??row.in_stock)))])))
      setError(null)
    } catch {
      setRows(null)
      setError('Не удалось загрузить заявки. Повторите попытку.')
    }
  }
  useEffect(() => { void load() }, [])

  async function decide(row: api.PendingMaterialRequest, decision: 'approve' | 'reject') {
    if (busy) return
    const quantity = parseQty(quantities[row.id] ?? '')
    setBusy(true); setError(null); setNotice(null)
    try {
      if (decision === 'approve') await api.approveRequest(row.id, quantity)
      else await api.rejectRequest(row.id)
      setNotice(decision === 'approve' ? 'Выдача проведена. Остаток заявки обновлён.' : 'Заявка отклонена.')
      await load()
      void reloadMaterials().catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать заявку')
    } finally { setBusy(false) }
  }
  if (!rows && !error) return <LoadingState label="Загружаем заявки…" />
  return <div className="space-y-3">
    {error && <div role="alert" className="rounded-md bg-danger-bg p-3 text-[13px] text-danger">{error} {!rows && <button type="button" onClick={() => void load()} className="underline">Повторить</button>}</div>}
    {notice && <p role="status" className="text-[13px] text-success">{notice}</p>}
    {rows?.length === 0 && <EmptyState title="Нет заявок на выдачу" description="Запросы от производства появятся здесь." />}
    {rows?.map((row) => {
      const quantity = parseQty(quantities[row.id] ?? '')
      const available=row.available_quantity??row.in_stock
      const valid = Number.isFinite(quantity) && quantity > 0 && quantity <= row.quantity && quantity <= available && (row.is_fractional || Number.isInteger(quantity))
      return <div key={row.id} className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[14px] font-medium text-ink">{row.material_title} · {row.production_name}</p>
        <p className="mt-1 text-[12px] text-muted">Этап: {row.block_name} · Запросил: {row.requested_by}</p>
        <p className="mt-1 text-[12px] text-muted">Осталось по заявке: {formatQty(row.quantity)} {row.unit} · На складе: {formatQty(row.in_stock)} {row.unit}</p>
        <p className="mt-1 text-[12px] text-muted">Доступно этому дому: {formatQty(available)} {row.unit}</p>
        {available < row.quantity && <p className="mt-1 text-[12px] text-warning">Не хватает {formatQty(row.quantity - available)} {row.unit}; доступное можно выдать частично.</p>}
        {canEdit && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-[12px] text-muted">К выдаче<Input aria-label={`К выдаче: ${row.material_title}`} className="mt-1 w-32" inputMode="decimal" value={quantities[row.id] ?? ''} onChange={(e) => setQuantities({ ...quantities, [row.id]: e.target.value })} /></label><Button size="sm" disabled={busy || !valid} onClick={() => void decide(row, 'approve')}>Выдать</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(row, 'reject')}>Отклонить</Button></div>}
      </div>
    })}
  </div>
}
