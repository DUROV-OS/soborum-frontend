import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PlanningImage } from '@/house_models/components/PlanningImage'
import { Chip } from '@/shared/ui/Chip'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import * as stageTemplateApi from '../stageTemplateApi'
import {
  KrExtraction,
  KrPageRef,
  ProductionStageTemplate,
  StageTemplateBlock,
  TemplateBlockMaterial,
  TemplateBlockTask,
} from '../stageTemplateTypes'

const STATUS_LABEL: Record<ProductionStageTemplate['status'], string> = {
  draft: 'Черновик',
  reviewed: 'На проверке',
  confirmed: 'Подтверждён',
}

/** Экран проверки предложенного ИИ графа этапов производства (0066-e): слева —
 * страница КР, выбранная кликом на «стр. N» справа, справа — предложенные
 * блоки/задачи/материалы. Правка полей переводит шаблон в `reviewed`. */
export function StageTemplateReviewPage() {
  const { id = '' } = useParams()
  const templateId = Number(id)

  const [template, setTemplate] = useState<ProductionStageTemplate | null>(null)
  const [extraction, setExtraction] = useState<KrExtraction | null>(null)
  const [selectedPage, setSelectedPage] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    stageTemplateApi
      .getStageTemplate(templateId)
      .then(async (data) => {
        if (cancelled) return
        setTemplate(data)
        const firstPage = data.blocks[0]?.kr_page_refs[0]?.page_number ?? null
        setSelectedPage(firstPage)
        try {
          const kr = await stageTemplateApi.getKrExtraction(data.source_client_id)
          if (!cancelled) setExtraction(kr)
        } catch {
          // Разбор КР мог быть удалён/заменён — экран остаётся полезным без картинки.
        }
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить шаблон графа этапов')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [templateId])

  const locked = template?.status === 'confirmed'

  const imageByPage = useMemo(() => {
    const map = new Map<number, number>()
    for (const page of extraction?.pages ?? []) map.set(page.page_number, page.image_file_id)
    return map
  }, [extraction])

  function refresh(updated: ProductionStageTemplate) {
    setTemplate(updated)
  }

  if (loading) return <LoadingState label="Загружаем предложенный план…" />
  if (error || !template) {
    return <EmptyState icon={<FileText size={24} />} title="Шаблон не найден" description={error ?? undefined} />
  }

  const blocks = [...template.blocks].sort((a, b) => a.sequence - b.sequence)
  const blockNameById = new Map(blocks.map((b) => [b.id, b.name]))
  const selectedImageId = selectedPage != null ? imageByPage.get(selectedPage) : undefined

  return (
    <div>
      <Link to="/production" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        Производство
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-medium text-ink">Проверка предложенного графа этапов</h1>
          <p className="mt-1 text-[13px] text-muted">
            Предложение ИИ по КР — поправьте, что нужно, и подтвердите, прежде чем это станет реальным планом
            производства.
          </p>
        </div>
        <Chip tone={locked ? 'success' : template.status === 'reviewed' ? 'brand' : 'neutral'}>
          {STATUS_LABEL[template.status]}
        </Chip>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="mb-3 text-[13px] font-medium text-ink">
              {selectedPage != null ? `Страница КР №${selectedPage}` : 'Страница КР'}
            </div>
            {selectedImageId != null ? (
              <PlanningImage fileId={selectedImageId} alt={`Страница КР №${selectedPage}`} />
            ) : (
              <p className="text-[12px] text-muted">
                {extraction ? 'Нажмите «стр. N» у любого пункта справа, чтобы открыть страницу.' : 'Разбор КР недоступен.'}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              template={template}
              locked={locked}
              dependencyNames={block.depends_on_ids.map((depId) => blockNameById.get(depId) ?? `Блок №${depId}`)}
              onSelectPage={setSelectedPage}
              onUpdated={refresh}
            />
          ))}
          {blocks.length === 0 && <p className="text-[13px] text-muted">ИИ не предложил ни одного блока.</p>}
        </div>
      </div>
    </div>
  )
}

function PageRefChip({ pageRef, onSelect }: { pageRef: KrPageRef | null; onSelect: (page: number) => void }) {
  if (!pageRef) return null
  return (
    <button
      type="button"
      onClick={() => onSelect(pageRef.page_number)}
      title={pageRef.note ?? undefined}
      className="inline-flex shrink-0 items-center rounded-pill bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand-dark hover:bg-brand/20"
    >
      стр. {pageRef.page_number}
    </button>
  )
}

function EditableField({
  value,
  onSave,
  locked,
  placeholder,
  multiline,
  className,
}: {
  value: string
  onSave: (next: string) => void
  locked: boolean
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  if (locked) {
    return <span className={className}>{value || <span className="text-muted">—</span>}</span>
  }

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim())
  }

  // Ширина — забота вызывающей стороны (w-full/w-14/flex-1 передаются через
  // className): нельзя жёстко задавать её здесь, иначе она конфликтует по
  // каскаду с шириной, которую задаёт конкретное поле (напр. узкая «шт»).
  const inputClassName = `rounded border border-transparent bg-transparent px-1 -mx-1 hover:border-border focus:border-brand focus:bg-white focus:outline-none ${className ?? ''}`

  return multiline ? (
    <textarea
      rows={2}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className={inputClassName}
    />
  ) : (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className={inputClassName}
    />
  )
}

