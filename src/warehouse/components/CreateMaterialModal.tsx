import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import * as suppliersApi from '@/suppliers/api'
import { Supplier } from '@/suppliers/types'
import * as warehouseApi from '../api'
import { useWarehouseStore } from '../store'

type TabKey = 'main' | 'characteristics'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'main', label: 'Основное' },
  { key: 'characteristics', label: 'Характеристики' },
]

export function CreateMaterialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMaterial = useWarehouseStore((s) => s.createMaterial)
  const [tab, setTab] = useState<TabKey>('main')
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouse, setWarehouse] = useState('')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [unit, setUnit] = useState('')
  const [inStock, setInStock] = useState<number | ''>('')
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('')
  const [threshold, setThreshold] = useState<number | ''>('')
  const [kind, setKind] = useState('')
  const [size, setSize] = useState('')
  const [diameter, setDiameter] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [packQuantity, setPackQuantity] = useState<number | ''>('')
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    warehouseApi.listWarehouses().then((rows) => {
      setWarehouses(rows)
      setWarehouse((prev) => prev || rows[0] || '')
    })
    warehouseApi.listCategories().then(setCategories)
    warehouseApi.listMaterialUnits().then((rows) => {
      setUnits(rows)
      setUnit((prev) => prev || rows[0] || '')
    })
    suppliersApi.listSuppliers().then(setSuppliers)
  }, [open])

  // обязательные поля живут на вкладке «Основное» — характеристики
  // необязательны целиком, материал можно завести, не открывая вкладку
  const valid = warehouse && title && code && unit && (packQuantity === '' || packQuantity > 0)

  function reset() {
    setTab('main')
    setCategory('')
    setTitle('')
    setCode('')
    setInStock('')
    setPurchasePrice('')
    setThreshold('')
    setKind('')
    setSize('')
    setDiameter('')
    setSerialNumber('')
    setPackQuantity('')
    setSupplierId('')
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    const result = await createMaterial({
      warehouse,
      category: category || undefined,
      title,
      code,
      unit,
      quantity_in_stock: inStock === '' ? undefined : inStock,
      purchase_price: purchasePrice === '' ? undefined : purchasePrice,
      threshold: threshold === '' ? undefined : threshold,
      kind: kind.trim() || undefined,
      size: size.trim() || undefined,
      diameter: diameter.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      pack_quantity: packQuantity === '' ? undefined : packQuantity,
      supplier_id: supplierId === '' ? undefined : supplierId,
    })
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось создать материал')
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новый материал"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Tabs tabs={TABS} activeKey={tab} onChange={setTab} />

        {tab === 'main' ? (
          <div className="flex flex-col gap-4">
            <Field label="Название" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Доска обрезная 150×50×6000" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Склад" required>
                <Select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Категория">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">— не выбрана —</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Код" required>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="BRUS-150-50" />
              </Field>
              <Field label="Единица измерения" required>
                <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Начальный остаток">
                <Input type="number" value={inStock} onChange={(e) => setInStock(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
              <Field label="Закупочная цена, ₽">
                <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
              <Field label="Пороговое значение">
                <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value === '' ? '' : Number(e.target.value))} />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Вид">
              <Input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="кровельный" />
            </Field>
            <Field label="Размер">
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="10×1 м" />
            </Field>
            <Field label="Диаметр">
              <Input value={diameter} onChange={(e) => setDiameter(e.target.value)} placeholder="30 мм" />
            </Field>
            <Field label="Серийный номер">
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="только для уникальных позиций"
              />
            </Field>
            <Field label="Количество в упаковке">
              <Input
                type="number"
                min={0}
                value={packQuantity}
                onChange={(e) => setPackQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
            <Field label="Поставщик">
              <Select
                value={supplierId === '' ? '' : String(supplierId)}
                onChange={(e) => setSupplierId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— не выбран —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {packQuantity !== '' && packQuantity <= 0 && (
          <p className="text-[12px] text-danger">Количество в упаковке должно быть больше нуля.</p>
        )}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
