import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, MessageSquareText, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Select, Textarea } from '@/shared/ui/Field'
import { ChatPickerModal } from '@/max/components/ChatPickerModal'
import * as maxApi from '@/max/api'
import { MaxMessage } from '@/max/types'
import { useClientsStore } from '../store'
import { CLIENT_CHAT_STATES, Client, ClientChatState } from '../types'
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
    return <LinkChatPrompt client={client} onLink={(chatId) => setMaxChat(client.id, chatId)} />
  }
  return <ChatThread client={client} chatId={client.max_chat_id} onUnlink={() => setMaxChat(client.id, null)} />
}

function LinkChatPrompt({
  client,
  onLink,
}: {
  client: Client
  onLink: (chatId: number) => Promise<{ ok: boolean; reason?: string }>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')

  return (
    <Section title="Переписка в MAX">
      <p className="mb-3 text-[13px] text-muted">
        Переписка с {client.full_name} ещё не привязана к чату MAX. Найдите нужный чат — после привязки
        здесь появятся сообщения и поле для ответа.
      </p>
      {canEdit && (
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Link2 size={14} />
          Привязать чат
        </Button>
      )}
      <ChatPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(chat) => onLink(chat.id)}
        title="Привязать чат к клиенту"
      />
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

  const setChatState = useClientsStore((s) => s.setChatState)
  const [stateSaving, setStateSaving] = useState(false)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')

  async function changeState(state: ClientChatState) {
    setStateSaving(true)
    await setChatState(client.id, state)
    setStateSaving(false)
  }

  return (
    <Section title="Переписка в MAX">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-muted">
          {title ? `Чат «${title}»` : `Чат MAX #${chatId}`}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {canEdit && (
            <Select
              value={client.max_chat_state ?? ''}
              onChange={(e) => changeState(e.target.value as ClientChatState)}
              disabled={stateSaving}
              className="h-7 py-0 text-[12px]"
            >
              <option value="" disabled>
                Состояние переписки
              </option>
              {CLIENT_CHAT_STATES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
          <Link
            to={`/chats/${chatId}`}
            className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-brand-dark hover:underline"
          >
            <MessageSquareText size={13} />
            Открыть в MAX
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={onUnlink}
              className="text-[12px] text-muted underline-offset-2 hover:text-danger hover:underline"
            >
              Отвязать
            </button>
          )}
        </div>
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
