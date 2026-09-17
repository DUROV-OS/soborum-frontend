import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { useMarketingStore } from '../store'
import { PostLink } from '../types'

export function PostLinksEditor({
  contentId,
  links,
  canEdit,
}: {
  contentId: number
  links: PostLink[]
  canEdit: boolean
}) {
  const setPostLinks = useMarketingStore((s) => s.setPostLinks)
  const [rows, setRows] = useState(links.map((l) => ({ platform: l.platform, url: l.url })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    const result = await setPostLinks(contentId, rows.filter((r) => r.platform && r.url))
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить')
  }

  if (!canEdit) {
    return links.length === 0 ? (
      <p className="text-[13px] text-muted">Ссылок пока нет.</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {links.map((l, i) => (
          <li key={i} className="text-[13px] text-ink">
            {l.platform}: <a href={l.url} target="_blank" rel="noreferrer" className="text-brand-dark hover:underline">{l.url}</a>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <div className="w-28">
              <Input
                placeholder="Платформа"
                value={row.platform}
                onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, platform: e.target.value } : r)))}
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="https://…"
                value={row.url}
                onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, url: e.target.value } : r)))}
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              className="rounded-pill p-2 text-muted hover:bg-surface-muted hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { platform: '', url: '' }])}
          className="flex items-center gap-1.5 text-[13px] text-brand-dark hover:underline"
        >
          <Plus size={14} />
          Добавить ссылку
        </button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
