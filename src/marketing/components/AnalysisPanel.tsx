import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input, Textarea } from '@/shared/ui/Field'
import { useMarketingStore } from '../store'
import { ContentItem } from '../types'

export function AnalysisPanel({ item, canEdit }: { item: ContentItem; canEdit: boolean }) {
  const updateAnalysis = useMarketingStore((s) => s.updateAnalysis)
  const [notes, setNotes] = useState(item.analysis_notes ?? '')
  const [reach, setReach] = useState<{ platform: string; value: number }[]>(
    Object.entries(item.analysis_reach ?? {}).map(([platform, value]) => ({ platform, value })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    const reachObj = Object.fromEntries(reach.filter((r) => r.platform).map((r) => [r.platform, r.value]))
    const result = await updateAnalysis(item.id, notes || undefined, reach.length > 0 ? reachObj : undefined)
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink">{item.analysis_notes || '—'}</p>
        {Object.entries(item.analysis_reach ?? {}).map(([platform, value]) => (
          <p key={platform} className="text-[13px] text-muted">
            {platform}: {value}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea rows={2} placeholder="Заметки по итогам" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex flex-col gap-2">
        {reach.map((row, index) => (
          <div key={index} className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Платформа"
                value={row.platform}
                onChange={(e) => setReach((prev) => prev.map((r, i) => (i === index ? { ...r, platform: e.target.value } : r)))}
              />
            </div>
            <div className="w-32">
              <Input
                type="number"
                placeholder="Охват"
                value={row.value || ''}
                onChange={(e) =>
                  setReach((prev) => prev.map((r, i) => (i === index ? { ...r, value: Number(e.target.value) } : r)))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => setReach((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-pill p-2 text-muted hover:bg-surface-muted hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setReach((prev) => [...prev, { platform: '', value: 0 }])}
          className="flex items-center gap-1.5 text-[13px] text-brand-dark hover:underline"
        >
          <Plus size={14} />
          Добавить охват
        </button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}
