import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, QrCode, RefreshCw } from 'lucide-react'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'

type Connection = {
  state: string
  account_name?: string
  account_id?: string
  last_connected_at?: number
  persistent_session: boolean
  automatic_reconnect: boolean
}
type Attempt = {
  id: string
  phase: string
  expires_at: number
  qr_image?: string | null
  account_name?: string | null
  account_id?: string | null
  error?: string | null
}
const terminal = new Set(['complete', 'cancelled', 'expired', 'failed', 'account_mismatch'])
const stateText: Record<string, string> = {
  connected: 'Подключён', reconnecting: 'Восстанавливаем связь', unchecked: 'Проверяем подключение',
  reauth_required: 'Нужно подтвердить вход', disconnected: 'Не подключён',
  account_mismatch: 'Подключение остановлено: другой аккаунт',
  not_configured: 'Хранилище подключения ещё не настроено', storage_unavailable: 'Хранилище подключения недоступно',
}
const phaseText: Record<string, string> = {
  starting: 'Получаем QR-код…', waiting: 'Ожидаем подтверждения на телефоне',
  verifying: 'Вход подтверждён на телефоне. Проверяем аккаунт…',
  checking_password: 'Проверяем пароль…', connecting: 'Сохраняем подключение…',
  complete: 'Рабочий аккаунт подключён', cancelled: 'Подключение отменено',
  expired: 'Срок QR-кода истёк. Получите новый код.',
  failed: 'Вход не завершён. Получите новый QR-код.',
  account_mismatch: 'Этот аккаунт отличается от рабочего. Войдите в прежний аккаунт компании.',
}
function request<T>(path = '', method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown) {
  return apiRequest<T>({ section: 'max', path: `/connection${path}`, method, body, timeoutMs: 45000 })
}

