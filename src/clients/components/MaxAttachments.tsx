import { MouseEvent as ReactMouseEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { Download, Eye, Film, Link2, Loader2, Paperclip, Play } from 'lucide-react'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import * as maxApi from '@/max/api'
import { Lightbox } from '@/max/components/Lightbox'
import { MaxAttach } from '@/max/types'

/* ------------------------------------------------------------------ utils */

function reasonOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Не удалось получить вложение'
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return ''
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return ''
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Пул смонтированных <audio>: при старте одного ставим остальные на паузу. */
const audioRegistry = new Set<HTMLAudioElement>()
function pauseOtherAudios(current: HTMLAudioElement): void {
  audioRegistry.forEach((el) => {
    if (el !== current && !el.paused) el.pause()
  })
}

/* ------------------------------------------------------------------ shared bits */

function Placeholder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-[12px] text-muted">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ FILE */

/** Расширения, показываемые в предпросмотре — синхронно с backend
 * `app.max.service.PREVIEWABLE_EXTENSIONS`. Всё остальное — сразу скачивание. */
const PREVIEWABLE_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt'])
/** Файлы крупнее — сразу кнопка скачивания, без попытки загрузить в предпросмотр
 * (синхронно с backend PREVIEW_MAX_SIZE). */
const PREVIEW_MAX_SIZE = 15 * 1024 * 1024

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function isPreviewable(attach: MaxAttach): boolean {
  if (!attach.name || !attach.fileId) return false
  if (attach.size && attach.size > PREVIEW_MAX_SIZE) return false
  return PREVIEWABLE_EXT.has(extensionOf(attach.name))
}

function FileAttach({
  attach,
  chatId,
  messageId,
}: {
  attach: MaxAttach
  chatId: number
  messageId: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = attach.name ?? 'Файл'

  async function download() {
    if (busy || !attach.fileId) return
    setBusy(true)
    setError(null)
    try {
      const url = await maxApi.getAttachmentUrl(chatId, messageId, attach.fileId)
      // Ссылка одноразовая, домен fd.oneme.ru без CORS — только навигация,
      // не fetch. download-атрибут для cross-origin игнорируется, файл
      // сохранится по Content-Disposition сервера MAX.
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noreferrer'
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setError(reasonOf(e))
    } finally {
      setBusy(false)
    }
  }

  const previewable = isPreviewable(attach)
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={previewable ? () => setPreviewOpen(true) : download}
        disabled={busy || !attach.fileId}
        className="flex w-full max-w-[260px] items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-left hover:bg-surface-muted disabled:opacity-60"
      >
        <Paperclip size={16} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink">{name}</span>
          <span className="block text-[11px] text-muted">
            {busy ? 'Готовим ссылку…' : formatBytes(attach.size) || 'Файл'}
          </span>
        </span>
        {busy ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-muted" />
        ) : previewable ? (
          <Eye size={14} className="shrink-0 text-muted" />
        ) : (
          <Download size={14} className="shrink-0 text-muted" />
        )}
      </button>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      {previewOpen && attach.fileId && (
        <FilePreviewModal
          name={name}
          chatId={chatId}
          messageId={messageId}
          fileId={attach.fileId}
          onClose={() => setPreviewOpen(false)}
          onFallbackDownload={download}
        />
      )}
    </div>
  )
}

/** Предпросмотр файла (pdf/jpg/png/webp/txt) через прокси-эндпоинт бэка —
 * без него одноразовая ссылка MAX (без CORS) не грузится в `fetch`/`<embed>`. */
