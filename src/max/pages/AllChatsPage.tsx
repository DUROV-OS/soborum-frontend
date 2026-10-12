import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Copy, Link2, RefreshCw, Search, Send, UserCheck, UserPlus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { HelpButton } from '@/shared/ui/HelpButton'
import { LoadingState } from '@/shared/ui/LoadingState'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { editMessage, getChat, listChats, sendMessage, sendMessageWithFile } from '../api'
import { MaxChatHistory, MaxChatSummary, MaxDialogPeer, MaxMessage } from '../types'
import { formatPhone, phoneMatches } from '../phone'
import { MaxComposerInput } from '../components/MaxComposerInput'
import { MaxMessageItem } from '../components/MaxMessageItem'
import { ReadMark } from '../components/ReadMark'
import { LinkClientModal } from '../components/LinkClientModal'
import { AddContactModal } from '../components/AddContactModal'
import { MaxAttachButton, MaxPendingFile } from '../components/MaxFilePicker'
import { ForwardMessageModal, MaxMessageActions } from '../components/MaxMessageActions'
import { useMaxEvents } from '../realtime'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Все чаты MAX',
    body: (
      <p>
        Здесь собраны все чаты организации из мессенджера MAX — свежие сверху. Данные общие, поэтому раздел
        виден каждому сотруднику. Кликните по чату слева, чтобы открыть переписку.
      </p>
    ),
  },
  {
    title: 'Ответы и вложения',
    body: (
      <p>
        В открытом чате можно написать сообщение — оно уйдёт от общего аккаунта организации. Фото
        показываются сразу, файлы, видео и голосовые открываются по клику по одноразовой ссылке.
      </p>
    ),
  },
  {
    title: 'Новый контакт',
    body: (
      <p>
        Кнопка с человечком над списком — начать переписку с тем, кого ещё нет в чатах. Введите номер и
        имя: найдём человека в MAX, добавим в контакты аккаунта и откроем диалог. В списке чатов он
        появится после первого сообщения.
      </p>
    ),
  },
]

function previewText(chat: MaxChatSummary): string {
  const msg = chat.lastMessage
  if (!msg) return 'Нет сообщений'
  if (msg.isSystem) return msg.systemText ?? 'служебное сообщение'
  const body = msg.text.trim() || (msg.attaches?.length ? '📎 Вложение' : '—')
  return msg.isOutgoing ? `Вы: ${body}` : body
}

function relTime(ms: number | null): string {
  if (!ms) return ''
  return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: ru })
}