/** Owner-only panel: MAX credentials stay on the server, never in browser storage. */
export function MaxConnectionSettings() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoRenew, setAutoRenew] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const active = attempt && !terminal.has(attempt.phase)
  const attemptId = active ? attempt.id : null

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const result = await request<Connection>()
        if (!stopped) setConnection(result)
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Не удалось проверить MAX')
      }
      if (!stopped) timer = setTimeout(refresh, 15000)
    }
    void refresh()
    return () => { stopped = true; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!attemptId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const result = await request<Attempt>(`/qr/${attemptId}`)
        if (stopped) return
        setAttempt(result)
        if (!['starting', 'waiting', 'expired'].includes(result.phase)) setAutoRenew(false)
        if (result.phase === 'complete') setConnection(await request<Connection>())
        if (terminal.has(result.phase)) return
      } catch (e) {
        if (stopped) return
        setError(e instanceof Error ? e.message : 'Не удалось обновить подключение')
        if (e instanceof ApiError && e.status === 404) {
          setAutoRenew(false)
          setAttempt(null)
          return
        }
      }
      if (!stopped) timer = setTimeout(poll, 2000)
    }
    timer = setTimeout(poll, 1000)
    return () => { stopped = true; clearTimeout(timer) }
  }, [attemptId])

  useEffect(() => {
    setPassword('')
  }, [attempt?.id, attempt?.phase])
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [!!active])

  async function action(work: () => Promise<void>) {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(null)
    try { await work() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие. Обновите состояние.') }
    finally { locked.current = false; setBusy(false) }
  }
  function start() {
    setAutoRenew(true)
    void action(async () => {
      const id = crypto.randomUUID()
      // Keep the request ID on timeout so polling can recover an accepted start.
      setAttempt({ id, phase: 'starting', expires_at: Date.now() / 1000 + 600 })
      setAttempt(await request<Attempt>('/qr', 'POST', { request_id: id }))
    })
  }
  useEffect(() => {
    if (!autoRenew || busy || attempt?.phase !== 'expired') return
    const renew = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && !locked.current) start()
    }
    const timer = setTimeout(renew, 1000)
    document.addEventListener('visibilitychange', renew)
    window.addEventListener('online', renew)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', renew)
      window.removeEventListener('online', renew)
    }
  }, [autoRenew, busy, attempt?.id, attempt?.phase])
  const qrVisible = attempt?.phase === 'waiting' && attempt.expires_at * 1000 > now
  return (
    <section aria-label="Подключение MAX" className="mb-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink">Рабочий аккаунт MAX</h2>
          <p className="mt-1 text-[13px] text-muted">Общий аккаунт компании для переписки с клиентами.</p>
        </div>
        <span role="status" className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] ${connection?.state === 'connected' ? 'bg-success-bg text-success' : 'bg-surface-muted text-ink'}`}>
          {connection?.state === 'connected' && <CheckCircle2 size={14} />}
          {connection ? stateText[connection.state] ?? 'Проверяем состояние' : 'Загрузка…'}
        </span>
      </div>
      {connection?.account_name && <p className="mt-3 text-[13px] text-ink">{connection.account_name}</p>}
      <p className="mt-3 max-w-2xl text-[13px] text-muted">
        {connection?.persistent_session && connection.automatic_reconnect
          ? 'Связь восстанавливается автоматически после обрыва и перезапуска. Если MAX отзовёт доступ, руководителю понадобится снова подтвердить вход с телефона.'
        : 'Подключение и повторный вход выполняет руководитель. Состояние связи видно здесь.'}
      </p>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
      {!active && <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !connection?.persistent_session} onClick={start}>
          <QrCode size={15} />{connection?.state === 'connected' ? 'Повторный вход по QR' : 'Подключить по QR'}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(async () => setConnection(await request<Connection>('/check', 'POST')))}>
          <RefreshCw size={14} />Проверить связь
        </Button>
      </div>}
      {attempt && <div className="mt-4 rounded-xl border border-border p-4">
        {phaseText[attempt.phase] && <p aria-live="polite" className="text-[13px] font-medium text-ink">{attempt.phase === 'expired' && autoRenew ? 'Обновляем QR-код автоматически…' : phaseText[attempt.phase]}</p>}
        {attempt.error && <p className="mt-2 text-[13px] text-danger">{attempt.error}</p>}
        {qrVisible && attempt.qr_image && <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <img src={attempt.qr_image} alt="QR-код входа в рабочий аккаунт MAX" width={240} height={240} className="h-auto w-full max-w-[240px] shrink-0 rounded-lg bg-white" />
          <div className="max-w-sm text-[13px] text-ink">
            <p>В MAX на телефоне откройте «Профиль» → «Устройства» → вход по QR-коду. Отсканируйте код и подтвердите вход.</p>
            <p className="mt-2 text-muted">Используйте рабочий аккаунт компании. Код действует ещё {Math.max(0, Math.ceil((attempt.expires_at * 1000 - now) / 1000))} сек.</p>
            <p className="mt-2 text-muted">Когда срок истечёт, код обновится автоматически. После подтверждения на телефоне обновление остановится.</p>
          </div>
        </div>}
        {attempt.phase === 'waiting' && !qrVisible && <p className="mt-2 text-[13px] text-muted">Срок кода истёк. Дожидаемся обновления состояния…</p>}
        {attempt.phase === 'password_required' && <form className="mt-3 max-w-sm space-y-3" onSubmit={e => {
          e.preventDefault()
          const value = password
          setPassword('')
          void action(async () => setAttempt(await request<Attempt>(`/qr/${attempt.id}/password`, 'POST', { password: value })))
        }}>
          <Field label="Пароль входа MAX" hint="MAX запросил дополнительное подтверждение. Введите пароль здесь.">
            <Input type="password" autoComplete="off" value={password} maxLength={1024} onChange={e => setPassword(e.target.value)} required />
          </Field>
          <Button size="sm" disabled={busy || !password} type="submit">Подтвердить пароль</Button>
        </form>}
        {attempt.phase === 'confirm_account' && <div className="mt-2 text-[13px] text-ink">
          <p>Подтверждён аккаунт: <strong>{attempt.account_name}</strong> (ID {attempt.account_id}).</p>
          <p className="mt-1 text-muted">Он будет общим рабочим аккаунтом MAX в Durov OS.</p>
          <Button size="sm" className="mt-3" disabled={busy} onClick={() => void action(async () => {
            setAttempt({ ...attempt, phase: 'connecting' })
            setAttempt(await request<Attempt>(`/qr/${attempt.id}/confirm`, 'POST'))
            setConnection(await request<Connection>())
          })}>Подключить этот рабочий аккаунт</Button>
        </div>}
        {(active || autoRenew) && <Button size="sm" variant="ghost" className="mt-3" disabled={busy || attempt.phase === 'connecting'} onClick={() => {
          setAutoRenew(false)
          void action(async () => {
            setAttempt(await request<Attempt>(`/qr/${attempt.id}`, 'DELETE'))
            setPassword('')
          })
        }}>Отменить подключение</Button>}
      </div>}
    </section>
  )
}
