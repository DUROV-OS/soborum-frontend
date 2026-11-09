import { useEffect, useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { catalog } from './api'

type Account = { user_id: number; login: string; enabled: boolean; password_saved: boolean }
export function BrowserPhoneSettings() {
  const director = useAuthStore(s => s.current?.role === 'admin' && s.current.job_role === 'director')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])
  const [selected, select] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!director) return
    let live = true
    Promise.all([catalog(), apiRequest<{ items: Account[]; gateway_configured: boolean }>({ section: 'crm', path: '/browser-phone/accounts' })]).then(([crm, value]) => {
      if (live) { setUsers(crm.users); setAccounts(value.items); setReady(value.gateway_configured) }
    }).catch(error => { if (live) setError(error.message) })
    return () => { live = false }
  }, [director])
  function choose(value: string) {
    const account = accounts.find(item => item.user_id === Number(value))
    select(value); setLogin(account?.login || ''); setPassword(''); setEnabled(account?.enabled ?? true); setNotice(''); setError('')
  }
  if (!director) return null
  const saved = accounts.find(item => item.user_id === Number(selected))
  return <section aria-label="Браузерная телефония" className="space-y-3 rounded-xl border border-border p-4">
    <h3 className="font-semibold">Звонки через гарнитуру компьютера</h3>
    <p>Сервер голоса: <strong>{ready ? 'Настроен' : 'Ожидает настройки сервера'}</strong></p>
    <p className="text-xs text-muted">Укажите действующий SIP-логин и пароль сотрудника из ВАТС МегаФон. Они сохраняются на сервере в защищённом виде. Смена пароля в МегаФоне не требуется.</p>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); if (busy) return
      setBusy(true); setError(''); setNotice('')
      void apiRequest<{ items: Account[] }>({ section: 'crm', path: `/browser-phone/accounts/${selected}`, method: 'PUT', body: { login, password, enabled } }).then(value => {
        setAccounts(value.items); setPassword(''); setNotice('Настройки сотрудника сохранены. В карточке клиента откройте «Звонки» → «Позвонить из CRM».')
      }).catch(error => setError(error.message)).finally(() => setBusy(false))
    }}>
      <Field label="Сотрудник для браузерных звонков"><Select aria-label="Сотрудник для браузерных звонков" value={selected} onChange={event => choose(event.target.value)} disabled={busy}><option value="">Выберите сотрудника</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SIP-логин МегаФона"><Input aria-label="SIP-логин МегаФона" value={login} required maxLength={100} autoComplete="off" onChange={event => setLogin(event.target.value)} /></Field>
        <Field label={saved?.password_saved ? 'SIP-пароль сохранён — оставьте пустым' : 'Действующий SIP-пароль'}><Input aria-label="Действующий SIP-пароль" type="password" value={password} required={!saved?.password_saved} maxLength={255} autoComplete="new-password" onChange={event => setPassword(event.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Разрешить сотруднику звонки из браузера</label>
      <Button type="submit" size="sm" disabled={!selected || busy}>{busy ? 'Сохраняем…' : 'Сохранить браузерный телефон'}</Button>
      {saved?.password_saved && <Button type="button" size="sm" variant="secondary" disabled={busy || !saved.enabled} onClick={() => {
        setBusy(true); setError(''); setNotice('')
        void apiRequest({ section: 'crm', path: `/browser-phone/accounts/${selected}/check`, method: 'POST', timeoutMs: 30000 })
          .then(() => setNotice('SIP-подключение подтверждено. Проверка выполнена без звонка.'))
          .catch(error => setError(error.message)).finally(() => setBusy(false))
      }}>Проверить подключение без звонка</Button>}
    </form>
    {error && <p role="alert" className="text-danger">{error}</p>}{notice && <p role="status">{notice}</p>}
    {accounts.length > 0 && <ul className="space-y-1 text-xs text-muted">{accounts.map(account => <li key={account.user_id}>{users.find(user => user.id === account.user_id)?.name || `Сотрудник ${account.user_id}`} · {account.login} · {account.enabled ? 'Разрешён' : 'Отключён'}</li>)}</ul>}
  </section>
}
