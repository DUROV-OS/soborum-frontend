import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { Section } from './PanelPrimitives'

export function NotesPanel({ client }: { client: Client }) {
  const current = useAuthStore((s) => s.current)
  const addNote = useClientsStore((s) => s.addNote)
  const deleteNote = useClientsStore((s) => s.deleteNote)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!draft.trim()) return
    setSaving(true)
    const result = await addNote(client.id, draft.trim())
    setSaving(false)
    if (result.ok) setDraft('')
    setError(result.ok ? null : result.reason ?? 'Не удалось сохранить заметку')
  }

  function authorLabel(authorId: number) {
    return authorId === current?.id ? current.full_name : `Сотрудник №${authorId}`
  }

  return (
    <Section title="Заметки">
      {client.notes.length > 0 && (
        <div className="mb-4 flex flex-col gap-2.5">
          {client.notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 rounded-md bg-surface-muted px-3 py-2">
              <div>
                <p className="text-[13px] text-ink">{note.text}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {authorLabel(note.author_id)} · {new Date(note.created_at).toLocaleString('ru-RU')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteNote(client.id, note.id)}
                aria-label="Удалить заметку"
                className="rounded-pill p-1 text-muted hover:bg-surface hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Добавить заметку…" />
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      <div className="mt-2">
        <Button size="sm" variant="secondary" onClick={submit} disabled={!draft.trim() || saving}>
          {saving ? 'Сохранение…' : 'Добавить'}
        </Button>
      </div>
    </Section>
  )
}
