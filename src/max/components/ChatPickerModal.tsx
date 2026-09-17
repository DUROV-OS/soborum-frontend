import { useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import * as maxApi from '@/max/api'
import { MaxChatSummary } from '@/max/types'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

/**
 * Диалог выбора чата MAX с поиском по названию/участнику. Общий для всех
 * мест, где чат MAX привязывается к сущности (поставщик, клиент): вызывающая
 * сторона решает, куда привязать выбранный чат, через `onPick`.
 *
 * `requireLabel` (0053) — после выбора чата запрашивает название привязки
 * (различает несколько чатов одного клиента, например «С клиентом» и
 * «С помощником») и передаёт его вторым аргументом `onPick`.
 */
export function ChatPickerModal({
  open,
  onClose,
  onPick,
  title = 'Привязать чат MAX',
  requireLabel = false,
}: {
  open: boolean
  onClose: () => void
  onPick: (chat: MaxChatSummary, label?: string) => Promise<{ ok: boolean; reason?: string }>
  title?: string
  requireLabel?: boolean
}) {
  const [chats, setChats] = useState<MaxChatSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [pendingChat, setPendingChat] = useState<MaxChatSummary | null>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setError(null)
    setPendingChat(null)
    setLabel('')
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

  async function pick(chat: MaxChatSummary, chatLabel?: string) {
    setLinkingId(chat.id)
    setError(null)
    const result = await onPick(chat, chatLabel)
    setLinkingId(null)
    if (result.ok) {
      onClose()
    } else {
      setError(result.reason ?? 'Не удалось привязать чат')
      setPendingChat(null)
    }
  }

  function selectChat(chat: MaxChatSummary) {
    if (requireLabel) {
      setPendingChat(chat)
      setLabel('')
      setError(null)
    } else {
      pick(chat)
    }
  }

  function confirmLabel() {
    if (!pendingChat) return
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Укажите название привязки')
      return
    }
    pick(pendingChat, trimmed)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-xl">
      {pendingChat ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink">
            Чат «{pendingChat.title ?? `Чат ${pendingChat.id}`}» — укажите название привязки (например,
            «С клиентом», «С помощником»):
          </p>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Название привязки"
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmLabel()
            }}
          />
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingChat(null)} disabled={linkingId !== null}>
              Назад
            </Button>
            <Button size="sm" onClick={confirmLabel} disabled={linkingId !== null}>
              {linkingId !== null ? 'Привязка…' : 'Привязать'}
            </Button>
          </div>
        </div>
      ) : (
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
                onClick={() => selectChat(chat)}
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
      )}
    </Modal>
  )
}
