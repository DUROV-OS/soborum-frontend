import { useEffect, useRef } from 'react'
import { useVoiceInput, VoiceInputState } from './useVoiceInput'

export interface HandsFreeVoiceState extends VoiceInputState {
  /** Непрерывный фоновый режим без клика поддержан в этом браузере (нужен
   * нативный Web Speech API с `continuous: true` — фоллбэк на Whisper
   * записывает по одному отрезку и не годится для «толкай-говори на весь
   * диалог», см. решение в 0051-b). */
  handsFreeSupported: boolean
}

/**
 * Фоновое распознавание речи «на весь диалог» (0051-b, решение — без
 * слова-триггера): пока хук смонтирован, микрофон слушает непрерывно и
 * перезапускается сам, если браузер оборвал сессию (тишина/сеть) —
 * `useVoiceInput` в режиме `continuous` этого не делает сам, останавливаясь
 * на `onend`. Каждая финальная фраза уходит в `onFinal` — если сейчас
 * `paused` (например ждём ответа агента), фраза отбрасывается молча на
 * уровне хука, индикацию для пользователя рисует вызывающий компонент.
 *
 * Остановка гарантированно происходит при размонтировании (тот же механизм,
 * что уже есть в `useVoiceInput`) — этого достаточно, потому что оверлей
 * Jarvis сам размонтируется при выключении тумблера (0051-a). Пока
 * `active === false` (хук используется вне Jarvis-оверлея), микрофон не
 * запрашивается вовсе — обычная «Консультация» на `/agents` не должна сама
 * просить доступ к микрофону без клика.
 */
export function useHandsFreeVoice(onFinal: (text: string) => void, active: boolean, paused: boolean): HandsFreeVoiceState {
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const voice = useVoiceInput((text) => {
    if (pausedRef.current) return
    onFinal(text)
  })

  const handsFreeSupported = voice.mode === 'browser'
  const { phase, toggle } = voice

  useEffect(() => {
    if (!active || !handsFreeSupported) return
    // 'idle' — сессия не запущена или браузер сам её оборвал: (пере)запускаем.
    if (phase === 'idle') toggle()
  }, [active, handsFreeSupported, phase, toggle])

  return { ...voice, handsFreeSupported: active && handsFreeSupported }
}
