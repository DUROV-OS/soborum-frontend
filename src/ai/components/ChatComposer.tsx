import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Paperclip, Send } from 'lucide-react'
import { useVoiceInput } from '@/shared/hooks/useVoiceInput'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Field'
import { FileAssetOut } from '../types'
import { AttachmentChip } from './AttachmentChip'

// Держим в синхронизации с app/ai/attachments.py: ALLOWED_MEDIA_TYPES на бэкенде.
const ACCEPTED_TYPES =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,text/markdown,application/json'

export function ChatComposer({
  sending,
  attachments,
  uploadingAttachment,
  onSend,
  onAttach,
  onRemoveAttachment,
  initialMessage = '',
  allowAttach = true,
  voiceInput = false,
  disabled = false,
}: {
  sending: boolean
  attachments: FileAssetOut[]
  uploadingAttachment: boolean
  onSend: (message: string) => void
  onAttach: (file: File) => void
  onRemoveAttachment: (id: number) => void
  initialMessage?: string
  allowAttach?: boolean
  /** Бесплатный голосовой ввод (Web Speech / Whisper в браузере). */
  voiceInput?: boolean
  /** Уровень доступа к разделу ниже edit (0052-d) — скрывает отправку и вложение,
   * не трогает голосовой ввод Jarvis (consult), который сюда не завязан. */
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialMessage)
  }, [initialMessage])

  const voice = useVoiceInput((chunk) => {
    setValue((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${chunk}` : chunk
      return next.trim()
    })
  })

  function submit() {
    const trimmed = value.trim()
    if (sending || (!trimmed && attachments.length === 0)) return
    voice.stop()
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    files.forEach(onAttach)
  }

  const canSend = !sending && (value.trim().length > 0 || attachments.length > 0)
  const listening = voice.phase === 'listening'
  const transcribing = voice.phase === 'transcribing'
  const shownValue = listening && voice.interim
    ? `${value}${value.trim() ? ' ' : ''}${voice.interim}`
    : value

  return (
    <div className="border-t border-border px-4 py-3">
      {(attachments.length > 0 || uploadingAttachment) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {attachments.map((asset) => (
            <AttachmentChip
              key={asset.id}
              filename={asset.filename}
              contentType={asset.content_type}
              onRemove={() => onRemoveAttachment(asset.id)}
            />
          ))}
          {uploadingAttachment && <span className="text-[12px] text-muted">Загрузка файла…</span>}
        </div>
      )}
      {voiceInput && (listening || transcribing || voice.error) && (
        <p className={`mb-2 text-[12px] ${voice.error ? 'text-danger' : 'text-muted'}`}>
          {voice.error
            ? voice.error
            : listening
              ? voice.mode === 'whisper'
                ? 'Запись… нажмите микрофон ещё раз, чтобы распознать'
                : 'Слушаю… говорите'
              : 'Распознаю речь… первый раз может занять минуту (модель скачивается бесплатно)'}
        </p>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFilesSelected}
        />
        {allowAttach && !disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label="Прикрепить файл"
            className="mb-1 shrink-0 rounded-pill p-2 text-muted hover:bg-surface-muted hover:text-ai disabled:opacity-50"
          >
            <Paperclip size={16} />
          </button>
        )}
        {voiceInput && (
          <button
            type="button"
            onClick={() => voice.toggle()}
            disabled={sending || !voice.supported || transcribing}
            aria-label={listening ? 'Остановить голосовой ввод' : 'Голосовой ввод'}
            aria-pressed={listening}
            title={
              !voice.supported
                ? 'Голосовой ввод недоступен в этом браузере'
                : listening
                  ? 'Стоп'
                  : 'Сказать вопрос голосом'
            }
            className={`mb-1 shrink-0 rounded-pill p-2 disabled:opacity-50 ${
              listening
                ? 'bg-danger/15 text-danger hover:bg-danger/25'
                : 'text-muted hover:bg-surface-muted hover:text-ai'
            }`}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <Textarea
          rows={1}
          value={shownValue}
          onChange={(e) => {
            if (listening || transcribing) return
            setValue(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'Нет прав на отправку сообщений в этом разделе' : voiceInput ? 'Спросите Марину… или нажмите микрофон' : 'Спросите Марину…'
          }
          aria-label="Сообщение Марине"
          className="max-h-32 resize-none"
          disabled={sending || transcribing || disabled}
        />
        {!disabled && (
          <Button variant="ai" size="sm" onClick={submit} disabled={!canSend || transcribing} aria-label="Отправить сообщение">
            <Send size={15} />
          </Button>
        )}
      </div>
    </div>
  )
}
