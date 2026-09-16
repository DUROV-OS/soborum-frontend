import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Production } from '../types'
import { useProductionStore } from '../store'

/** Содержимое вкладки «Сборка» одного производства — блоки этого дома (узлы
 * направленного графа этапов производства) и их материалы. Раньше это было
 * всё содержимое /production/:id; теперь это один из внутренних разделов
 * производства (см. ProductionDetailShell). */
export function ProductionBlocksTab() {
  const { production } = useOutletContext<{ production: Production }>()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const blocks = [...production.blocks].sort((a, b) => a.sequence - b.sequence)
  const blockById = new Map(blocks.map((b) => [b.id, b]))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink">Блоки</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Блок
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {blocks.map((block) => {
          const waitingFor = block.depends_on_ids.map((id) => blockById.get(id)?.name ?? `Блок №${id}`)
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => navigate(`/production/blocks/${block.id}`)}
              className="rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-brand/40"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-medium text-ink">{block.name}</div>
                <span
                  className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                    waitingFor.length > 0 ? 'bg-warning/10 text-warning' : 'bg-brand/10 text-brand-dark'
                  }`}
                >
                  {waitingFor.length > 0 ? 'заблокирован' : 'готов к старту'}
                </span>
              </div>
              {block.description && <div className="mt-1 text-[13px] text-muted">{block.description}</div>}
              {waitingFor.length > 0 && (
                <div className="mt-2 text-[12px] text-muted">Ждёт: {waitingFor.join(', ')}</div>
              )}
              <div className="mt-2 text-[12px] text-muted">{block.materials.length} материал(ов)</div>
            </button>
          )
        })}
        {blocks.length === 0 && (
          <p className="text-[13px] text-muted">Блоков пока нет — добавьте первый.</p>
        )}
      </div>

      <CreateBlockModal productionId={production.id} open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function CreateBlockModal({
  productionId,
  open,
  onClose,
}: {
  productionId: number
  open: boolean
  onClose: () => void
}) {
  const createBlock = useProductionStore((s) => s.createBlock)
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
    const result = await createBlock(productionId, name, description || undefined)
    setSaving(false)
    if (result.ok) {
      reset()
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось создать блок')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Новый блок"
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Блок 1" />
        </Field>
        <Field label="Описание">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
