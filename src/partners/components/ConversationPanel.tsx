import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Send, UserPlus } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Section } from '@/clients/components/PanelPrimitives'
import { Button } from '@/shared/ui/Button'
import { Select, Textarea } from '@/shared/ui/Field'
import { ChannelInvite } from './ChannelInvite'
import { createInvite, getConversation, sendMessage } from '../conversationApi'
import {
  CHANNEL_LABELS,
  CHANNEL_ORDER,
  ChannelKind,
  ChannelStateInfo,
  ChannelUnavailable,
  Conversation,
  ConversationMessage,
  ConversationOwner,
} from '../conversationTypes'

const POLL_MS = 10_000

const STATUS_TEXT: Record<ChannelStateInfo['status'], string> = {
  NONE: 'не подключён',
  INVITED: 'приглашение отправлено',
  CONNECTED: 'подключён',
  STOPPED: 'отключил бота',
}

function channelStatusLabel(state: ChannelStateInfo): string {
  if (!state.configured) return 'не настроен на сервере'
  if (state.status === 'CONNECTED' && state.connected_name) return `подключён — ${state.connected_name}`
  return STATUS_TEXT[state.status]
}

/**
 * Переписка с клиентом/партнёром через мессенджеры (0083-g). Человек пишет в
 * своём MAX/Telegram, сотрудники — отсюда; лента общая для всех, у кого есть
 * просмотр «Клиентов», писать — при праве редактирования.
 */
export function ConversationPanel({ owner, ownerId }: { owner: ConversationOwner; ownerId: number }) {
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [channel, setChannel] = useState<ChannelKind>('MAX')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // «Пользователь не найден в Макс. Доступные каналы: …» — из 409 бэкенда.
  const [unavailable, setUnavailable] = useState<(ChannelUnavailable & { channel: ChannelKind }) | null>(null)
  const [invite, setInvite] = useState<{ channel: ChannelKind; link: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      setConversation(await getConversation(owner, ownerId))
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить переписку')
    }
  }, [owner, ownerId])

  // Пока карточка открыта — подтягиваем ответы из мессенджеров.
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const messageCount = conversation?.messages.length ?? 0
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [messageCount])

  async function handleSend() {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    const result = await sendMessage(owner, ownerId, channel, text)
    setSending(false)
    if (result.ok) {
      setDraft('')
      setSendError(null)
      setUnavailable(null)
    } else if ('unavailable' in result) {
      // Сообщение не ушло и в ленту не попало — черновик остаётся, чтобы
      // отправить его в другой канал одной кнопкой.
      setUnavailable({ ...result.unavailable, channel })
      setSendError(null)
    } else {
      setSendError(result.reason)
    }
    refresh()
  }

  function switchTo(kind: ChannelKind) {
    setChannel(kind)
    setUnavailable(null)
  }

  async function handleInvite(kind: ChannelKind) {
    setInviteError(null)
    try {
      const state = await createInvite(owner, ownerId, kind)
      if (state.invite_link) setInvite({ channel: kind, link: state.invite_link })
      else setInviteError(`Не удалось получить ссылку ${CHANNEL_LABELS[kind]} — мессенджер не ответил, попробуйте ещё раз`)
      refresh()
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Не удалось создать приглашение')
    }
  }

  const states = conversation
    ? CHANNEL_ORDER.map((kind) => conversation.channels.find((c) => c.channel === kind)!).filter(Boolean)
    : []

  return (
    <Section title="Переписка">
      {loadError && !conversation && <p className="text-[13px] text-danger">{loadError}</p>}
      {!conversation && !loadError && <p className="text-[13px] text-muted">Загрузка…</p>}
      {conversation && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {states.map((state) => (
              <div
                key={state.channel}
                className={`rounded-md border px-3 py-2 text-[12px] ${
                  state.status === 'CONNECTED' ? 'border-success/50 bg-success-bg/40' : 'border-border bg-surface-muted'
                } ${state.configured ? '' : 'opacity-60'}`}
              >
                <div className="font-medium text-ink">{CHANNEL_LABELS[state.channel]}</div>
                <div className="text-muted">{channelStatusLabel(state)}</div>
                {canEdit && state.configured && state.status !== 'CONNECTED' && (
                  <button
                    type="button"
                    onClick={() => handleInvite(state.channel)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-brand hover:underline"
                  >
                    <UserPlus size={12} />
                    {state.status === 'NONE' ? 'Пригласить' : 'Ссылка-приглашение'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {invite && <ChannelInvite channel={invite.channel} link={invite.link} onClose={() => setInvite(null)} />}
          {inviteError && <p className="mb-3 text-[12px] text-danger">{inviteError}</p>}

          <div ref={feedRef} className="mb-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto">
            {conversation.messages.length === 0 ? (
              <p className="text-[13px] text-muted">
                Сообщений пока нет. Вся переписка по всем каналам будет видна здесь всем сотрудникам с доступом.
              </p>
            ) : (
              conversation.messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
          </div>

          {canEdit && (
            <div>
              <Textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                }}
                placeholder="Сообщение…"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelKind)}
                  aria-label="Канал"
                  className="w-40"
                >
                  {CHANNEL_ORDER.map((kind) => (
                    <option key={kind} value={kind}>
                      {CHANNEL_LABELS[kind]}
                    </option>
                  ))}
                </Select>
                <Button size="sm" onClick={handleSend} disabled={!draft.trim() || sending}>
                  <Send size={14} />
                  {sending ? 'Отправка…' : 'Отправить'}
                </Button>
              </div>
              {sendError && <p className="mt-2 text-[12px] text-danger">{sendError}</p>}
              {unavailable && (
                <div className="mt-3 rounded-md border border-warning/60 bg-warning-bg/60 p-3 text-[13px]">
                  <p className="flex items-start gap-1.5 text-ink">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
                    {unavailable.message}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unavailable.available.map((kind) => (
                      <Button key={kind} size="sm" variant="secondary" onClick={() => switchTo(kind)}>
                        Писать в {CHANNEL_LABELS[kind]}
                      </Button>
                    ))}
                    {states.find((s) => s.channel === unavailable.channel)?.configured && (
                      <Button size="sm" variant="ghost" onClick={() => handleInvite(unavailable.channel)}>
                        <UserPlus size={14} />
                        Пригласить в {CHANNEL_LABELS[unavailable.channel]}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const outgoing = message.direction === 'OUT'
  const when = new Date(message.sent_at ?? message.created_at).toLocaleString('ru-RU')
  const who = outgoing ? message.author_name ?? 'Отправлено не из карточки' : 'Собеседник'
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-md px-3 py-2 ${
          message.delivery === 'FAILED'
            ? 'border border-danger/50 bg-danger-bg/40'
            : outgoing
              ? 'bg-brand/10'
              : 'bg-surface-muted'
        }`}
      >
        <p className="whitespace-pre-line text-[13px] text-ink">{message.text || '(вложение)'}</p>
        <p className="mt-1 text-[11px] text-muted">
          {CHANNEL_LABELS[message.channel]} · {who} · {when}
        </p>
        {message.delivery === 'FAILED' && (
          <p className="mt-1 flex items-start gap-1 text-[11px] text-danger">
            <AlertCircle size={12} className="mt-px shrink-0" />
            Не доставлено{message.error ? `: ${message.error}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
