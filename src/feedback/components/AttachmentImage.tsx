import { useEffect, useState } from 'react'
import { fetchAttachment } from '../api'

/**
 * Скриншот заявки. Эндпоинт файла требует токен в заголовке, поэтому
 * `<img src>` напрямую не работает — тянем blob и показываем его (0075-c).
 */
export function AttachmentImage({
  requestId,
  fileId,
  alt,
  onOpen,
}: {
  requestId: number
  fileId: number
  alt: string
  onOpen: (url: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    fetchAttachment(requestId, fileId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [requestId, fileId])

  if (failed) {
    return (
      <div className="flex h-24 w-32 items-center justify-center rounded-md border border-border text-[12px] text-muted">
        Не загрузилось
      </div>
    )
  }
  if (!url) {
    return <div className="h-24 w-32 animate-pulse rounded-md border border-border bg-surface-muted" />
  }
  return (
    <button type="button" onClick={() => onOpen(url)} title="Открыть крупнее">
      <img src={url} alt={alt} className="h-24 w-32 rounded-md border border-border object-cover" />
    </button>
  )
}