function BlockCard({
  block,
  template,
  locked,
  dependencyNames,
  onSelectPage,
  onUpdated,
}: {
  block: StageTemplateBlock
  template: ProductionStageTemplate
  locked: boolean
  dependencyNames: string[]
  onSelectPage: (page: number) => void
  onUpdated: (updated: ProductionStageTemplate) => void
}) {
  async function saveBlock(patch: { name?: string; description?: string }) {
    const updated = await stageTemplateApi.updateStageTemplateBlock(template.id, block.id, patch)
    onUpdated(updated)
  }

  async function saveTask(task: TemplateBlockTask, patch: { title?: string; description?: string }) {
    const updated = await stageTemplateApi.updateStageTemplateTask(template.id, block.id, task.id, patch)
    onUpdated(updated)
  }

  async function saveMaterial(material: TemplateBlockMaterial, patch: { name?: string; unit?: string }) {
    const updated = await stageTemplateApi.updateStageTemplateMaterial(template.id, block.id, material.id, patch)
    onUpdated(updated)
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <EditableField
          value={block.name}
          locked={locked}
          onSave={(name) => saveBlock({ name })}
          className="w-full text-[14px] font-medium text-ink"
        />
        <div className="flex flex-wrap gap-1.5">
          {block.kr_page_refs.map((ref) => (
            <PageRefChip key={ref.page_number} pageRef={ref} onSelect={onSelectPage} />
          ))}
        </div>
      </div>
      <EditableField
        value={block.description ?? ''}
        locked={locked}
        multiline
        placeholder="Описание блока"
        onSave={(description) => saveBlock({ description })}
        className="w-full text-[13px] text-muted"
      />
      {dependencyNames.length > 0 && (
        <p className="mt-2 text-[12px] text-muted">Ждёт: {dependencyNames.join(', ')}</p>
      )}

      {block.tasks.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[12px] font-medium text-muted">Задачи</div>
          <div className="flex flex-col gap-2">
            {block.tasks.map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <EditableField
                    value={task.title}
                    locked={locked}
                    onSave={(title) => saveTask(task, { title })}
                    className="w-full text-ink"
                  />
                  {(task.description || !locked) && (
                    <EditableField
                      value={task.description ?? ''}
                      locked={locked}
                      multiline
                      placeholder="Описание задачи"
                      onSave={(description) => saveTask(task, { description })}
                      className="mt-0.5 block w-full text-[12px] text-muted"
                    />
                  )}
                </div>
                <PageRefChip pageRef={task.kr_page_ref} onSelect={onSelectPage} />
              </div>
            ))}
          </div>
        </div>
      )}

      {block.materials.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[12px] font-medium text-muted">Материалы</div>
          <div className="flex flex-col gap-2">
            {block.materials.map((material) => (
              <div key={material.id} className="flex items-center justify-between gap-2 text-[13px]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <EditableField
                    value={material.name}
                    locked={locked}
                    onSave={(name) => saveMaterial(material, { name })}
                    className="min-w-0 flex-1 text-ink"
                  />
                  <span className="text-muted">·</span>
                  <EditableField
                    value={material.unit}
                    locked={locked}
                    onSave={(unit) => saveMaterial(material, { unit })}
                    className="w-14 shrink-0 text-muted"
                  />
                </div>
                <PageRefChip pageRef={material.kr_page_ref} onSelect={onSelectPage} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