function FilePreviewModal({
  name,
  chatId,
  messageId,
  fileId,
  onClose,
  onFallbackDownload,
}: {
  name: string
  chatId: number
  messageId: string
  fileId: string
  onClose: () => void
  onFallbackDownload: () => void
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ext = extensionOf(name)
  const mime = ext === 'pdf' ? 'application/pdf' : ext === 'txt' ? 'text/plain' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    maxApi
      .getAttachmentPreviewBlob(chatId, messageId, fileId, name)
      .then(async (blob) => {
        if (cancelled) return
        if (ext === 'txt') {
          setText(await blob.text())
        } else {
          url = URL.createObjectURL(blob)
          setObjectUrl(url)
        }
      })
      .catch((e) => !cancelled && setError(reasonOf(e)))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [chatId, messageId, fileId, name, ext])

  return (
    <Lightbox onClose={onClose}>
      <div className="flex max-h-[90vh] w-[90vw] max-w-3xl flex-col overflow-hidden rounded-md bg-surface">
        <div className="border-b border-border px-3 py-2 text-[13px] font-medium text-ink">{name}</div>
        <div className="flex-1 overflow-auto p-3">
          {error && (
            <div className="flex flex-col items-start gap-2 text-[13px] text-danger">
              <span>{error}</span>
              <Button size="sm" onClick={onFallbackDownload}>
                <Download size={14} />
                Скачать вместо просмотра
              </Button>
            </div>
          )}
          {!error && text !== null && (
            <pre className="whitespace-pre-wrap break-words text-[12px] text-ink">{text}</pre>
          )}
          {!error && text === null && objectUrl && ext === 'pdf' && (
            <embed src={objectUrl} type={mime} className="h-[75vh] w-full" />
          )}
          {!error && text === null && objectUrl && ext !== 'pdf' && (
            <img src={objectUrl} alt={name} className="max-h-[75vh] max-w-full object-contain" />
          )}
          {!error && text === null && !objectUrl && <p className="text-[13px] text-muted">Загрузка предпросмотра…</p>}
        </div>
      </div>
    </Lightbox>
  )
}

/* ------------------------------------------------------------------ PHOTO */

