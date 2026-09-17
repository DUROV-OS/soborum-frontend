import { useEffect, useRef, useState } from 'react'
import { Mic, Volume2, VolumeX, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ChatComposer } from '@/ai/components/ChatComposer'
import { MessageBubble } from '@/ai/components/MessageBubble'
import { PendingActionModal } from '@/ai/components/PendingActionModal'
import { PendingActionOut } from '@/ai/types'
import { useHandsFreeVoice } from '@/shared/hooks/useHandsFreeVoice'
import { describeToolCall } from '@/shared/lib/describeToolCall'
import { speakPrincess, splitVoiceReply, stopSpeaking } from '@/shared/lib/speechReply'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { Markdown } from '@/shared/ui/Markdown'
import { useConsultStore } from '../consultStore'

const VOICE_REPLY_KEY = 'soborbum.consult.voiceReply'

function loadVoiceReplyPref(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_REPLY_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

const VOICE_CONFIRM_WORDS = new Set(['да', 'подтверждаю', 'подтвердить', 'ок', 'окей', 'согласен', 'согласна'])
const VOICE_REJECT_WORDS = new Set(['нет', 'отмени', 'отменить', 'отклони', 'отклонить'])

/**
 * Голосовое «да, подтверждаю» / «отмени» по последнему ожидающему действию
 * (0051-e) — только для короткой фразы (≤4 слов), чтобы не путать с обычным
 * вопросом, начинающимся с «да» как со связки («да сколько там...»).
 */
function detectVoiceDecision(text: string): 'approve' | 'reject' | null {
  const words = text.trim().toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 4) return null
  if (words.some((w) => VOICE_CONFIRM_WORDS.has(w))) return 'approve'
  if (words.some((w) => VOICE_REJECT_WORDS.has(w))) return 'reject'
  return null
}

/**
 * Ядро консультационного чата — сам `useConsultStore`, лента, композер,
 * голосовой ответ, подтверждение действий. Общее для полной страницы
 * `/agents` (`ConsultPanel`) и глобального оверлея Jarvis (`JarvisOverlay`,
 * 0051-a) — один и тот же `chatId`/история из обоих мест, без дублирования
 * бизнес-логики. Каждый вызывающий сам оборачивает в свой контейнер
 * (высота/позиционирование отличаются).
 */
