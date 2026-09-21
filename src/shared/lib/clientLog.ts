/**
 * Кольцевой буфер событий текущей сессии (0075-b).
 *
 * Серверного журнала действий пользователя в системе нет, поэтому «логи
 * пользователя» к заявке «Пожелания/предложения» собирает сам фронт: переходы
 * между экранами, неуспешные ответы API и необработанные ошибки JS. Буфер
 * живёт только в памяти вкладки — при перезагрузке страницы он пуст.
 *
 * Что НЕ пишем: тела запросов и ответов, содержимое форм, токен. Только метод,
 * путь, код ответа и текст ошибки, который и так виден пользователю.
 */

export type ClientLogKind = 'nav' | 'api' | 'error'

export interface ClientLogEntry {
  at: string
  kind: ClientLogKind
  message: string
}

const MAX_ENTRIES = 200
const entries: ClientLogEntry[] = []

export function logClientEvent(kind: ClientLogKind, message: string): void {
  entries.push({ at: new Date().toISOString(), kind, message })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
}

export function clientLogEntries(): ClientLogEntry[] {
  return [...entries]
}

/** Текст лога для отправки вместе с заявкой: шапка с окружением + события. */
export function renderClientLog(user: { id: number; email: string; full_name: string } | null): string {
  const header = [
    `Пользователь: ${user ? `${user.full_name} <${user.email}> (id ${user.id})` : 'не определён'}`,
    `Собрано: ${new Date().toISOString()}`,
    `Адрес: ${window.location.href}`,
    `Браузер: ${navigator.userAgent}`,
    `Окно: ${window.innerWidth}×${window.innerHeight}`,
    `Событий в буфере: ${entries.length} (максимум ${MAX_ENTRIES}, только текущая вкладка)`,
    '',
  ]
  const body = entries.map((e) => `${e.at}  ${e.kind.toUpperCase().padEnd(5)} ${e.message}`)
  return [...header, ...(body.length ? body : ['(событий не записано)'])].join('\n')
}

let installed = false

/** Ставит перехват необработанных ошибок. Вызывается один раз при старте приложения. */
export function installClientLogHandlers(): void {
  if (installed) return
  installed = true
  window.addEventListener('error', (event) => {
    logClientEvent('error', `${event.message} (${event.filename}:${event.lineno})`)
  })
  window.addEventListener('unhandledrejection', (event) => {
    logClientEvent('error', `unhandled rejection: ${String(event.reason)}`)
  })
}
