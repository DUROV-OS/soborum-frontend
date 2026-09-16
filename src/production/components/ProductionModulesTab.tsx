import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Production } from '../types'
import { useProductionStore } from '../store'

/** Содержимое вкладки «Сборка» одного производства — модули этого дома и их
 * материалы. Раньше это было всё содержимое /production/:id; теперь это
 * один из внутренних разделов производства (см. ProductionDetailShell). */
export function ProductionModulesTab() {
  const { production } = useOutletContext<{ production: Production }>()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink">Модули</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Модуль
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {production.modules.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => navigate(`/production/modules/${module.id}`)}
            className="rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-brand/40"
          >
            <div className="text-[14px] font-medium text-ink">{module.name}</div>
            {module.description && <div className="mt-1 text-[13px] text-muted">{module.description}</div>}
            <div className="mt-2 text-[12px] text-muted">{module.materials.length} материал(ов)</div>
          </button>
        ))}
        {production.modules.length === 0 && (
          <p className="text-[13px] text-muted">Модулей пока нет — добавьте первый.</p>
        )}
      </div>

      <CreateModuleModal productionId={production.id} open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function CreateModuleModal({
  productionId,
  open,
  onClose,
}: {
  productionId: number
  open: boolean
  onClose: () => void
}) {
  const createModule = useProductionStore((s) => s.createModule)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setDescription('')
    setError(null)
  }

  async function handleSubmit() {
    if (!name) return
    setSaving(true)
    const result = await createModule(productionId, name, description || undefined)
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось создать модуль')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Новый модуль"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!name || saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Название" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Модуль 1" />
        </Field>
        <Field label="Описание">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
