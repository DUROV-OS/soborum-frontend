import { useState } from 'react'
import { format } from 'date-fns'
import { Download, FileText, Loader2, Mic, Play } from 'lucide-react'
import { getAttachmentUrl, getMediaUrl } from '../api'
import { MaxAttach, MaxMessage } from '../types'
import { Lightbox } from './Lightbox'

function humanSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function humanDuration(ms?: number): string | null {
  if (!ms || ms <= 0) return null
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Кнопка вложения, которая по клику запрашивает у бэка одноразовую ссылку и открывает её. */
function AttachAction({
  label,
  hint,
  icon,
  resolve,
}: {
  label: string
  hint?: string | null
  icon: React.ReactNode
  resolve: () => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function handleClick() {
    setBusy(true)
    setError(false)
    try {
      const url = await resolve()
      if (url) window.open(url, '_blank', 'noopener')
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-2 rounded-sm border border-border/60 bg-surface px-2.5 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-brand/40 disabled:opacity-60"
    >
      {busy ? <Loader2 size={14} className="shrink-0 animate-spin" /> : icon}
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        <span className="block text-[11px] text-muted">{error ? 'Недоступно' : hint ?? 'Открыть'}</span>
      </span>
    </button>
  )
}

/** Фото открывается в лайтбоксе по клику, а не просто как инлайн-картинка. */
function PhotoAttachment({ url, name }: { url: string; name?: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        <img
          src={url}
          alt={name ?? 'Фото'}
          loading="lazy"
          className="max-h-64 max-w-full rounded-md border border-border/50 object-cover"
        />
      </button>
      {open && (
        <Lightbox onClose={() => setOpen(false)}>
          <img src={url} alt={name ?? 'Фото'} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </Lightbox>
      )}
    </>
  )
}

function Attachment({ attach, chatId, messageId }: { attach: MaxAttach; chatId: number; messageId: string }) {
  const type = attach.type

  if (type === 'PHOTO' && attach.baseUrl) {
    return <PhotoAttachment url={attach.baseUrl} name={attach.name} />
  }

  if (type === 'SHARE' && attach.url) {
    return (
      <a
        href={attach.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-xs rounded-sm border border-border/60 bg-surface px-2.5 py-1.5 text-[12px]"
      >
        <span className="block truncate font-medium text-brand-dark underline underline-offset-2">
          {attach.title || attach.url}
        </span>
        {attach.title && <span className="block truncate text-[11px] text-muted">{attach.url}</span>}
      </a>
    )
  }

  if (type === 'FILE' && attach.fileId) {
    const fileId = attach.fileId
    return (
      <AttachAction
        label={attach.name ?? 'Файл'}
        hint={humanSize(attach.size)}
        icon={<FileText size={14} className="shrink-0 text-muted" />}
        resolve={() => getAttachmentUrl(chatId, messageId, fileId)}
      />
    )
  }

  if (type === 'VIDEO' && attach.videoId) {
    const videoId = attach.videoId
    return (
      <AttachAction
        label="Видео"
        hint={humanDuration(attach.duration)}
        icon={<Play size={14} className="shrink-0 text-muted" />}
        resolve={async () => {
          const media = await getMediaUrl(chatId, messageId, videoId)
          return media.url ?? media.external
        }}
      />
    )
  }

  if (type === 'AUDIO' && attach.audioId) {
    const audioId = attach.audioId
    return (
      <AttachAction
        label="Голосовое сообщение"
        hint={humanDuration(attach.duration)}
        icon={<Mic size={14} className="shrink-0 text-muted" />}
        resolve={async () => {
          const media = await getMediaUrl(chatId, messageId, audioId)
          return media.url ?? media.external
        }}
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-surface px-2 py-1 text-[11px] text-muted">
      <Download size={12} />
      {attach.name ?? 'Вложение'}
    </span>
  )
}

export function MaxMessageItem({
  message,
  chatId,
  isGroup = false,
  showAuthor = true,
}: {
  message: MaxMessage
  chatId: number
  /** Беседа на несколько человек — тогда у входящих подписываем автора. */
  isGroup?: boolean
  /** false — предыдущее сообщение того же автора, подпись не повторяем. */
  showAuthor?: boolean
}) {
  // Служебное событие чата (вступил / вышел / переименовал) — отдельной
  // строкой по центру, не как чей-то пузырь.
  if (message.isSystem) {
    const who = message.senderName
    const what = message.systemText ?? 'служебное сообщение'
    return (
      <p className="py-0.5 text-center text-[11px] text-muted">
        {who ? `${who} ${what}` : what}
      </p>
    )
  }

  const hasText = message.text.trim().length > 0
  const attaches = message.attaches ?? []
  if (!hasText && attaches.length === 0) return null

  const outgoing = message.isOutgoing
  // Автор виден только у входящих в групповом чате и только на первом
  // сообщении из подряд идущих от одного человека.
  const authorLabel =
    isGroup && !outgoing && showAuthor ? message.senderName ?? 'Участник' : null

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${outgoing ? 'items-end' : 'items-start'}`}>
      {authorLabel && (
        <span className="px-1 text-[11px] font-medium text-brand-dark">{authorLabel}</span>
      )}
      <div
        className={`flex max-w-[85%] flex-col gap-2 rounded-md px-3 py-2 text-[13px] leading-relaxed sm:max-w-md ${
          outgoing ? 'bg-brand text-white' : 'bg-surface-muted text-ink'
        }`}
      >
        {attaches.map((a, i) => (
          <Attachment key={i} attach={a} chatId={chatId} messageId={message.id} />
        ))}
        {hasText && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
      </div>
      <span className="px-1 text-[10px] text-muted">
        {message.time ? format(new Date(message.time), 'dd.MM HH:mm') : ''}
        {message.status ? ` · ${message.status.toLowerCase()}` : ''}
      </span>
    </div>
  )
}
