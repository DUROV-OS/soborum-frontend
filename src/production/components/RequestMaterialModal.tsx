import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useProductionStore } from '../store'
import { BlockMaterial } from '../types'

export function RequestMaterialModal({
  line,
  onClose,
}: {
  line: BlockMaterial | null
  onClose: () => void
}) {
  const requestMaterial = useProductionStore((s) => s.requestMaterial)
  const [quantity, setQuantity] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!line) return null

  const lineId = line.id

  function reset() {
    setQuantity('')
    setError(null)
  }

  async function handleSubmit() {
    if (quantity === '' || quantity <= 0) return
    setSaving(true)
    const result = await requestMaterial(lineId, quantity)
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось создать заявку')
    }
  }

  return (
    <Modal
      open={!!line}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Запросить материал со склада"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={quantity === '' || quantity <= 0 || saving}>
            {saving ? 'Отправка…' : 'Отправить заявку'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-muted">
        Сейчас необходимо {line.quantity_required} {line.unit}, уже запрошено {line.quantity_requested} {line.unit}.
      </p>
      <Field label={`Количество, ${line.unit}`} required>
        <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} />
      </Field>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Modal>
  )
}
