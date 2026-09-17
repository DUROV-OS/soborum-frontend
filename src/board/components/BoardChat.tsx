import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip, ChipTone } from '@/shared/ui/Chip'
import { Markdown } from '@/shared/ui/Markdown'
import { useBoardStore } from '../store'
import { BoardDiscussionMessage, CouncilStance } from '../types'

const STANCE_LABEL: Record<CouncilStance, string> = {
  support: 'За',
  caution: 'С оговорками',
  oppose: 'Против',
}

const STANCE_TONE: Record<CouncilStance, ChipTone> = {
  support: 'success',
  caution: 'warning',
  oppose: 'danger',
}

function MessageRow({ message }: { message: BoardDiscussionMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-brand px-3.5 py-2.5 text-[13px] leading-relaxed text-white sm:max-w-lg">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[92%] rounded-md bg-surface-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-ink sm:max-w-2xl">
        <Markdown text={message.content} />
      </div>

      {message.council && message.council.length > 0 && (
        <div className="flex max-w-[92%] flex-col gap-2 sm:max-w-2xl">
          {message.council.map((op) => (
            <div key={op.role} className="rounded-md border border-border bg-surface p-2.5">
              <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-ink">
                <span>{op.role_label}</span>
                <Chip tone={STANCE_TONE[op.stance]}>{STANCE_LABEL[op.stance]}</Chip>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{op.opinion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BoardChat() {
  const messages = useBoardStore((s) => s.chatMessages)
  const loading = useBoardStore((s) => s.chatLoading)
  const sending = useBoardStore((s) => s.chatSending)
  const pending = useBoardStore((s) => s.chatPending)
  const error = useBoardStore((s) => s.chatError)
  const loadChat = useBoardStore((s) => s.loadChat)
  const sendChatMessage = useBoardStore((s) => s.sendChatMessage)
  const canEdit = accessLevelAtLeast(useAccessLevel('board'), 'edit')

  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadChat()
  }, [loadChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, sending])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    await sendChatMessage(text)
  }

  return (
    <section className="mt-10 rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-medium text-ink">Чат с советом директоров</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Свободный диалог с ИИ-советом по компании в целом — вопросы и разбор вариантов без правок дерева.
        </p>
      </div>

      <div className="max-h-[420px] min-h-[160px] overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-[13px] text-muted">Загрузка…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.length === 0 && !pending && !sending && (
              <p className="text-[13px] text-muted">
                Задайте совету вопрос — например, где сейчас основные риски и на чём стоит сфокусироваться
                в этом квартале.
              </p>
            )}

            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}

            {pending && (
              <div className="flex flex-col items-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-brand px-3.5 py-2.5 text-[13px] leading-relaxed text-white opacity-70 sm:max-w-lg">
                  {pending}
                </div>
              </div>
            )}

            {sending && (
              <div className="flex items-center gap-1.5 rounded-md bg-surface-muted px-3.5 py-2.5 text-[13px] text-muted">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                </span>
                Совет обдумывает ответ — это может занять до минуты
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-[12px] text-danger">{error}</p>}

      {canEdit && (
        <div className="flex items-end gap-2 border-t border-border px-4 py-3">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Сообщение совету директоров…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted"
          />
          <Button onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Отправить">
            <Send size={15} />
          </Button>
        </div>
      )}
    </section>
  )
}
