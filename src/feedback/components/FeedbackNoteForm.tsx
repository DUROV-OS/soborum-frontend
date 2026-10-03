import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Field'
import { useFeedbackStore } from '../store'
import { FEEDBACK_NOTE_LABEL, FeedbackNoteKind } from '../types'

const MAX_CHARS = 5000

/**
 * Запись администратора в ленту заявки (0090): комментарий сотруднику или
 * «изменение в системе» — что именно поменяли по этой заявке.
 */
export function FeedbackNoteForm({ requestId }: { requestId: number }) {
  const addEvent = useFeedbackStore((s) => s.addEvent)
  const [kind, setKind] = useState<FeedbackNoteKind>('comment')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    setError(null)
    try {
      await addEvent(requestId, kind, text.trim())
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить запись')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Вид записи" className="flex flex-wrap gap-2">
        {(Object.keys(FEEDBACK_NOTE_LABEL) as FeedbackNoteKind[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-pill border px-3 py-1 text-[12px] font-medium transition-colors ${
              kind === value ? 'border-brand bg-brand/10 text-brand-dark' : 'border-border text-muted hover:border-brand/40'
            }`}
          >
            {FEEDBACK_NOTE_LABEL[value]}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        maxLength={MAX_CHARS}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Текст записи"
        placeholder={
          kind === 'change'
            ? 'Что изменили в системе по этой заявке — сотрудник увидит это в «Моих заявках»'
            : 'Комментарий сотруднику — он увидит его в «Моих заявках»'
        }
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSend} disabled={!text.trim() || sending}>
          {sending ? 'Отправка…' : 'Добавить в ленту'}
        </Button>
      </div>
    </div>
  )
}
