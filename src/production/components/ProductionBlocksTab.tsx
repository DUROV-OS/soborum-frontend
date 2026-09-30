import { useEffect, useState } from 'react'
import { List, Plus, Workflow } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import * as productionApi from '../api'
import { BlockReadiness, Production } from '../types'
import { useProductionStore } from '../store'
import { BlockGraph } from './BlockGraph'
import { AdmissionChip, ReadinessBadge } from './ReadinessBadge'

type ViewMode = 'list' | 'graph'

/** Содержимое вкладки «Сборка» одного производства — блоки этого дома (узлы
 * направленного графа этапов производства) и их материалы. Раньше это было
 * всё содержимое /production/:id; теперь это один из внутренних разделов
 * производства (см. ProductionDetailShell). */
export function ProductionBlocksTab() {
  const { production } = useOutletContext<{ production: Production }>()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  const canEdit = accessLevelAtLeast(useAccessLevel('production'), 'edit')

  const blocks = [...production.blocks].sort((a, b) => a.sequence - b.sequence)
  // Допуск и материалы считает сервер (0084-b); без его ответа ничего не
  // утверждаем — ни «допущен», ни «ждёт».
  const [readinessById, setReadinessById] = useState<Map<number, BlockReadiness> | null>(null)
  const [readinessFailed, setReadinessFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReadinessFailed(false)
    productionApi
      .getProductionReadiness(production.id)
      .then((data) => {
        if (!cancelled) setReadinessById(new Map(data.blocks.map((b) => [b.block_id, b])))
      })
      .catch(() => {
        if (!cancelled) {
          setReadinessById(null)
          setReadinessFailed(true)
        }
      })
    return () => {
      cancelled = true
    }
    // production меняется после каждой правки блоков — оценку перечитываем вместе с ним
  }, [production])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-ink">Блоки</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                view === 'list' ? 'bg-brand/10 text-brand-dark' : 'text-muted hover:text-ink'
              }`}
            >
              <List size={14} />
              Список
            </button>
            <button
              type="button"
              onClick={() => setView('graph')}
              aria-pressed={view === 'graph'}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                view === 'graph' ? 'bg-brand/10 text-brand-dark' : 'text-muted hover:text-ink'
              }`}
            >
              <Workflow size={14} />
              Граф
            </button>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={16} />
              Блок
            </Button>
          )}
        </div>
      </div>

      {view === 'graph' ? (
        <BlockGraph
          blocks={blocks}
          readinessById={readinessById}
          onSelect={(block) => navigate(`/production/blocks/${block.id}`)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {blocks.map((block) => {
            const readiness = readinessById?.get(block.id)
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => navigate(`/production/blocks/${block.id}`)}
                className="rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-brand/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[14px] font-medium text-ink">{block.name}</div>
                  {readiness ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdmissionChip readiness={readiness} />
                      <ReadinessBadge state={readiness.materials_state} label={readiness.materials_label} />
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted">
                      {readinessFailed ? 'оценка недоступна' : 'оценка загружается…'}
                    </span>
                  )}
                </div>
                {block.description && <div className="mt-1 text-[13px] text-muted">{block.description}</div>}
                <div className="mt-2 text-[12px] text-muted">{block.materials.length} материал(ов)</div>
              </button>
            )
          })}
          {blocks.length === 0 && <p className="text-[13px] text-muted">Блоков пока нет — добавьте первый.</p>}
        </div>
      )}

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
