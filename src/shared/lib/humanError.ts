/**
 * Человеческий текст вместо технического текста ошибки (0049).
 *
 * Порядок: если сообщение уже читаемое — отдаём как есть (бэкенд в основном
 * пишет по-русски: «Нельзя закрыть цикл без оплаты остатка»). Если оно похоже
 * на техническое («Field required», «Internal Server Error», «Failed to fetch»,
 * пустое, 5xx) — просим бэкенд переписать его до 10 слов дешёвой моделью
 * OpenAI (`POST /api/ai/humanize-error`). Нет ответа ИИ — статичная фраза по
 * коду ответа. Сырой текст остаётся в `ApiError.rawMessage` и в журнале.
 */

export const MAX_ERROR_WORDS = 10
const AI_TIMEOUT_MS = 4000

const CYRILLIC = /[А-Яа-яЁё]/
const TECHNICAL =
  /traceback|exception|internal server error|bad gateway|service unavailable|gateway time-?out|failed to fetch|networkerror|load failed|unexpected token|is not valid json|cannot read propert|\bundefined\b|\bsql|errno|<!doctype|<html|field required|input should|string should|ensure this value|\btypeerror\b|\bkeyerror\b|not authenticated|not found|forbidden|unprocessable/i

/** Похоже ли сообщение на техническое, которое нельзя показывать человеку как есть. */
export function looksTechnical(message: string, status: number): boolean {
  const text = message.trim()
  if (!text || status >= 500) return true
  return !CYRILLIC.test(text) || TECHNICAL.test(text)
}

/** Запасная фраза по коду ответа (до 10 слов), когда ИИ недоступен. */
export function staticHumanMessage(status: number): string {
  if (status === 0) return 'Сеть оборвалась или сервер не ответил. Повторите позже.'
  if (status === 401) return 'Сессия истекла. Войдите заново.'
  if (status === 403) return 'Недостаточно прав для этого действия.'
  if (status === 404) return 'Не найдено — возможно, уже удалено.'
  if (status === 409) return 'Данные изменились. Обновите страницу и повторите.'
  if (status === 413) return 'Файл слишком большой.'
  if (status === 422 || status === 400) return 'Проверьте заполнение полей.'
  if (status === 429) return 'Слишком много запросов. Подождите минуту.'
  if (status >= 500) return 'Сервер сейчас не справляется. Повторите позже.'
  return 'Не удалось выполнить действие.'
}

/** Простой текст-подпись для ошибки, не пришедшей с сервера (плоский `Error`). */
export function plainErrorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : ''
  return message && !looksTechnical(message, 0) ? message : fallback
}

const cache = new Map<string, string>()

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Читаемый текст ошибки ответа. Никогда не бросает: любой сбой ИИ — запасная фраза.
 * Запрос к ИИ идёт напрямую через `fetch`, не через `apiRequest`, чтобы
 * ошибка самого перевода не запускала перевод снова.
 */
export async function humanizeErrorText(
  status: number,
  raw: string,
  options: { apiBase: string; token: string | null },
): Promise<string> {
  if (!looksTechnical(raw, status)) return raw
  const fallback = staticHumanMessage(status)
  // Без сессии или без связи ИИ позвать нельзя (и незачем: ответ был бы тем же).
  if (!options.token || status === 0 || status === 401 || !raw.trim()) return fallback

  const key = `${status}|${raw}`
  const cached = cache.get(key)
  if (cached) return cached

  try {
    const response = await fetch(`${options.apiBase}/ai/humanize-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
      body: JSON.stringify({ text: raw.slice(0, 1000), status }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    })
    if (!response.ok) return fallback
    const body = (await response.json()) as { text?: string | null }
    const text = (body.text ?? '').trim()
    if (!text || wordCount(text) > MAX_ERROR_WORDS) return fallback
    cache.set(key, text)
    return text
  } catch {
    return fallback
  }
}
