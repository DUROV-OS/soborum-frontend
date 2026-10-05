import { ChangeEvent, useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { formatBytes } from '@/clients/components/MaxAttachments'
import { MAX_FILE_SIZE } from '../api'

/**
 * Кнопка-скрепка поля ввода чата MAX: выбирает один файл для отправки.
 * Файл больше MAX_FILE_SIZE не принимается — `onError` с причиной.
 */
export function MaxAttachButton({
  onPick,
  onError,
  disabled,
}: {
  onPick: (file: File) => void
  onError: (reason: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      onError(`Файл «${file.name}» больше ${formatBytes(MAX_FILE_SIZE)} — MAX его не примет`)
      return
    }
    onPick(file)
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Прикрепить файл"
        title="Прикрепить файл"
        className="mb-0.5 shrink-0 rounded-pill p-2 text-muted hover:bg-surface-muted hover:text-brand-dark disabled:opacity-50"
      >
        <Paperclip size={16} />
      </button>
    </>
  )
}

/** Плашка выбранного, ещё не отправленного файла. */
export function MaxPendingFile({
  file,
  onRemove,
  disabled,
}: {
  file: File
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[12px]">
      <Paperclip size={13} className="shrink-0 text-muted" />
      <span className="min-w-0 truncate text-ink">{file.name}</span>
      <span className="shrink-0 text-muted">{formatBytes(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Убрать файл"
        className="shrink-0 rounded-pill p-0.5 text-muted hover:text-danger disabled:opacity-50"
      >
        <X size={13} />
      </button>
    </div>
  )
}
