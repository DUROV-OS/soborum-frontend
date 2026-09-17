import { KeyboardEvent, useState } from 'react'
import { Pencil } from 'lucide-react'

export function ChatTitleEditor({
  title,
  onRename,
  editable = true,
}: {
  title: string | null
  onRename: (title: string | null) => void
  editable?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title ?? '')

  function startEditing() {
    setValue(title ?? '')
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed !== (title ?? '')) onRename(trimmed || null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') {
      setValue(title ?? '')
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="Без названия"
        maxLength={255}
        className="w-48 rounded-sm border border-border bg-surface px-2 py-0.5 text-[13px] text-ink"
      />
    )
  }

  if (!editable) {
    return <span className="text-[13px] font-medium text-ink">{title ?? 'Без названия'}</span>
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-ai-accent"
    >
      {title ?? 'Без названия'}
      <Pencil size={12} className="text-muted" />
    </button>
  )
}
