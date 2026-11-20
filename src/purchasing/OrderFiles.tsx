import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Paperclip } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { journalDate } from './JournalControls'

type OrderFile = {
  key: string
  filename: string
  size: number | null
  created_at: string | null
  source: string
  path: string
}

const documentNames = { orders: 'заказа', receipts: 'приёмки', 'supplier-invoices': 'счёта поставщика' }

export function PurchaseDocumentFiles({ id, resource, canUpload }: {
  id: number
  resource: keyof typeof documentNames
  canUpload: boolean
}) {
  const path = `/${resource}/${id}/files`
  const name = documentNames[resource]
  const browse = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<OrderFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [pending, setPending] = useState<{ file: File; id: string } | null>(null)

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    setLoadFailed(false)
    apiRequest<OrderFile[]>({ section: 'purchasing', path })
      .then(rows => { if (current) setFiles(rows) })
      .catch(e => { if (current) { setLoadFailed(true); setError(e.message) } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [path, reload])

  async function upload(selection: { file: File; id: string }) {
    if (!canUpload || uploading) return
    setPending(selection)
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', selection.file)
      form.append('request_id', selection.id)
      const added = await apiRequest<OrderFile>({ section: 'purchasing', path, method: 'POST', form, timeoutMs: 180000 })
      setFiles(rows => [added, ...rows.filter(row => row.key !== added.key)])
      setPending(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return <section className="space-y-4" aria-label={`Файлы ${name}`}>
    {canUpload && <div className="flex flex-wrap items-center gap-3">
      <input ref={browse} aria-label={`Выбрать файл ${name}`} type="file" className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void upload({ file, id: crypto.randomUUID() })
        }} />
      <Button variant="secondary" disabled={uploading || loading} onClick={() => browse.current?.click()}>
        <Paperclip size={16} />{uploading ? 'Загрузка…' : 'Прикрепить файл'}
      </Button>
      <span className="text-xs text-muted">PDF, Word, Excel, JPG, PNG и ZIP до 50 МБ</span>
    </div>}
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-bg p-3 text-danger">
      {error}
      {(pending || loadFailed) && <Button variant="secondary" disabled={uploading || loading} onClick={() => {
        if (pending) void upload(pending)
        else setReload(n => n + 1)
      }}>Повторить</Button>}
    </div>}
    {loading ? <p role="status" className="text-muted">Загружаем файлы…</p> : !files.length && !error &&
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted">
        {resource === 'orders' ? 'К заказу пока нет вложений.' : 'У документа пока нет вложений.'}
      </p>}
    {!!files.length && <ul className="divide-y divide-border rounded-lg border border-border">
      {files.map(file => <li key={file.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <FileText size={20} className="shrink-0 text-muted" />
        <div className="min-w-0 flex-1 basis-32">
          <div className="break-all font-medium">{file.filename}</div>
          <div className="mt-0.5 text-xs text-muted">
            {[file.source, file.size === null ? null : `${Math.ceil(file.size / 1024).toLocaleString('ru-RU')} КБ`,
              file.created_at ? journalDate(file.created_at) : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Button variant="ghost" aria-label={`Скачать ${file.filename}`} onClick={() => {
          setError('')
          void downloadFile('purchasing', file.path, file.filename).catch(e => setError(e.message))
        }}><Download size={16} />Скачать</Button>
      </li>)}
    </ul>}
  </section>
}
