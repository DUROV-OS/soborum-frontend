import { useState } from 'react'
import { Copy, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { CHANNEL_LABELS, ChannelKind } from '../conversationTypes'

/** Как называется кнопка запуска бота у человека в мессенджере. */
const START_HINT: Record<ChannelKind, string> = {
  MAX: 'нажмите «Начать»',
  TELEGRAM: 'нажмите «Запустить»',
  WHATSAPP: 'отправьте открывшееся сообщение',
}

export function inviteText(channel: ChannelKind, link: string): string {
  return `Здравствуйте! Чтобы переписываться с нами в ${CHANNEL_LABELS[channel]}, откройте ссылку и ${START_HINT[channel]}: ${link}`
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Ссылка-приглашение (0083-d): бот не может написать человеку первым, поэтому
 * сотрудник отправляет ему эту ссылку любым способом — СМС, почтой, голосом.
 * Как только человек запустит бота по ссылке, чат сам привяжется к карточке.
 */
export function ChannelInvite({
  channel,
  link,
  onClose,
}: {
  channel: ChannelKind
  link: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState<'link' | 'text' | 'failed' | null>(null)
  const text = inviteText(channel, link)

  async function handleCopy(what: 'link' | 'text') {
    setCopied((await copy(what === 'link' ? link : text)) ? what : 'failed')
  }

  return (
    <div className="mb-4 rounded-md border border-brand/30 bg-brand/5 p-3 text-[13px]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-medium text-ink">Приглашение в {CHANNEL_LABELS[channel]}</p>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-pill p-1 text-muted hover:text-ink">
          <X size={13} />
        </button>
      </div>
      <p className="mb-2 text-muted">
        Отправьте человеку этот текст по СМС или любым удобным способом. Когда он откроет ссылку и запустит бота, переписка
        появится здесь.
      </p>
      <p className="mb-3 select-all break-all rounded-sm bg-surface px-2 py-1.5 text-ink">{text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => handleCopy('text')}>
          <Copy size={14} />
          Скопировать текст
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleCopy('link')}>
          Только ссылку
        </Button>
        {copied === 'failed' && <span className="text-[12px] text-danger">Не удалось скопировать — выделите текст вручную</span>}
        {copied && copied !== 'failed' && <span className="text-[12px] text-success">Скопировано</span>}
      </div>
    </div>
  )
}
