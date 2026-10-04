import { useEffect, useRef, useState } from 'react'
import { API_BASE, getToken } from '@/shared/lib/httpClient'

/**
 * События чатов MAX в реальном времени (0092) — WS /api/max/ws.
 *
 * Один сокет на вкладку: открывается, пока есть хоть один подписчик, и
 * закрывается, когда подписчиков нет. Авторизация — первым сообщением
 * `{type: 'auth', token}` (не в URL: строка запроса оседает в логах прокси).
 * Событие несёт только id чата — данные подписчик перечитывает обычными GET.
 * После каждого (пере)подключения подписчики получают `resync`: за время
 * обрыва могли прийти сообщения, о которых сокет не сообщил. Тот же `resync`
 * шлёт и сервер, когда его слушатель аккаунта MAX переподключился.
 */

export type MaxRealtimeEvent = { type: 'chat_updated'; chatId: number } | { type: 'resync' }

type Listener = (event: MaxRealtimeEvent) => void
type StatusListener = (connected: boolean) => void

const RETRY_MIN_MS = 1000
const RETRY_MAX_MS = 30000

const listeners = new Set<Listener>()
const statusListeners = new Set<StatusListener>()
let socket: WebSocket | null = null
let connected = false
let retryMs = RETRY_MIN_MS
let retryTimer: number | null = null

function wsUrl(): string {
  const url = new URL(`${API_BASE}/max/ws`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function setConnected(next: boolean) {
  if (connected === next) return
  connected = next
  statusListeners.forEach((l) => l(next))
}

function emit(event: MaxRealtimeEvent) {
  listeners.forEach((l) => l(event))
}

function scheduleReconnect() {
  if (retryTimer != null || listeners.size === 0) return
  retryTimer = window.setTimeout(() => {
    retryTimer = null
    connect()
  }, retryMs)
  retryMs = Math.min(retryMs * 2, RETRY_MAX_MS)
}

function connect() {
  if (socket || listeners.size === 0) return
  const token = getToken()
  if (!token) {
    // ещё не вошли или вышли — попробуем позже, токен мог появиться
    scheduleReconnect()
    return
  }
  const ws = new WebSocket(wsUrl())
  socket = ws
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }))
  ws.onmessage = (msg) => {
    let data: { type?: string; chatId?: unknown }
    try {
      data = JSON.parse(String(msg.data))
    } catch {
      return
    }
    if (data.type === 'ready') {
      retryMs = RETRY_MIN_MS
      setConnected(true)
      emit({ type: 'resync' })
    } else if (data.type === 'resync') {
      emit({ type: 'resync' })
    } else if (data.type === 'chat_updated' && typeof data.chatId === 'number') {
      emit({ type: 'chat_updated', chatId: data.chatId })
    }
  }
  ws.onclose = () => {
    if (socket !== ws) return
    socket = null
    setConnected(false)
    scheduleReconnect()
  }
}

function disconnect() {
  if (retryTimer != null) {
    window.clearTimeout(retryTimer)
    retryTimer = null
  }
  retryMs = RETRY_MIN_MS
  const ws = socket
  socket = null
  setConnected(false)
  ws?.close()
}

/** Подписаться на события; возвращает функцию отписки. */
export function subscribeMaxEvents(listener: Listener): () => void {
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) disconnect()
  }
}

/** Пачка событий за окно склейки: какие чаты изменились и нужен ли полный
 * resync (переподключение — перечитать всё). */
export interface MaxEventBatch {
  chatIds: Set<number>
  resync: boolean
}

/**
 * Подписка компонента на события MAX. События склеиваются за `debounceMs`
 * в одну пачку — несколько сообщений подряд дают одно перечитывание (каждое
 * перечитывание на бэке открывает сессию аккаунта MAX, поэтому окно — 1 с).
 * Возвращает, подключён ли сокет сейчас.
 */
export function useMaxEvents(onBatch: (batch: MaxEventBatch) => void, debounceMs = 1000): boolean {
  const [isConnected, setIsConnected] = useState(connected)
  const handlerRef = useRef(onBatch)
  handlerRef.current = onBatch

  useEffect(() => {
    let batch: MaxEventBatch = { chatIds: new Set(), resync: false }
    let timer: number | null = null
    const flush = () => {
      timer = null
      const current = batch
      batch = { chatIds: new Set(), resync: false }
      handlerRef.current(current)
    }
    const unsubscribe = subscribeMaxEvents((event) => {
      if (event.type === 'resync') batch.resync = true
      else batch.chatIds.add(event.chatId)
      if (timer == null) timer = window.setTimeout(flush, debounceMs)
    })
    statusListeners.add(setIsConnected)
    setIsConnected(connected)
    return () => {
      unsubscribe()
      statusListeners.delete(setIsConnected)
      if (timer != null) window.clearTimeout(timer)
    }
  }, [debounceMs])

  return isConnected
}