export function ConsultChatCore({
  initialMessage = '',
  compact = false,
  handsFree = false,
  contextNote,
}: {
  initialMessage?: string
  /** Компактный режим (оверлей): без заголовка «Консультация», короче подсказка. */
  compact?: boolean
  /** Фоновое распознавание речи «на весь диалог», без клика на каждую фразу
   * (0051-b) — включено только в оверлее Jarvis, страница `/agents` не
   * трогается и продолжает работать по клику на микрофон, как раньше. */
  handsFree?: boolean
  /** Контекст текущего экрана (0051-c) — что открыто прямо сейчас, отдельно
   * от текста сообщения (см. `AskRequest.context_note`, регрессия 0017).
   * Передаётся только оверлеем Jarvis; страница `/agents` не привязана к
   * какому-то одному экрану, поэтому её вызов этот проп не передаёт. */
  contextNote?: string
}) {
  const hydrate = useConsultStore((state) => state.hydrate)
  const setDraft = useConsultStore((state) => state.setDraft)
  const messages = useConsultStore((state) => state.messages)
  const pendingActions = useConsultStore((state) => state.pendingActions)
  const sending = useConsultStore((state) => state.sending)
  const streamBubbles = useConsultStore((state) => state.streamBubbles)
  const streamStatus = useConsultStore((state) => state.streamStatus)
  const error = useConsultStore((state) => state.error)
  const draft = useConsultStore((state) => state.draft)
  const send = useConsultStore((state) => state.send)
  const resolveAction = useConsultStore((state) => state.resolveAction)
  const clear = useConsultStore((state) => state.clear)
  const [modalActions, setModalActions] = useState<PendingActionOut[]>([])
  const [voiceReply, setVoiceReply] = useState(loadVoiceReplyPref)
  const [speaking, setSpeaking] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const voiceNoticeTimeout = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastSpokenId = useRef<number | null>(null)
  const readyToSpeak = useRef(false)
  const lastNavigatedId = useRef<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    hydrate()
    // Don't auto-speak/auto-navigate on history after reload — only fresh answers.
    const lastAssistant = [...useConsultStore.getState().messages].reverse().find((m) => m.role === 'assistant')
    lastSpokenId.current = lastAssistant?.id ?? null
    lastNavigatedId.current = lastAssistant?.id ?? null
    readyToSpeak.current = true
  }, [hydrate])

  useEffect(() => {
    if (initialMessage) setDraft(initialMessage)
  }, [initialMessage, setDraft])

  const lastStreamText = streamBubbles.length ? streamBubbles[streamBubbles.length - 1].text : ''
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, sending, streamBubbles.length, streamStatus, lastStreamText])

  useEffect(() => {
    if (!readyToSpeak.current || !voiceReply || sending) return
    const last = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!last || last.id === lastSpokenId.current) return
    const text = last.content
      .filter((block) => block.type === 'text' || (!block.type && typeof block.text === 'string'))
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n')
    if (!text.trim()) return
    lastSpokenId.current = last.id
    const { spoken } = splitVoiceReply(text)
    if (!spoken) return
    void speakPrincess(spoken, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    })
  }, [messages, sending, voiceReply])

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => () => {
    if (voiceNoticeTimeout.current) window.clearTimeout(voiceNoticeTimeout.current)
  }, [])

  useEffect(() => {
    const last = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!last || last.id === lastNavigatedId.current) return
    lastNavigatedId.current = last.id
    const navBlock = last.content.find((block) => block.type === 'tool_use' && block.name === 'navigate_to')
    if (!navBlock?.id) return
    const resolution = last.tool_resolutions?.[navBlock.id] as { content?: { found?: boolean; path?: string } } | undefined
    const result = resolution?.content
    if (result?.found && typeof result.path === 'string') navigate(result.path)
  }, [messages, navigate])

  const inlinePending = pendingActions.filter((action) => !modalActions.some((item) => item.id === action.id))

  function toggleVoiceReply() {
    stopSpeaking()
    setSpeaking(false)
    setVoiceReply((prev) => {
      const next = !prev
      try {
        localStorage.setItem(VOICE_REPLY_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  async function handleSend(message: string) {
    stopSpeaking()
    setSpeaking(false)
    await send(message, contextNote)
    const next = useConsultStore.getState().pendingActions
    // Компактный оверлей (0051-e) показывает ожидающие действия сразу в
    // ленте — без модалки, чтобы не требовать закрытия для продолжения
    // разговора; на /agents модалка остаётся, как раньше.
    if (!compact && next.length > 0) setModalActions(next)
  }

  async function handleResolve(id: number, decision: 'approve' | 'reject') {
    await resolveAction(id, decision)
    setModalActions((prev) => prev.filter((item) => item.id !== id))
  }

  function showVoiceNotice(text: string) {
    setVoiceNotice(text)
    if (voiceNoticeTimeout.current) window.clearTimeout(voiceNoticeTimeout.current)
    voiceNoticeTimeout.current = window.setTimeout(() => setVoiceNotice(null), 5000)
  }

  async function handleVoiceFinal(text: string) {
    const decision = inlinePending.length > 0 ? detectVoiceDecision(text) : null
    if (decision) {
      if (inlinePending.length === 1) {
        await handleResolve(inlinePending[0].id, decision)
        return
      }
      // Несколько ожидающих действий одновременно — не угадываем, к какому
      // относится голосовое «да»/«отмени» (0051-e, спецификация п. 4).
      showVoiceNotice('Несколько действий ждут подтверждения — выберите нужное кликом.')
      return
    }
    await handleSend(text)
  }

  async function handleClear() {
    stopSpeaking()
    setSpeaking(false)
    lastSpokenId.current = null
    await clear()
  }

  const handsFreeVoice = useHandsFreeVoice((text) => void handleVoiceFinal(text), handsFree, sending)

  // Пока фоновое прослушивание активно и браузер его поддерживает — прячем
  // ручную кнопку микрофона в композере (не пускаем два распознавания сразу
  // на один и тот же микрофон). Если поддержки нет — оставляем клик как
  // единственный доступный способ, с понятной подсказкой ниже.
  const showComposerMic = !handsFree || !handsFreeVoice.handsFreeSupported

  return (
    <>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-border ${compact ? 'px-3 py-2' : 'px-5 py-3'}`}>
        <div className="min-w-0">
          {!compact && <Chip tone="brand">Консультация</Chip>}
          {!compact && (
            <p className="mt-2 text-[13px] text-ink">
              Один чат. Голосом — короткое резюме мягким женским голосом; детали — текстом ниже.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleVoiceReply}
            aria-pressed={voiceReply}
            title={voiceReply ? 'Выключить голосовые ответы' : 'Включить голосовые ответы'}
          >
            {voiceReply ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {compact ? '' : voiceReply ? (speaking ? 'Говорит…' : 'Голос вкл') : 'Голос выкл'}
          </Button>
          {speaking && (
            <Button variant="secondary" size="sm" onClick={() => { stopSpeaking(); setSpeaking(false) }}>
              Стоп
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => void handleClear()} disabled={sending}>
            Очистить чат
          </Button>
        </div>
      </div>

      <div className={`min-w-0 flex-1 overflow-y-auto ${compact ? 'px-3 py-3' : 'px-5 py-4'}`}>
        <div className="flex min-w-0 flex-col gap-3">
          {messages.length === 0 && !sending && (
            <p className="text-[13px] text-muted">
              {compact
                ? 'Спросите голосом или текстом — например «покажи загруженность сотрудника …».'
                : 'Спросите про сделки, склад, цех или правило. Можно голосом в микрофон — ответ придёт текстом и кратким резюме вслух.'}
            </p>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={`${message.role}-${message.id}`}
              message={message}
              pendingActions={inlinePending}
              onResolve={handleResolve}
              preferVoiceLead={message.role === 'assistant'}
              describeToolUse={describeToolCall}
            />
          ))}
          {streamBubbles.map((bubble) => (
            <div key={bubble.id} className="flex min-w-0 flex-col items-start">
              <Markdown
                text={bubble.text + (bubble.done ? '' : ' ▋')}
                className="max-w-[85%] break-words rounded-md bg-surface-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-ink sm:max-w-md"
              />
            </div>
          ))}
          {sending && (streamStatus || streamBubbles.length === 0) && (
            <div className="flex items-center gap-1.5 rounded-md bg-surface-muted px-3.5 py-2.5 text-[13px] text-muted">
              {streamStatus ?? 'Думаю — страницу обновлять не нужно'}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {!compact && error && <p className="px-5 pb-2 text-[12px] text-danger">{error}</p>}

      {compact && (
        // Статус-индикатор диалога Jarvis (0051-e): слушаю/думаю/выполняю/
        // жду подтверждения/готов — собранные в одном месте, вместо
        // разбросанных по ленте сигналов из 0051-b.
        <div className="flex items-center gap-1.5 px-3 pb-1.5 text-[12px]" role="status" aria-live="polite">
          {voiceNotice ? (
            <span className="text-warning">{voiceNotice}</span>
          ) : error ? (
            <span className="text-danger">Ошибка: {error}</span>
          ) : handsFree && handsFreeVoice.phase === 'error' && handsFreeVoice.error ? (
            <span className="text-danger">{handsFreeVoice.error}</span>
          ) : inlinePending.length > 0 ? (
            <span className="text-warning">
              Жду подтверждения{inlinePending.length > 1 ? ` (${inlinePending.length})` : ''} — кликните ниже или
              скажите «да»/«отмени».
            </span>
          ) : sending && streamStatus ? (
            <span className="inline-flex items-center gap-1.5 text-ai-accent">
              <Wrench size={12} />
              {streamStatus}
            </span>
          ) : sending ? (
            <span className="text-ai-accent">Думаю…</span>
          ) : handsFree && !handsFreeVoice.handsFreeSupported ? (
            <span className="text-muted">Без клика недоступно в этом браузере — нажмите на микрофон в поле ввода.</span>
          ) : handsFree && handsFreeVoice.phase === 'listening' ? (
            <span className="inline-flex items-center gap-1.5 text-ai-accent">
              <Mic size={12} className="animate-pulse" />
              Слушаю{handsFreeVoice.interim ? `: «${handsFreeVoice.interim}»` : '…'}
            </span>
          ) : (
            <span className="text-muted">Готов</span>
          )}
        </div>
      )}

      <ChatComposer
        initialMessage={draft}
        sending={sending}
        attachments={[]}
        uploadingAttachment={false}
        allowAttach={false}
        voiceInput={showComposerMic}
        onSend={handleSend}
        onAttach={() => {}}
        onRemoveAttachment={() => {}}
      />

      <PendingActionModal actions={modalActions} onClose={() => setModalActions([])} onResolve={handleResolve} />
    </>
  )
}
