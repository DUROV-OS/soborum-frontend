import { useEffect, useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { DataTable } from '@/shared/ui/DataTable'
import * as warehouseApi from '../api'
import { useWarehouseStore } from '../store'
import { Material, MOVEMENT_REASON_LABEL, StockMovement } from '../types'

export function MaterialDetailDrawer({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const updateMaterial = useWarehouseStore((s) => s.updateMaterial)
  const writeOffMaterial = useWarehouseStore((s) => s.writeOffMaterial)
  const level = useAccessLevel('warehouse')
  const canEdit = accessLevelAtLeast(level, 'edit')
  const canFull = accessLevelAtLeast(level, 'full')
  const [threshold, setThreshold] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<StockMovement[]>([])
  const [writingOff, setWritingOff] = useState(false)
  const [writeOffQuantity, setWriteOffQuantity] = useState<number | ''>('')
  const [writeOffReason, setWriteOffReason] = useState('')
  const [writeOffBusy, setWriteOffBusy] = useState(false)
  const [writeOffError, setWriteOffError] = useState<string | null>(null)

  useEffect(() => {
    if (material) {
      setThreshold(material.threshold)
      warehouseApi.materialHistory(material.id).then(setHistory)
      setWritingOff(false)
      setWriteOffQuantity('')
      setWriteOffReason('')
      setWriteOffError(null)
    }
  }, [material])

  if (!material) return null

  const materialId = material.id

  async function save() {
    if (threshold === '') return
    setSaving(true)
    const result = await updateMaterial(materialId, { threshold })
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  async function submitWriteOff() {
    if (writeOffQuantity === '' || writeOffQuantity <= 0 || !writeOffReason.trim()) return
    setWriteOffBusy(true)
    const result = await writeOffMaterial(materialId, writeOffQuantity, writeOffReason.trim())
    setWriteOffBusy(false)
    if (result.ok) {
      setWritingOff(false)
      setWriteOffQuantity('')
      setWriteOffReason('')
      setWriteOffError(null)
      warehouseApi.materialHistory(materialId).then(setHistory)
    } else {
      setWriteOffError(result.reason ?? 'Не удалось списать материал')
    }
  }

  return (
    <Drawer
      open={!!material}
      onClose={onClose}
      title={material.title}
      subtitle={
        <div className="flex items-center gap-2">
          <span>
            {[material.code, material.category].filter((v) => v && v !== 'без категории').join(' · ') || '—'}
          </span>
          {material.needs_supply && <Chip tone="danger">Требуется поставка</Chip>}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
          <Row label="На складе" value={`${material.quantity_in_stock} ${material.unit}`} />
          <Row label="Суммарно запрошено" value={`${material.total_requested} ${material.unit}`} />
          <Row label="Склад" value={material.warehouse || '—'} />
          <Row label="Закупочная цена" value={material.purchase_price ? `${material.purchase_price} ₽` : '—'} />
        </div>

        <CharacteristicsBlock material={material} />

        {canEdit && (
          <div>
            <Field label="Пороговое значение">
              <div className="flex gap-2">
                <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value === '' ? '' : Number(e.target.value))} />
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? '…' : 'Сохранить'}
                </Button>
              </div>
            </Field>
            {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
          </div>
        )}

        {canFull && (
        <div>
          {!writingOff ? (
            <Button size="sm" variant="danger" onClick={() => setWritingOff(true)}>
              Списать
            </Button>
          ) : (
            <div className="rounded-md border border-border bg-surface-muted/40 p-3">
              <div className="mb-2 text-[13px] font-medium text-ink">Списание материала</div>
              <div className="flex flex-col gap-3">
                <Field label="Количество" required>
                  <Input
                    type="number"
                    value={writeOffQuantity}
                    onChange={(e) => setWriteOffQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={`макс. ${material.quantity_in_stock} ${material.unit}`}
                  />
                </Field>
                <Field label="Причина" required>
                  <Textarea
                    rows={2}
                    value={writeOffReason}
                    onChange={(e) => setWriteOffReason(e.target.value)}
                    placeholder="Напр.: брак, недостача при инвентаризации, истёк срок годности"
                  />
                </Field>
                {writeOffError && <p className="text-[12px] text-danger">{writeOffError}</p>}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setWritingOff(false)} disabled={writeOffBusy}>
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={submitWriteOff}
                    disabled={writeOffBusy || writeOffQuantity === '' || writeOffQuantity <= 0 || !writeOffReason.trim()}
                  >
                    {writeOffBusy ? 'Списание…' : 'Списать'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {material.request_breakdown.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink">Запрошено по модулям</div>
            <div className="flex flex-col gap-1.5">
              {material.request_breakdown.map((item) => (
                <div key={item.module_id} className="flex justify-between text-[13px]">
                  <span className="text-muted">{item.module_name}</span>
                  <span className="tabular text-ink">{item.quantity_requested} {material.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-[13px] font-medium text-ink">История движения</div>
          <DataTable
            columns={[
              { header: 'Дата', accessor: (m) => new Date(m.created_at).toLocaleString('ru-RU') },
              {
                header: 'Причина',
                accessor: (m) => (m.note ? `${MOVEMENT_REASON_LABEL[m.reason]} — ${m.note}` : MOVEMENT_REASON_LABEL[m.reason]),
              },
              {
                header: 'Изменение',
                align: 'right',
                accessor: (m) => (
                  <span className={m.delta >= 0 ? 'text-success' : 'text-danger'}>
                    {m.delta >= 0 ? '+' : ''}
                    {m.delta}
                  </span>
                ),
              },
            ]}
            rows={history}
            keyOf={(m) => String(m.id)}
            emptyLabel="Движений пока нет"
          />
        </div>
      </div>
    </Drawer>
  )
}

/** Характеристики материала (0078): показываем только заполненные поля,
 * пустой блок не рисуем — у материалов до 0078 характеристик нет. */
function CharacteristicsBlock({ material }: { material: Material }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Вид', value: material.kind ?? '' },
    { label: 'Размер', value: material.size ?? '' },
    { label: 'Диаметр', value: material.diameter ?? '' },
    { label: 'Серийный номер', value: material.serial_number ?? '' },
    {
      label: 'Количество в упаковке',
      value: material.pack_quantity === null ? '' : `${material.pack_quantity} ${material.unit}`,
    },
    { label: 'Поставщик', value: material.supplier_name ?? '' },
  ].filter((row) => row.value.trim() !== '')

  if (rows.length === 0) return null

  return (
    <div>
      <div className="mb-2 text-[13px] font-medium text-ink">Характеристики</div>
      <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
        {rows.map((row) => (
          <Row key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="tabular text-ink">{value}</div>
    </div>
  )
}
