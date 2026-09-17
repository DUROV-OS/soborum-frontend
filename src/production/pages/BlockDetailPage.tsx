import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { useAuthStore } from '@/auth/store'
import { useTasksStore } from '@/tasks/store'
import { TaskDetailDrawer } from '@/tasks/components/TaskDetailDrawer'
import { CreateTaskModal } from '@/tasks/components/CreateTaskModal'
import { Task, TASK_STATES } from '@/tasks/types'
import * as warehouseApi from '@/warehouse/api'
import { Material } from '@/warehouse/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { useProductionStore } from '../store'
import { AddMaterialModal } from '../components/AddMaterialModal'
import { RequestMaterialModal } from '../components/RequestMaterialModal'
import { BlockMaterial } from '../types'

export function BlockDetailPage() {
  const { id = '' } = useParams()
  const blockId = Number(id)
  const block = useProductionStore((s) => s.block)
  const production = useProductionStore((s) => s.production)
  const loadBlock = useProductionStore((s) => s.loadBlock)
  const loadProduction = useProductionStore((s) => s.loadProduction)
  const deleteBlock = useProductionStore((s) => s.deleteBlock)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')
  const navigate = useNavigate()
  const tasks = useTasksStore((s) => s.tasks)
  const loadTasks = useTasksStore((s) => s.load)

  const [materials, setMaterials] = useState<Material[]>([])
  const [addingMaterial, setAddingMaterial] = useState(false)
  const [requestingLine, setRequestingLine] = useState<BlockMaterial | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    loadBlock(blockId)
    loadTasks({ block_id: blockId })
    warehouseApi.listMaterials().then(setMaterials)
  }, [blockId, loadBlock, loadTasks])

  useEffect(() => {
    if (block && block.id === blockId && production?.id !== block.production_id) {
      loadProduction(block.production_id)
    }
  }, [block, blockId, production, loadProduction])

  if (!block || block.id !== blockId) {
    return <p className="text-[13px] text-muted">Загрузка…</p>
  }

  function materialTitle(warehouseMaterialId: number) {
    return materials.find((m) => m.id === warehouseMaterialId)?.title ?? `Материал №${warehouseMaterialId}`
  }

  const blockTasks = tasks.filter((t) => t.block_id === blockId)
  const dependencyNames = block.depends_on_ids.map(
    (depId) => production?.blocks.find((b) => b.id === depId)?.name ?? `Блок №${depId}`
  )

  async function handleDelete() {
    if (!block) return
    if (!window.confirm(`Удалить блок «${block.name}»? Отменить нельзя.`)) return
    setDeleting(true)
    const result = await deleteBlock(block.id)
    if (result.ok) {
      navigate(`/production/${block.production_id}`, { replace: true })
      return
    }
    setDeleting(false)
    setDeleteError(result.reason ?? 'Не удалось удалить блок')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={`/production/${block.production_id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        К производству
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[18px] font-medium text-ink">{block.name}</h1>
          {block.description && <p className="mt-1 text-[13px] text-muted">{block.description}</p>}
          {dependencyNames.length > 0 && (
            <p className="mt-1 text-[12px] text-warning">Ждёт: {dependencyNames.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AskAiButton
            domain="production"
            contextLabel={`Блок: ${block.name}`}
            contextNote={`[block_id=${block.id}, production_id=${block.production_id}, ${block.name}] `}
          />
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Удалить блок"
              title="Удалить блок"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {deleteError && <p className="mb-4 text-[12px] text-danger">{deleteError}</p>}

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-medium text-ink">Материалы</h2>
          <Button size="sm" variant="secondary" onClick={() => setAddingMaterial(true)}>
            <Plus size={14} />
            Добавить материал
          </Button>
        </div>
        <DataTable
          columns={[
            { header: 'Материал', accessor: (m: BlockMaterial) => materialTitle(m.warehouse_material_id) },
            { header: 'Инв. №', accessor: (m: BlockMaterial) => m.inventory_number },
            { header: 'Необходимо', align: 'right', className: 'tabular', accessor: (m: BlockMaterial) => `${m.quantity_required} ${m.unit}` },
            { header: 'Запрошено', align: 'right', className: 'tabular', accessor: (m: BlockMaterial) => `${m.quantity_requested} ${m.unit}` },
            { header: 'Выдано', align: 'right', className: 'tabular', accessor: (m: BlockMaterial) => `${m.quantity_provided} ${m.unit}` },
            {
              header: '',
              accessor: (m: BlockMaterial) => (
                <Button size="sm" variant="ghost" onClick={() => setRequestingLine(m)}>
                  Запросить
                </Button>
              ),
            },
          ]}
          rows={block.materials}
          keyOf={(m) => String(m.id)}
          emptyLabel="Материалы пока не добавлены"
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-medium text-ink">Задачи блока</h2>
          <Button size="sm" variant="secondary" onClick={() => setCreatingTask(true)}>
            <Plus size={14} />
            Задача
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {blockTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTask(task)}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-left hover:border-brand/40"
            >
              <span className="text-[13px] text-ink">{task.title}</span>
              <Chip tone="neutral">{TASK_STATES.find((s) => s.key === task.status)?.label}</Chip>
            </button>
          ))}
          {blockTasks.length === 0 && <p className="text-[13px] text-muted">Задач пока нет.</p>}
        </div>
      </section>

      <AddMaterialModal
        blockId={block.id}
        materials={materials}
        open={addingMaterial}
        onClose={() => setAddingMaterial(false)}
      />
      <RequestMaterialModal line={requestingLine} onClose={() => setRequestingLine(null)} />
      <CreateTaskModal blockId={block.id} open={creatingTask} onClose={() => setCreatingTask(false)} />
      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}
