import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Link2, RefreshCw, Search, Send, UserCheck } from 'lucide-react'
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
import { getChat, listChats, sendMessage } from '../api'
import { MaxChatHistory, MaxChatSummary } from '../types'
import { MaxMessageItem } from '../components/MaxMessageItem'
import { LinkClientModal } from '../components/LinkClientModal'

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

  const [history, setHistory] = useState<MaxChatHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  async function loadChats() {
    setChatsLoading(true)
    setChatsError(null)
    try {
      const res = await listChats()
      setChats(res.chats)
    } catch (err) {
      setChatsError(err instanceof ApiError ? err.message : 'Не удалось загрузить чаты')
    } finally {
      setChatsLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [])

  useEffect(() => {
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [history])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(
      (c) =>
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.lastMessage?.text ?? '').toLowerCase().includes(q),
    )
  }, [chats, query])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (activeId == null || !draft.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(activeId, draft.trim())
      setDraft('')
      const [fresh] = await Promise.all([getChat(activeId, { limit: 80 }), loadChats()])
      setHistory(fresh)
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : 'Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
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
              onClick={loadChats}
              aria-label="Обновить список"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border text-muted transition-colors hover:border-brand/40 hover:text-brand-dark"
            >
              <RefreshCw size={14} className={chatsLoading ? 'animate-spin' : ''} />
            </button>
            <HelpButton onClick={onboarding.show} />
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
                  <span className="truncate text-[12px] text-muted">{previewText(c)}</span>
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
              </div>
              <ChatClientSwitcher chat={chats.find((c) => c.id === activeId)} onLinked={loadChats} />
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
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
                  />
                )
              })}
            </div>

            <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(e)
                  }
                }}
                rows={1}
                placeholder="Сообщение…"
                className="max-h-32 min-h-[2.25rem] flex-1 resize-none rounded-sm border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand/50"
              />
              <Button type="submit" size="sm" disabled={!draft.trim() || sending}>
                <Send size={14} />
                {sending ? 'Отправка…' : 'Отправить'}
              </Button>
            </form>
          </>
        )}
      </div>

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Все чаты»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}

/** Переключатель клиента в шапке открытого чата (0053): показывает, к кому
 * привязан текущий чат (или «Не привязан»), клик открывает поиск по клиентам
 * для смены/выбора привязки, не уходя из MAX. */
function ChatClientSwitcher({ chat, onLinked }: { chat: MaxChatSummary | undefined; onLinked: () => void }) {
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
      <LinkClientModal chatId={chat.id} open={open} onClose={() => setOpen(false)} onLinked={onLinked} />
    </>
  )
}