export function AllChatsPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const activeId = chatId != null ? Number(chatId) : null
  const onboarding = useSectionOnboarding('chats')

  const [chats, setChats] = useState<MaxChatSummary[]>([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [addContactOpen, setAddContactOpen] = useState(false)

  const [history, setHistory] = useState<MaxChatHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Сообщение, которое сейчас правим в поле ввода (0098). */
  const [editing, setEditing] = useState<MaxMessage | null>(null)
  const [forwarding, setForwarding] = useState<MaxMessage | null>(null)
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Пользователь внизу ленты — новые сообщения докручиваем; листает историю
  // выше — позицию не трогаем (0092).
  const pinnedToBottomRef = useRef(true)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  /** `silent` — фоновое обновление по событию WebSocket: без спиннера, а
   * при сбое остаётся прежний список. */
  const loadChats = useCallback(async (silent = false) => {
    if (!silent) {
      setChatsLoading(true)
      setChatsError(null)
    }
    try {
      const res = await listChats()
      setChats(res.chats)
      setChatsError(null)
    } catch (err) {
      if (!silent) setChatsError(err instanceof ApiError ? err.message : 'Не удалось загрузить чаты')
    } finally {
      if (!silent) setChatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  /** Тихо перечитать открытую ленту (новое сообщение пришло по WebSocket). */
  const refreshHistory = useCallback(async (id: number) => {
    try {
      const res = await getChat(id, { limit: 80 })
      if (activeIdRef.current === id) setHistory(res)
    } catch {
      /* фоновое обновление — оставляем то, что уже показано */
    }
  }, [])

  const online = useMaxEvents(({ chatIds, resync }) => {
    loadChats(true)
    const id = activeIdRef.current
    if (id != null && !Number.isNaN(id) && (resync || chatIds.has(id))) refreshHistory(id)
  })

  useEffect(() => {
    pinnedToBottomRef.current = true
    setFile(null)
    setSendError(null)
    setNotice(null)
    setEditing(null)
    if (activeId == null || Number.isNaN(activeId)) {
      setHistory(null)
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    getChat(activeId, { limit: 80 })
      .then((res) => {
        if (!cancelled) setHistory(res)
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof ApiError ? err.message : 'Не удалось загрузить переписку')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottomRef.current) el.scrollTo({ top: el.scrollHeight })
  }, [history])

  function onThreadScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(
      (c) =>
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.lastMessage?.text ?? '').toLowerCase().includes(q) ||
        phoneMatches(c.phone, q),
    )
  }, [chats, query])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (activeId == null || (!draft.trim() && !file) || sending) return
    setSending(true)
    try {
      if (editing) await editMessage(activeId, editing.id, draft.trim())
      else if (file) await sendMessageWithFile(activeId, file, draft.trim())
      else await sendMessage(activeId, draft.trim())
      setDraft('')
      setFile(null)
      setEditing(null)
      setSendError(null)
      setNotice(null)
      pinnedToBottomRef.current = true
      const [fresh] = await Promise.all([getChat(activeId, { limit: 80 }), loadChats()])
      setHistory(fresh)
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  function startEdit(message: MaxMessage) {
    setEditing(message)
    setDraft(message.text)
    setFile(null)
    setSendError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setDraft('')
  }

  async function onForwarded(toChat: MaxChatSummary) {
    setForwarding(null)
    setNotice(`Переслано в «${toChat.title ?? `Чат ${toChat.id}`}»`)
    if (activeId == null) return
    const [fresh] = await Promise.all([getChat(activeId, { limit: 80 }), loadChats()])
    setHistory(fresh)
  }

  const showThread = activeId != null

  return (
    <div className="flex h-[calc(100vh-8rem)] min-w-0 gap-4">
      {/* Список чатов */}
      <div
        className={`w-full min-w-0 flex-col rounded-md border border-border bg-surface sm:flex sm:w-80 sm:shrink-0 ${
          showThread ? 'hidden' : 'flex'
        }`}
      >
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по чатам"
                className="w-full rounded-sm border border-border bg-surface py-1.5 pl-8 pr-2 text-[13px] text-ink outline-none focus:border-brand/50"
              />
            </div>
            <button
              type="button"
              onClick={() => loadChats()}
              aria-label="Обновить список"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border text-muted transition-colors hover:border-brand/40 hover:text-brand-dark"
            >
              <RefreshCw size={14} className={chatsLoading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setAddContactOpen(true)}
              aria-label="Новый контакт"
              title="Новый контакт — написать по номеру телефона"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border text-muted transition-colors hover:border-brand/40 hover:text-brand-dark"
            >
              <UserPlus size={14} />
            </button>
            <HelpButton onClick={onboarding.show} />
          </div>
          <div
            className="flex items-center gap-1.5 px-0.5 text-[11px] text-muted"
            title={
              online
                ? 'Новые сообщения появляются сами, без обновления страницы'
                : 'Нет связи с сервером — переподключаемся, новые сообщения подтянутся после'
            }
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-muted'}`} />
            {online ? 'Онлайн' : 'Переподключение…'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {chatsLoading && chats.length === 0 && <p className="px-2 py-2 text-[12px] text-muted">Загрузка…</p>}
          {chatsError && <p className="px-2 py-2 text-[12px] text-danger">{chatsError}</p>}
          {!chatsLoading && !chatsError && filtered.length === 0 && (
            <p className="px-2 py-2 text-[12px] text-muted">
              {query ? 'Ничего не найдено' : 'Чатов пока нет'}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/chats/${c.id}`)}
                className={`flex flex-col gap-0.5 rounded-sm px-3 py-2 text-left transition-colors ${
                  c.id === activeId ? 'bg-brand/10' : 'hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{c.title ?? `Чат ${c.id}`}</span>
                  <span className="shrink-0 text-[10px] text-muted">{relTime(c.lastEventTime)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
                    <ReadMark status={c.lastMessage?.readStatus} />
                    <span className="truncate">{previewText(c)}</span>
                  </span>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-pill bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Переписка */}
      <div
        className={`min-w-0 flex-1 flex-col rounded-md border border-border bg-surface sm:flex ${
          showThread ? 'flex' : 'hidden'
        }`}
      >
        {activeId == null ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState title="Выберите чат" description="Слева — все чаты MAX. Откройте любой, чтобы увидеть переписку." />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border p-3">
              <button
                type="button"
                onClick={() => navigate('/chats')}
                aria-label="Назад к списку"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-muted hover:bg-surface-muted sm:hidden"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">
                  {history?.title ?? chats.find((c) => c.id === activeId)?.title ?? `Чат ${activeId}`}
                </div>
                {history && <div className="text-[11px] text-muted">{history.count} сообщений</div>}
                {history?.peer && <PeerPhone peer={history.peer} />}
              </div>
              <ChatClientSwitcher
                chat={chats.find((c) => c.id === activeId)}
                peer={history?.chatId === activeId ? history.peer : null}
                onLinked={() => loadChats()}
              />
            </div>

            <div ref={scrollRef} onScroll={onThreadScroll} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {historyLoading && !history && <LoadingState label="Загрузка переписки…" />}
              {historyError && <p className="text-[12px] text-danger">{historyError}</p>}
              {history && history.messages.length === 0 && !historyLoading && (
                <p className="text-center text-[12px] text-muted">В этом чате пока нет сообщений</p>
              )}
              {history?.messages.map((m, i) => {
                const prev = i > 0 ? history.messages[i - 1] : null
                const showAuthor = !prev || prev.isSystem || prev.senderId !== m.senderId
                return (
                  <MaxMessageItem
                    key={m.id}
                    message={m}
                    chatId={activeId}
                    isGroup={history.isGroup}
                    showAuthor={showAuthor}
                    actions={<MaxMessageActions message={m} onForward={setForwarding} onEdit={startEdit} />}
                  />
                )
              })}
            </div>

            <form onSubmit={handleSend} className="border-t border-border p-3">
              {sendError && <p className="mb-2 text-[12px] text-danger">{sendError}</p>}
              {notice && !sendError && <p className="mb-2 text-[12px] text-muted">{notice}</p>}
              {editing && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-sm bg-surface-muted px-2.5 py-1.5 text-[12px]">
                  <span className="min-w-0 truncate text-muted">
                    Редактирование: <span className="text-ink">{editing.text || 'сообщение с файлом'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={sending}
                    className="shrink-0 text-muted underline-offset-2 hover:text-danger hover:underline"
                  >
                    Отмена
                  </button>
                </div>
              )}
              {file && <MaxPendingFile file={file} onRemove={() => setFile(null)} disabled={sending} />}
              <div className="flex items-end gap-2">
                {!editing && (
                  <MaxAttachButton
                    onPick={(picked) => {
                      setFile(picked)
                      setSendError(null)
                    }}
                    onError={setSendError}
                    disabled={sending}
                  />
                )}
                <MaxComposerInput
                  value={draft}
                  onChange={setDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e)
                    }
                    if (e.key === 'Escape' && editing) cancelEdit()
                  }}
                  placeholder="Сообщение…"
                />
                <Button type="submit" size="sm" disabled={(!draft.trim() && !file) || sending}>
                  <Send size={14} />
                  {sending ? (editing ? 'Сохранение…' : 'Отправка…') : editing ? 'Сохранить' : 'Отправить'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      {activeId != null && (
        <ForwardMessageModal
          fromChatId={activeId}
          message={forwarding}
          onClose={() => setForwarding(null)}
          onForwarded={onForwarded}
        />
      )}

      <AddContactModal
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        onStarted={(res) => navigate(`/chats/${res.chatId}`)}
      />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Все чаты»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}

/** Номер собеседника под именем в шапке (0099) — чтобы внести человека в
 * карточку клиента. MAX отдаёт номер только тех, кто есть в контактах
 * аккаунта; остальным честно пишем, что номер скрыт. */
function PeerPhone({ peer }: { peer: MaxDialogPeer }) {
  const [copied, setCopied] = useState(false)

  if (!peer.phone) {
    return <div className="text-[11px] text-muted">Номер скрыт MAX — человека нет в контактах аккаунта</div>
  }
  const phone = peer.phone

  async function copy() {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер недоступен (не https) — номер виден, его можно выделить */
    }
  }

  return (
    <div className="flex items-center gap-1 text-[12px] text-ink">
      <span className="select-all">{formatPhone(phone)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Скопировать номер"
        title={copied ? 'Скопировано' : 'Скопировать номер'}
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted hover:text-brand-dark"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}

/** Переключатель клиента в шапке открытого чата (0053): показывает, к кому
 * привязан текущий чат (или «Не привязан»), клик открывает поиск по клиентам
 * для смены/выбора привязки, не уходя из MAX. */
function ChatClientSwitcher({
  chat,
  peer,
  onLinked,
}: {
  chat: MaxChatSummary | undefined
  peer: MaxDialogPeer | null
  onLinked: () => void
}) {
  const [open, setOpen] = useState(false)
  if (!chat) return null

  const linked = chat.linkedClientId != null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-border px-2.5 py-1 text-[12px] text-muted hover:border-brand/40 hover:text-brand-dark"
      >
        {linked ? <UserCheck size={13} /> : <Link2 size={13} />}
        {linked ? chat.linkedClientName ?? 'Клиент' : 'Не привязан'}
      </button>
      <LinkClientModal
        chatId={chat.id}
        peer={peer}
        chatTitle={chat.title}
        open={open}
        onClose={() => setOpen(false)}
        onLinked={onLinked}
      />
    </>
  )
}