function PhotoAttach({ attach }: { attach: MaxAttach }) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)

  if (!attach.baseUrl || broken) {
    return <Placeholder icon={<Paperclip size={13} />} text="Фото недоступно" />
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-md border border-border"
      >
        <img
          src={attach.baseUrl}
          loading="lazy"
          alt={attach.name ?? 'Фото'}
          onError={() => setBroken(true)}
          className="max-h-[240px] max-w-[260px] object-cover"
        />
      </button>
      {open && (
        <Lightbox onClose={() => setOpen(false)}>
          <img
            src={attach.baseUrl}
            alt={attach.name ?? 'Фото'}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </Lightbox>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ VIDEO */

function VideoAttach({
  attach,
  chatId,
  messageId,
}: {
  attach: MaxAttach
  chatId: number
  messageId: string
}) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const [src, setSrc] = useState<string | null>(null)
  const [external, setExternal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const poster = attach.previewData ?? attach.thumbnail

  async function start() {
    if (phase === 'loading' || !attach.videoId) return
    setPhase('loading')
    setError(null)
    try {
      const res = await maxApi.getMediaUrl(chatId, messageId, attach.videoId)
      if (res.url) {
        setSrc(res.url)
        setPhase('playing')
      } else if (res.external) {
        setExternal(res.external)
        setPhase('idle')
      } else {
        setError('Ссылка не получена')
        setPhase('error')
      }
    } catch (e) {
      setError(reasonOf(e))
      setPhase('error')
    }
  }

  if (phase === 'playing' && src) {
    return (
      <video
        src={src}
        poster={poster}
        controls
        autoPlay
        preload="metadata"
        className="max-h-[280px] w-[280px] max-w-full rounded-md bg-black"
        onError={() => {
          setError('Не удалось загрузить видео')
          setPhase('error')
        }}
      />
    )
  }

  return (
    <div className="relative w-[220px] max-w-full overflow-hidden rounded-md bg-black/80">
      {poster ? (
        <img src={poster} alt="" className="h-[150px] w-full object-cover opacity-80" />
      ) : (
        <div className="flex h-[110px] w-full items-center justify-center text-white/50">
          <Film size={28} />
        </div>
      )}
      <button
        type="button"
        onClick={start}
        disabled={phase === 'loading'}
        aria-label="Воспроизвести видео"
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
          {phase === 'loading' ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Play size={20} className="ml-0.5" />
          )}
        </span>
      </button>
      {attach.duration ? (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
          {formatDuration(attach.duration)}
        </span>
      ) : null}
      {(error || external) && (
        <div className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1 text-[11px] text-white">
          {error ?? 'Встроенное воспроизведение недоступно'}
          {external && (
            <a href={external} target="_blank" rel="noreferrer" className="ml-1 underline">
              открыть
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ AUDIO */

function AudioAttach({
  attach,
  chatId,
  messageId,
}: {
  attach: MaxAttach
  chatId: number
  messageId: string
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const autoPlayRef = useRef(false)
  const [src, setSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(attach.duration ? attach.duration / 1000 : 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    audioRegistry.add(el)
    return () => {
      audioRegistry.delete(el)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (src && autoPlayRef.current && el) {
      autoPlayRef.current = false
      pauseOtherAudios(el)
      // Автозапуск может быть отклонён политикой браузера — не считаем это
      // ошибкой, плеер остаётся готовым, пользователь жмёт play ещё раз.
      el.play().catch(() => setPlaying(false))
    }
  }, [src])

  async function toggle() {
    const el = ref.current
    if (status === 'loading') return
    if (playing && el) {
      el.pause()
      return
    }
    if (src && el) {
      pauseOtherAudios(el)
      el.play().catch(() => {})
      return
    }
    if (!attach.audioId) {
      setError('Нет идентификатора аудио')
      setStatus('error')
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const res = await maxApi.getMediaUrl(chatId, messageId, attach.audioId)
      const url = res.url ?? res.external
      if (!url) {
        setError('Ссылка не получена')
        setStatus('error')
        return
      }
      autoPlayRef.current = true
      setSrc(url)
      setStatus('ready')
    } catch (e) {
      setError(reasonOf(e))
      setStatus('error')
    }
  }

  function seek(e: ReactMouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
    setCurrent(el.currentTime)
  }

  const pct = duration ? Math.min(100, (current / duration) * 100) : 0

  return (
    <div className="flex w-[230px] max-w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
      <button
        type="button"
        onClick={toggle}
        disabled={status === 'loading'}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-60"
      >
        {status === 'loading' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : playing ? (
          <span className="block h-3 w-3 border-x-[3px] border-white" />
        ) : (
          <Play size={15} className="ml-0.5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 cursor-pointer rounded-full bg-surface-muted" onClick={seek}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : (
            `${formatDuration(current * 1000)} / ${formatDuration((duration || 0) * 1000) || '—:—'}`
          )}
        </div>
      </div>
      <audio
        ref={ref}
        src={src ?? undefined}
        preload="none"
        onPlay={() => {
          setPlaying(true)
          if (ref.current) pauseOtherAudios(ref.current)
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration)
          }
        }}
        onError={() => {
          if (src) {
            setError('Не удалось загрузить аудио')
            setStatus('error')
            setPlaying(false)
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ SHARE / прочее */

function ShareAttach({ attach }: { attach: MaxAttach }) {
  if (!attach.url) return <UnknownAttach attach={attach} />
  return (
    <a
      href={attach.url}
      target="_blank"
      rel="noreferrer"
      className="flex max-w-[260px] items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 hover:bg-surface-muted"
    >
      <Link2 size={16} className="shrink-0 text-muted" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink">{attach.title ?? attach.url}</span>
        <span className="block truncate text-[11px] text-muted">{attach.url}</span>
      </span>
    </a>
  )
}

function UnknownAttach({ attach }: { attach: MaxAttach }) {
  return (
    <Placeholder
      icon={<Paperclip size={13} />}
      text={attach.name ?? attach.title ?? `Вложение${attach.type ? ` (${attach.type})` : ''}`}
    />
  )
}

/* ------------------------------------------------------------------ dispatcher */

function AttachItem({
  attach,
  chatId,
  messageId,
}: {
  attach: MaxAttach
  chatId: number
  messageId: string
}) {
  switch (attach.type) {
    case 'PHOTO':
      return <PhotoAttach attach={attach} />
    case 'VIDEO':
      return <VideoAttach attach={attach} chatId={chatId} messageId={messageId} />
    case 'FILE':
      return <FileAttach attach={attach} chatId={chatId} messageId={messageId} />
    case 'SHARE':
      return <ShareAttach attach={attach} />
    case 'AUDIO':
    case 'UNSUPPORTED':
      return attach.audioId ? (
        <AudioAttach attach={attach} chatId={chatId} messageId={messageId} />
      ) : (
        <UnknownAttach attach={attach} />
      )
    default:
      return <UnknownAttach attach={attach} />
  }
}

/** Лента вложений одного сообщения MAX. Вёрстка одинаковая для входящих и
 * исходящих — выравнивание задаёт пузырь. CONTROL (системное) не рендерим. */
export function MaxAttachList({
  attaches,
  chatId,
  messageId,
}: {
  attaches: MaxAttach[]
  chatId: number
  messageId: string
}) {
  const items = attaches.filter((a) => a.type !== 'CONTROL')
  if (items.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {items.map((attach, i) => (
        <AttachItem key={i} attach={attach} chatId={chatId} messageId={messageId} />
      ))}
    </div>
  )
}
