import { logClientEvent } from './clientLog'
import { humanizeErrorText, staticHumanMessage } from './humanError'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')

const TOKEN_KEY = 'soborbum.auth.token'

let token: string | null = localStorage.getItem(TOKEN_KEY)

export function setToken(next: string | null): void {
  token = next
  if (next) localStorage.setItem(TOKEN_KEY, next)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  return token
}

export class ApiError extends Error {
  status: number
  /** Разобранное JSON-тело ответа с ошибкой — для отказов с доп. полями рядом с
   * `detail` (например `code`/`available` у «не найден в Макс», 0083-d). */
  body?: Record<string, unknown>
  /** Исходный технический текст, если `message` — переписанная человеческая фраза (0049). */
  rawMessage: string
  constructor(status: number, message: string, body?: Record<string, unknown>, rawMessage = message) {
    super(message)
    this.status = status
    this.body = body
    this.rawMessage = rawMessage
  }
}


async function extractError(response: Response): Promise<{ message: string; body?: Record<string, unknown> }> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return { message: body.detail, body }
    if (Array.isArray(body.detail)) {
      return { message: body.detail.map((e: { msg?: string }) => (e.msg ?? '').replace(/^Value error, /, '')).join('; '), body }
    }
    return { message: response.statusText, body }
  } catch {
    return { message: response.statusText }
  }
}

/**
 * ApiError из неуспешного ответа: `message` — читаемая фраза (при техническом
 * тексте её пишет ИИ, см. humanError.ts), `rawMessage` — как пришло с сервера.
 */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  const { message, body } = await extractError(response)
  const human = await humanizeErrorText(response.status, message, { apiBase: API_BASE, token })
  return new ApiError(response.status, human, body, message)
}

/**
 * `fetch`, у которого обрыв сети (`TypeError: Failed to fetch`) становится
 * `ApiError` со статусом 0 и читаемым текстом. Отмена и таймаут
 * (`AbortError`/`TimeoutError`) пробрасываются как есть — на них рассчитывают
 * вызывающие.
 */
async function networkSafeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) throw new ApiError(0, staticHumanMessage(0), undefined, error.message)
    throw error
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  section: string
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  form?: FormData
  timeoutMs?: number
}

function buildUrl(section: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE}/${section}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.form) {
    body = options.form
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const response = await networkSafeFetch(buildUrl(options.section, options.path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
  })

  if (!response.ok) {
    const error = await errorFromResponse(response)
    // Для «логов пользователя» в заявке 0075 — только метод, путь и код,
    // без тела запроса и ответа; в журнал идёт исходный технический текст.
    logClientEvent(
      'api',
      `${options.method ?? 'GET'} ${API_BASE}/${options.section}${options.path} → ${response.status} ${error.rawMessage}`,
    )
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface StreamEvent {
  type: string
  [key: string]: unknown
}

/**
 * POST that consumes a `text/event-stream` response, calling `onEvent` for every
 * SSE `event:` / `data:` pair until the stream ends. Throws `ApiError` on a
 * non-OK response or a body the browser can't stream — callers fall back to the
 * blocking endpoint in that case. Keepalive comments (`: ...`) are ignored.
 */
export async function streamRequest(
  options: { section: string; path: string; body?: unknown; signal?: AbortSignal },
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await networkSafeFetch(buildUrl(options.section, options.path), {
    method: 'POST',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) throw await errorFromResponse(response)
  if (!response.body) throw new ApiError(0, 'Стриминг не поддерживается этим браузером')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      if (!frame || frame.startsWith(':')) continue // keepalive / comment

      let eventType = 'message'
      const data: string[] = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (eventType === 'end' || data.length === 0) continue

      try {
        onEvent({ type: eventType, ...(JSON.parse(data.join('\n')) as Record<string, unknown>) })
      } catch {
        /* skip an unparseable frame rather than kill the stream */
      }
    }
  }
}

/** POST /api/auth/login (application/x-www-form-urlencoded) */
export async function login(email: string, password: string): Promise<string> {
  const response = await networkSafeFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })
  if (!response.ok) {
    throw await errorFromResponse(response)
  }
  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

/** Скачивает бинарный ответ (файл/шаблон) с авторизацией и запускает сохранение в браузере. */
export async function downloadFile(section: string, path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await networkSafeFetch(buildUrl(section, path), { headers })
  if (!response.ok) throw await errorFromResponse(response)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Прикреплённые файлы (contract_file/house_project_file/raw_files/final_files/images) отдаются
 * не через /api/<section>, а через общий GET /files/:id на корне приложения — см. FileAssetOut.id.
 */
const API_ROOT = API_BASE.replace(/\/api$/, '')

/**
 * Скачивает прикреплённый файл по id (а не открывает во вкладке — рендеринг текстовых
 * файлов браузером не учитывает исходную кодировку и превращает кириллицу в кракозябры).
 */
export async function downloadFileById(fileId: number, filename: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await networkSafeFetch(`${API_ROOT}/files/${fileId}`, { headers })
  if (!response.ok) throw await errorFromResponse(response)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
