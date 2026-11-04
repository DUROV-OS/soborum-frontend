import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import type { WorkPhoneInput } from '../api'
import type { Account } from '../types'

export function EmployeeWorkPhone({ account, onSave }: {
  account: Account
  onSave: (id: number, input: WorkPhoneInput) => Promise<void>
}) {
  const [phone, setPhone] = useState(account.work_phone || '')
  const [extension, setExtension] = useState(account.telephony_extension || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setPhone(account.work_phone || '')
    setExtension(account.telephony_extension || '')
  }, [account.id, account.work_phone, account.telephony_extension])
  const phoneChanged = phone !== (account.work_phone || '')
  const extensionChanged = extension !== (account.telephony_extension || '')
  return <form aria-label={`Рабочий номер: ${account.full_name}`} className="space-y-3 rounded-xl border border-border p-3" onSubmit={async event => {
    event.preventDefault()
    if (saving || (!phoneChanged && !extensionChanged)) return
    setSaving(true); setSaved(false); setError('')
    try {
      await onSave(account.id, {
        ...(phoneChanged ? { work_phone: phone.trim() || null } : {}),
        ...(extensionChanged ? { telephony_extension: extension.trim() || null } : {}),
      })
      setSaved(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить рабочий номер')
    } finally {
      setSaving(false)
    }
  }}>
    <p className="text-[13px] font-medium text-ink">{account.full_name}{!account.is_active && <span className="ml-2 text-[11px] font-normal text-muted">Отключён</span>}</p>
    <Field label="Рабочий телефон">
      <Input type="tel" autoComplete="off" aria-label={`Рабочий телефон: ${account.full_name}`} placeholder="+код страны и номер" maxLength={64} disabled={saving} value={phone} onChange={event => { setPhone(event.target.value); setSaved(false) }} />
    </Field>
    <Field label="Внутренний номер АТС" hint="Если назначен в АТС; от 1 до 10 цифр.">
      <Input inputMode="numeric" autoComplete="off" aria-label={`Внутренний номер АТС: ${account.full_name}`} maxLength={10} disabled={saving} value={extension} onChange={event => { setExtension(event.target.value); setSaved(false) }} />
    </Field>
    {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    <div className="flex items-center gap-3"><Button size="sm" type="submit" variant="secondary" disabled={saving || (!phoneChanged && !extensionChanged)}>{saving ? 'Сохранение…' : 'Сохранить номер'}</Button>{saved && <span role="status" className="text-[12px] text-success">Сохранено</span>}</div>
  </form>
}
