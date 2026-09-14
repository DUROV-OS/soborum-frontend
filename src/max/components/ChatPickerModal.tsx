import { useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import * as maxApi from '@/max/api'
import { MaxChatSummary } from '@/max/types'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

/**
 * Диалог выбора чата MAX с поиском по названию/участнику. Общий для всех
 * мест, где чат MAX привязывается к сущности (поставщик, клиент): вызывающая
 * сторона решает, куда привязать выбранный чат, через `onPick`.
 */
export function ChatPickerModal({
  open,
  onClose,
  onPick,
  title = 'Привязать чат MAX',
}: {
  open: boolean
  onClose: () => void
  onPick: (chat: MaxChatSummary) => Promise<{ ok: boolean; reason?: string }>
  title?: string
}) {
  const [chats, setChats] = useState<MaxChatSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    setLoading(true)
    maxApi
      .listChats()
      .then((res) => setChats(res.chats))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить чаты MAX'))
      .finally(() => setLoading(false))
  }, [open])

  const q = query.trim().toLowerCase()
  const visible = chats.filter((c) => {
    if (!q) return true
    const haystack = [c.title, c.lastMessage?.senderName, c.lastMessage?.text].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(q)
  })

  async function pick(chat: MaxChatSummary) {
    setLinkingId(chat.id)
    setError(null)
    const result = await onPick(chat)
    setLinkingId(null)
    if (result.ok) onClose()
    else setError(result.reason ?? 'Не удалось привязать чат')
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-xl">
      <div className="flex flex-col gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или участнику…"
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {loading && <p className="py-6 text-center text-[13px] text-muted">Загрузка чатов…</p>}
          {!loading && visible.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">Чаты не найдены</p>
          )}
          {visible.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => pick(chat)}
              disabled={linkingId !== null}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:bg-surface-muted disabled:opacity-50"
            >
              <MessagesSquare size={16} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {chat.title ?? `Чат ${chat.id}`}
                </span>
                {chat.lastMessage?.text && (
                  <span className="block truncate text-[12px] text-muted">{chat.lastMessage.text}</span>
                )}
              </span>
              {linkingId === chat.id && <span className="text-[12px] text-muted">…</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
