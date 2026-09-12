import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, Send } from 'lucide-react'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Input, Textarea } from '@/shared/ui/Field'
import * as maxApi from '@/max/api'
import { MaxMessage } from '@/max/types'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { MaxAttachList } from './MaxAttachments'
import { Section } from './PanelPrimitives'

/** Как часто подтягивать новые сообщения открытого чата, мс. */
const POLL_MS = 20000

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Не удалось связаться с мессенджером MAX'
}

export function MaxChatPanel({ client }: { client: Client }) {
  const setMaxChat = useClientsStore((s) => s.setMaxChat)

  if (client.max_chat_id === null) {
    return <LinkChatForm client={client} onLink={(id) => setMaxChat(client.id, id)} />
  }
  return <ChatThread client={client} chatId={client.max_chat_id} onUnlink={() => setMaxChat(client.id, null)} />
}

function LinkChatForm({
  client,
  onLink,
}: {
  client: Client
  onLink: (chatId: number) => Promise<{ ok: boolean; reason?: string }>
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = value.trim()
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      setError('Введите числовой id чата MAX')
      return
    }
    setSaving(true)
    const result = await onLink(Number(trimmed))
    setSaving(false)
    setError(result.ok ? null : result.reason ?? 'Не удалось привязать чат')
    if (result.ok) setValue('')
  }

  return (
    <Section title="Переписка в MAX">
      <p className="mb-3 text-[13px] text-muted">
        Переписка с {client.full_name} ещё не привязана к чату MAX. Укажите id чата — после этого здесь
        появятся сообщения и поле для ответа.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="id чата MAX (0 — «Избранное»)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <Button size="sm" onClick={submit} disabled={saving} className="shrink-0">
          <Link2 size={14} />
          {saving ? 'Привязка…' : 'Привязать'}
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Section>
  )
}

function ChatThread({
  client,
  chatId,
  onUnlink,
}: {
  client: Client
  chatId: number
  onUnlink: () => Promise<{ ok: boolean; reason?: string }>
}) {
  const [messages, setMessages] = useState<MaxMessage[] | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [isGroup, setIsGroup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottomRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const history = await maxApi.getChat(chatId, { limit: 80 })
      setMessages(history.messages)
      setTitle(history.title)
      setIsGroup(history.isGroup)
      setError(null)
    } catch (err) {
      setError(reasonOf(err))
    }
  }, [chatId])

  useEffect(() => {
    setMessages(null)
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  async function send() {
    const text = draft.trim()
    if (text === '' || sending) return
    setSending(true)
    try {
      const result = await maxApi.sendMessage(chatId, text)
      if (result.message) {
        setMessages((prev) => [...(prev ?? []), result.message as MaxMessage])
      }
      setDraft('')
      pinnedToBottomRef.current = true
      setError(null)
      refresh()
    } catch (err) {
      setError(reasonOf(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Section title="Переписка в MAX">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          {title ? `Чат «${title}»` : `Чат MAX #${chatId}`}
        </p>
        <button
          type="button"
          onClick={onUnlink}
          className="text-[12px] text-muted underline-offset-2 hover:text-danger hover:underline"
        >
          Отвязать
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="mb-3 flex max-h-[420px] min-h-[120px] flex-col gap-2 overflow-y-auto rounded-md bg-surface-muted p-3"
      >
        {messages === null && !error && <p className="text-[12px] text-muted">Загрузка переписки…</p>}
        {messages !== null && messages.length === 0 && (
          <p className="text-[12px] text-muted">Сообщений пока нет.</p>
        )}
        {messages?.map((msg, i, arr) => {
          const prev = i > 0 ? arr[i - 1] : null
          const showAuthor = !prev || prev.isSystem || prev.senderId !== msg.senderId
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              chatId={chatId}
              isGroup={isGroup}
              showAuthor={showAuthor}
            />
          )
        })}
      </div>

      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={`Написать ${client.full_name}…`}
        />
        <Button size="sm" onClick={send} disabled={!draft.trim() || sending} className="shrink-0">
          <Send size={14} />
          {sending ? 'Отправка…' : 'Отправить'}
        </Button>
      </div>
    </Section>
  )
}

function MessageBubble({
  msg,
  chatId,
  isGroup,
  showAuthor,
}: {
  msg: MaxMessage
  chatId: number
  isGroup: boolean
  showAuthor: boolean
}) {
  if (msg.isSystem) {
    const who = msg.senderName
    const what = msg.systemText ?? 'служебное сообщение'
    return (
      <p className="py-0.5 text-center text-[11px] text-muted">
        {who ? `${who} ${what}` : what}
      </p>
    )
  }

  if (!msg.text && msg.attaches.length === 0) return null

  const time = msg.time ? new Date(msg.time).toLocaleString('ru-RU') : ''
  const outgoing = msg.isOutgoing
  const authorLabel =
    isGroup && !outgoing && showAuthor ? msg.senderName ?? 'Участник' : null
  return (
    <div className={`flex flex-col ${outgoing ? 'items-end' : 'items-start'}`}>
      {authorLabel && (
        <span className="text-[11px] font-medium text-brand-dark">{authorLabel}</span>
      )}
      <div
        className={`max-w-[80%] rounded-md px-3 py-2 text-[13px] ${
          outgoing ? 'bg-brand text-white' : 'bg-surface text-ink'
        }`}
      >
        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
        <MaxAttachList attaches={msg.attaches} chatId={chatId} messageId={msg.id} />
      </div>
      {time && <span className="mt-0.5 text-[11px] text-muted">{time}</span>}
    </div>
  )
}
