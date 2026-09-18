import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { FileAsset } from '@/clients/types'
import { FileLink } from '@/shared/ui/FileLink'
import { uploadMovementDocument } from '../api'

/** Список прикреплённых документов проводки + кнопка добавить ещё (0072-d).
 * Используется и при создании проводки, и при правке карточки — переиспользуемый
 * общий кусок, а не два похожих куска разметки. */
export function MovementDocumentsField({
  documents,
  onChange,
  disabled = false,
}: {
  documents: FileAsset[]
  onChange: (documents: FileAsset[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const asset = await uploadMovementDocument(file)
      onChange([...documents, asset])
    } catch {
      setError('Не удалось загрузить файл')
    }
    setUploading(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-3 py-2"
        >
          <FileLink id={doc.id} filename={doc.filename} />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(documents.filter((d) => d.id !== doc.id))}
              aria-label="Открепить документ"
              title="Открепить документ"
              className="shrink-0 text-muted hover:text-danger"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Paperclip size={14} />
            {uploading ? 'Загрузка…' : 'Прикрепить документ'}
          </button>
        </div>
      )}
      {!disabled && documents.length === 0 && !error && (
        <p className="text-[12px] text-muted">Документы не прикреплены</p>
      )}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}
