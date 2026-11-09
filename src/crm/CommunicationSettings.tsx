import { useEffect, useState } from 'react'
import type { Account } from '@/auth/types'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { connectionStatus, connectionLabels, type ConnectionStatus, type ConnectionState } from './communications'

type Member = { user_id: number; pbx_user: string; enabled: boolean }
type Routing = { version: number; enabled: boolean; main_phone: string; wait_seconds: number; pbx_setup_confirmed: boolean; members: Member[]; fallback?: string }
type Check = { checked_at: string; megafon: { state: ConnectionState; accounts?: { name: string; extension: string }[] }; max: { state: ConnectionState } }

export function CommunicationSettings({ accounts }: { accounts: Account[] }) {
  const [config, setConfig] = useState<Routing | null>(null)
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [check, setCheck] = useState<Check | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, refresh] = useState(0)
  useEffect(() => {
    let current = true
    Promise.all([apiRequest<Routing>({ section: 'crm', path: '/telephony/routing' }), connectionStatus()]).then(([value, state]) => {
      if (current) { setConfig(value); setStatus(state); setError('') }
    }).catch(e => { if (current) setError(e.message) })
    return () => { current = false }
  }, [revision])
  const choices = accounts.filter(a => a.is_active && (a.role === 'admin' || ['edit', 'full'].includes(a.module_access.clients || '')))
  async function save() {
    if (!config || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { fallback: _fallback, ...body } = config
      const saved = await apiRequest<Routing>({ section: 'crm', path: '/telephony/routing', method: 'PUT', body })
      setConfig(saved); setNotice(saved.enabled ? 'Правила CRM включены. Фактическое поступление и переадресацию звонка нужно проверить в ВАТС.' : 'Настройки сохранены. Распределение через CRM выключено.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить') }
    finally { setBusy(false) }
  }
  async function inspect() {
    setBusy(true); setError(''); setNotice('')
    try {
      const value = await apiRequest<Check>({ section: 'crm', path: '/communications/check', method: 'POST', timeoutMs: 60000 })
      setCheck(value); setStatus(await connectionStatus())
    } catch (e) { setError(e instanceof Error ? e.message : 'Проверка недоступна') }
    finally { setBusy(false) }
  }
  return <details className="mb-5 rounded-2xl border border-border bg-surface p-5">
    <summary className="cursor-pointer text-base font-semibold">МегаФон: звонки и распределение</summary>
    <div className="mt-4 space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <p>МегаФон: <strong>{status ? connectionLabels[status.megafon.state] : 'Загрузка…'}</strong></p>
      </div>
      {status && !status.megafon.configured && <p>На сервере нужно задать адрес ВАТС и ключ управления. Для входящих событий нужен отдельный ключ CRM. Ключи в этой форме не отображаются.</p>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void inspect()}>{busy ? 'Подождите…' : 'Проверить связь без звонка и сообщений'}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => refresh(v => v + 1)}>Загрузить сохранённые настройки</Button></div>
      {check && <p className="text-xs text-muted">Последняя проверка: {new Date(check.checked_at).toLocaleString('ru-RU')}</p>}
      {check?.megafon.accounts?.length ? <p className="text-xs">Сотрудники ВАТС: {check.megafon.accounts.map(a => a.name + ' — ' + a.extension).join('; ')}</p> : null}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {notice && <p role="status" className="text-brand">{notice}</p>}
      {config && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Общий входящий номер"><Input value={config.main_phone} onChange={event => setConfig({ ...config, main_phone: event.target.value, pbx_setup_confirmed: false, enabled: false })} /></Field>
          <Field label="Ожидание менеджера, секунд"><Input type="number" min={10} max={120} value={config.wait_seconds} onChange={event => setConfig({ ...config, wait_seconds: Number(event.target.value), pbx_setup_confirmed: false, enabled: false })} /></Field>
        </div>
        <p>Новые номера распределяются по очереди. Повторный звонок направляется ответственному. При отсутствии ответа — другому менеджеру, с сохранением ответственного.</p>
        {config.members.map((member, index) => <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
          <Field label="Менеджер"><Select aria-label="Менеджер" value={member.user_id} onChange={event => setConfig({ ...config, enabled: false, pbx_setup_confirmed: false, members: config.members.map((m, i) => i === index ? { ...m, user_id: Number(event.target.value) } : m) })}>
            <option value={0}>Выберите сотрудника</option>{choices.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </Select></Field>
          <Field label="Логин / внутренний номер ВАТС"><Input value={member.pbx_user} maxLength={100} onChange={event => setConfig({ ...config, enabled: false, pbx_setup_confirmed: false, members: config.members.map((m, i) => i === index ? { ...m, pbx_user: event.target.value.trim() } : m) })} /></Field>
          <div className="flex items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" checked={member.enabled} onChange={event => setConfig({ ...config, members: config.members.map((m, i) => i === index ? { ...m, enabled: event.target.checked } : m) })} />Участвует</label><Button size="sm" variant="ghost" type="button" onClick={() => setConfig({ ...config, enabled: false, pbx_setup_confirmed: false, members: config.members.filter((_, i) => i !== index) })}>Убрать</Button></div>
        </div>)}
        <Button type="button" variant="secondary" size="sm" onClick={() => setConfig({ ...config, members: [...config.members, { user_id: 0, pbx_user: '', enabled: true }] })}>Добавить менеджера</Button>
        <p className="text-xs text-muted">В кабинете МегаФона настройте сценарий «Ваша CRM» только для общего номера, перевод на ответственного, ожидание {config.wait_seconds} секунд и затем очередь отдела продаж. Эти параметры ВАТС не меняются автоматически при сохранении формы.</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={config.pbx_setup_confirmed} onChange={event => setConfig({ ...config, pbx_setup_confirmed: event.target.checked, enabled: event.target.checked ? config.enabled : false })} />Основной номер, сотрудники, ожидание и резервная очередь настроены в ВАТС</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={config.enabled} onChange={event => setConfig({ ...config, enabled: event.target.checked })} />Включить распределение через CRM</label>
        <Button disabled={busy} type="submit">Сохранить настройки связи</Button>
      </form>}
    </div>
  </details>
}
