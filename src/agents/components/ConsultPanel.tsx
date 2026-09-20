import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { ChatComposer } from '@/ai/components/ChatComposer'
import { MessageBubble } from '@/ai/components/MessageBubble'
import { PendingActionModal } from '@/ai/components/PendingActionModal'
import { PendingActionOut } from '@/ai/types'
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

export function ConsultPanel({ initialMessage = '' }: { initialMessage?: string }) {
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastSpokenId = useRef<number | null>(null)
  const readyToSpeak = useRef(false)

  useEffect(() => {
    hydrate()
    // Don't auto-speak history after reload — only fresh answers.
    const lastAssistant = [...useConsultStore.getState().messages].reverse().find((m) => m.role === 'assistant')
    lastSpokenId.current = lastAssistant?.id ?? null
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
    await send(message)
    const next = useConsultStore.getState().pendingActions
    if (next.length > 0) setModalActions(next)
  }

  async function handleResolve(id: number, decision: 'approve' | 'reject') {
    await resolveAction(id, decision)
    setModalActions((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleClear() {
    stopSpeaking()
    setSpeaking(false)
    lastSpokenId.current = null
    await clear()
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] min-w-0 flex-col rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <Chip tone="brand">Консультация</Chip>
          <p className="mt-2 text-[13px] text-ink">
            Один чат. Голосом — короткое резюме мягким женским голосом; детали — текстом ниже.
          </p>
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
            {voiceReply ? (speaking ? 'Говорит…' : 'Голос вкл') : 'Голос выкл'}
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

      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex min-w-0 flex-col gap-3">
          {messages.length === 0 && !sending && (
            <p className="text-[13px] text-muted">
              Спросите про сделки, склад, цех или правило. Можно голосом в микрофон — ответ придёт текстом и кратким резюме вслух.
            </p>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={`${message.role}-${message.id}`}
              message={message}
              pendingActions={inlinePending}
              onResolve={handleResolve}
              preferVoiceLead={message.role === 'assistant'}
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

      {error && <p className="px-5 pb-2 text-[12px] text-danger">{error}</p>}

      <ChatComposer
        initialMessage={draft}
        sending={sending}
        attachments={[]}
        uploadingAttachment={false}
        allowAttach={false}
        voiceInput
        onSend={handleSend}
        onAttach={() => {}}
        onRemoveAttachment={() => {}}
      />

      <PendingActionModal actions={modalActions} onClose={() => setModalActions([])} onResolve={handleResolve} />
    </div>
  )
}
