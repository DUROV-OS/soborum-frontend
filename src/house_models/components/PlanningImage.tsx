import { useEffect, useState } from 'react'
import { API_BASE, getToken } from '@/shared/lib/httpClient'

/**
 * Прикреплённые файлы отдаются авторизованным GET /files/:id (см.
 * FileAssetOut) — обычный <img src> не может передать Authorization, поэтому
 * скачиваем как blob и показываем через object URL, как единственный способ
 * показать такую картинку прямо на странице (не только по клику на скачивание,
 * как FileLink).
 */
export function PlanningImage({ fileId, alt }: { fileId: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const root = API_BASE.replace(/\/api$/, '')
    const token = getToken()

    fetch(`${root}/files/${fileId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error('failed to load image')
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId])

  if (failed) return null
  if (!src) return <div className="text-[12px] text-muted">Загрузка планировки…</div>

  return <img src={src} alt={alt} className="mb-3 max-w-full rounded-md border border-border" />
}
