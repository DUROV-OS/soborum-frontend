import { useEffect, useState } from 'react'
import * as maxApi from '@/max/api'
import { MaxBotProfile } from '@/max/types'

/**
 * Пустой список чатов MAX (0082): бот видит только диалоги, где ему
 * написали, и группы, куда его добавили. Подсказываем, как получить чат, и
 * даём ссылку на бота. Профиль бота не загрузился — подсказка без ссылки.
 */
export function BotEmptyHint({ className = '' }: { className?: string }) {
  const [bot, setBot] = useState<MaxBotProfile | null>(null)

  useEffect(() => {
    let cancelled = false
    maxApi
      .getBot()
      .then((res) => {
        if (!cancelled) setBot(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const name = bot?.name ? `«${bot.name}»` : null

  return (
    <p className={`text-[13px] text-muted ${className}`}>
      Бот пока не состоит ни в одном чате. Попросите клиента написать боту{' '}
      {bot?.link ? (
        <a href={bot.link} target="_blank" rel="noreferrer" className="text-brand-dark underline">
          {name ?? bot.link}
        </a>
      ) : (
        name
      )}{' '}
      или добавьте бота в группу администратором.
    </p>
  )
}
