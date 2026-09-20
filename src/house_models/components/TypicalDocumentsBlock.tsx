import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { FileAsset } from '@/clients/types'
import { FileLink } from '@/shared/ui/FileLink'
import { updateTypicalDocuments, uploadTypicalArFile, uploadTypicalKrFile } from '../api'

type UploadKind = 'ar' | 'kr'

function TypicalFileRow({
  label,
  asset,
  editable,
  onUpload,
}: {
  label: string
  asset: FileAsset | null
  editable: boolean
  onUpload: (file: File) => Promise<void>
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
      await onUpload(file)
    } catch {
      setError('Не удалось загрузить файл')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-3 py-2">
        <div className="text-[13px]">
          <span className="mr-2 text-muted">{label}:</span>
          {asset && <FileLink id={asset.id} filename={asset.filename} />}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted hover:text-brand disabled:opacity-50"
          >
            <Paperclip size={13} />
            {uploading ? 'Загрузка…' : asset ? 'Заменить' : 'Загрузить'}
          </button>
        )}
      </div>
      {editable && <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  )
}

/** «Типовые АР и КР» (задача 0073-b) — единственное исключение из read-only
 * карточки модели: образец архитектурных/конструктивных решений для модели
 * целиком (не клиентский). Скачивание доступно всем с доступом к разделу;
 * загрузка/замена — только администратору (бэкенд тоже это проверяет,
 * фронт лишь скрывает контролы, не полагается только на скрытие). */
export function TypicalDocumentsBlock({
  modelKey,
  typicalAr,
  typicalKr,
  onChanged,
}: {
  modelKey: string
  typicalAr: FileAsset | null
  typicalKr: FileAsset | null
  onChanged: (next: { typical_ar: FileAsset | null; typical_kr: FileAsset | null }) => void
}) {
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')

  async function handleUpload(kind: UploadKind, file: File) {
    const asset = kind === 'ar' ? await uploadTypicalArFile(file) : await uploadTypicalKrFile(file)
    const patch = kind === 'ar' ? { typical_ar_file_id: asset.id } : { typical_kr_file_id: asset.id }
    const updated = await updateTypicalDocuments(modelKey, patch)
    onChanged({ typical_ar: updated.typical_ar, typical_kr: updated.typical_kr })
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-[14px] font-medium text-ink">Типовые АР и КР</h2>
      <p className="mb-3 text-[12px] text-muted">
        Образец архитектурных и конструктивных решений для этой модели целиком — не привязан к
        конкретному клиенту и не участвует в генерации графа этапов производства.
      </p>
      <div className="flex flex-col gap-2">
        <TypicalFileRow
          label="АР"
          asset={typicalAr}
          editable={isAdmin}
          onUpload={(file) => handleUpload('ar', file)}
        />
        <TypicalFileRow
          label="КР"
          asset={typicalKr}
          editable={isAdmin}
          onUpload={(file) => handleUpload('kr', file)}
        />
      </div>
    </section>
  )
}
