import { useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Drawer } from '@/shared/ui/Drawer'
import { Textarea } from '@/shared/ui/Field'
import { FileLink } from '@/shared/ui/FileLink'
import { Stepper } from '@/shared/ui/Stepper'
import { useMarketingStore } from '../store'
import { isGroupEditable, isGroupVisible, nextStageOf, stageLabel } from '../rules'
import { CONTENT_STAGES, ContentItem } from '../types'
import { PostLinksEditor } from './PostLinksEditor'
import { AnalysisPanel } from './AnalysisPanel'

export function ContentDetailDrawer({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  const advance = useMarketingStore((s) => s.advance)
  const canEdit = accessLevelAtLeast(useAccessLevel('marketing'), 'edit')
  const [error, setError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)

  if (!item) return null

  const itemId = item.id
  const next = nextStageOf(item.stage)

  async function handleAdvance() {
    setAdvancing(true)
    const result = await advance(itemId)
    setAdvancing(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось перевести стадию')
  }

  return (
    <Drawer open={!!item} onClose={onClose} title={item.title} width="max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <div className="mb-3 flex items-center justify-between">
            <Stepper steps={CONTENT_STAGES} currentKey={item.stage} />
            {next && canEdit && (
              <Button size="sm" onClick={handleAdvance} disabled={advancing} className="ml-4 shrink-0">
                {advancing ? 'Переход…' : `На «${stageLabel(next)}»`}
              </Button>
            )}
          </div>
          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>

        <BasicSection item={item} canEdit={canEdit} />
        {isGroupVisible(item, 'raw') && <RawSection item={item} canEdit={canEdit} />}
        {isGroupVisible(item, 'final') && <FinalSection item={item} canEdit={canEdit} />}
        {isGroupVisible(item, 'postLinks') && (
          <Panel title="Ссылки на посты">
            <PostLinksEditor contentId={item.id} links={item.post_links} canEdit={canEdit} />
          </Panel>
        )}
        {isGroupVisible(item, 'analysis') && (
          <Panel title="Анализ">
            <AnalysisPanel item={item} canEdit={canEdit} />
          </Panel>
        )}
      </div>
    </Drawer>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-ink">{title}</h3>
      {children}
    </div>
  )
}

function BasicSection({ item, canEdit }: { item: ContentItem; canEdit: boolean }) {
  const updateBasic = useMarketingStore((s) => s.updateBasic)
  const [description, setDescription] = useState(item.description ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await updateBasic(item.id, { description: description || undefined })
    setSaving(false)
  }

  return (
    <Panel title="Описание">
      {canEdit ? (
        <>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          {description !== (item.description ?? '') && (
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-ink">{item.description || '—'}</p>
      )}
      <p className="mt-2 text-[12px] text-muted">
        Платформы: {item.platforms.join(', ') || '—'} · Исполнители: {item.assignees.map((a) => a.full_name).join(', ') || '—'}
      </p>
    </Panel>
  )
}

function RawSection({ item, canEdit }: { item: ContentItem; canEdit: boolean }) {
  const updateRaw = useMarketingStore((s) => s.updateRaw)
  const editable = isGroupEditable(item, 'raw') && canEdit
  const [text, setText] = useState(item.raw_texts ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await updateRaw(item.id, text || undefined)
    setSaving(false)
  }

  return (
    <Panel title="Сырой материал">
      {editable ? (
        <>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст, тезисы, ссылки на исходники…" />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink">{item.raw_texts || '—'}</p>
      )}
      <FileListNote files={item.raw_files} />
    </Panel>
  )
}

function FinalSection({ item, canEdit }: { item: ContentItem; canEdit: boolean }) {
  const updateFinal = useMarketingStore((s) => s.updateFinal)
  const [text, setText] = useState(item.final_texts ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await updateFinal(item.id, text || undefined)
    setSaving(false)
  }

  return (
    <Panel title="Готовый материал">
      {canEdit ? (
        <>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Финальный текст публикации…" />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink">{item.final_texts || '—'}</p>
      )}
      <FileListNote files={item.final_files} />
    </Panel>
  )
}

function FileListNote({ files }: { files: { id: number; filename: string }[] }) {
  return (
    <div className="mt-2">
      {files.length > 0 && (
        <ul className="mb-1 flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id}>
              <FileLink id={f.id} filename={f.filename} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-muted">
        Прикладывать файлы к материалам пока нельзя — у бэкенда ещё нет загрузки для этого раздела.
      </p>
    </div>
  )
}
