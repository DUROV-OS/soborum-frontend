import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { connectionStatus, connectionLabels, dial, type ConnectionStatus } from './communications'

export function CrmCallAction({ phone, onBusy }: { phone: string; onBusy: (value: boolean) => void }) {
  const current = useAuthStore(s => s.current)
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const requestId = useRef(crypto.randomUUID())
  const lock = useRef(false)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    connectionStatus().then(value => { if (live.current) setStatus(value) }).catch(e => { if (live.current) setError(e.message) })
    return () => { live.current = false }
  }, [])
  async function call() {
    if (lock.current || attempted || !status?.megafon.can_call) return
    lock.current = true; setBusy(true); onBusy(true); setError(''); setAttempted(true)
    try {
      const result = await dial(phone, requestId.current)
      if (live.current) setNotice(result.state === 'requested'
        ? 'ВАТС приняла запрос на звонок. Ожидайте вызов на рабочем телефоне; соединение с клиентом ещё не подтверждено.'
        : result.state === 'rejected' ? 'ВАТС отклонила запрос. Проверьте подключение и внутренний номер.'
        : 'Результат запроса неизвестен. Проверьте телефон и историю звонков перед новым вызовом.')
    } catch (e) {
      if (live.current) {
        setError(e instanceof Error ? e.message : 'Не удалось подтвердить звонок')
        if (e instanceof ApiError && [403, 409, 422, 503].includes(e.status)) setAttempted(false)
        else setNotice('Результат запроса неизвестен. Проверьте телефон и историю звонков перед новым вызовом.')
      }
    } finally { lock.current = false; if (live.current) { setBusy(false); onBusy(false) } }
  }
  return <div className="space-y-3 text-sm">
    <p>Сотрудник: <strong>{current?.full_name}</strong></p>
    <p>Рабочий номер: <strong>{current?.work_phone || 'Не указан'}</strong></p>
    <p>Логин / внутренний номер ВАТС: <strong>{status?.megafon.extension || 'Не назначен'}</strong></p>
    {status && <p>Связь с МегаФоном: {connectionLabels[status.megafon.state]}</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!status && !error && <p>Проверяем настройки…</p>}
    {status && !status.megafon.can_call && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3">Звонки пока не подключены для сотрудника. Руководителю нужно настроить ВАТС и сопоставить рабочие аккаунты в разделе «Доступ».</p>}
    {status?.megafon.can_call && !attempted && <Button disabled={busy} onClick={() => void call()}>Позвонить через МегаФон</Button>}
    {notice && <p role="status">{notice}</p>}
    {attempted && !busy && <Button size="sm" variant="secondary" onClick={() => {
      requestId.current = crypto.randomUUID(); setAttempted(false); setNotice(''); setError('')
    }}>Звонок завершён или не начался — новый вызов</Button>}
  </div>
}
