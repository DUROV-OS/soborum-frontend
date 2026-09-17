import { useEffect, useState } from 'react'
import { Material } from '@/warehouse/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useProductionStore } from '../store'

export function AddMaterialModal({
  blockId,
  materials,
  open,
  onClose,
}: {
  blockId: number
  materials: Material[]
  open: boolean
  onClose: () => void
}) {
  const addBlockMaterial = useProductionStore((s) => s.addBlockMaterial)
  const [materialId, setMaterialId] = useState<number>(materials[0]?.id ?? 0)
  const [inventoryNumber, setInventoryNumber] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (materials.length > 0 && !materialId) setMaterialId(materials[0].id)
  }, [materials, materialId])

  const selected = materials.find((m) => m.id === materialId)
  const valid = materialId && inventoryNumber && quantity !== '' && quantity > 0

  function reset() {
    setInventoryNumber('')
    setQuantity('')
    setError(null)
  }

  async function handleSubmit() {
    if (!valid || !selected) return
    setSaving(true)
    const result = await addBlockMaterial(blockId, {
      warehouse_material_id: materialId,
      inventory_number: inventoryNumber,
      unit: selected.unit,
      quantity_required: quantity as number,
    })
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось добавить материал')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Добавить материал в блок"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? 'Сохранение…' : 'Добавить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Материал со склада" required>
          <Select value={materialId} onChange={(e) => setMaterialId(Number(e.target.value))}>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Инвентарный номер" required>
          <Input value={inventoryNumber} onChange={(e) => setInventoryNumber(e.target.value)} placeholder="INV-1" />
        </Field>
        <Field label={`Необходимое количество${selected ? `, ${selected.unit}` : ''}`} required>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
