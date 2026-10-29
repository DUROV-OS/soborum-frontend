import { useEffect, useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { listAssignees } from '../api'
import { Client, ClientAssignee } from '../types'
import { ReadRow, Section } from './PanelPrimitives'

/**
 * Ответственный менеджер клиента (0080-a) — адресат уведомлений по нему.
 * Изменять доступно тем же ролям, что меняют стадию клиента (`edit` и выше
 * в разделе «Клиенты») — та же проверка, что у кнопки перевода стадии на
 * {@link ClientDetailPage}.
 *
 * Список активных сотрудников с доступом к клиентам доступен через
 * отдельный API для пользователей с правом редактирования.
 */
export function ManagerPanel({ client }: { client: Client }) {
  const updateManager = useClientsStore((s) => s.updateManager)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [editing, setEditing] = useState(false)
  const [accounts, setAccounts] = useState<ClientAssignee[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [managerId, setManagerId] = useState<number | ''>(client.manager_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setManagerId(client.manager_id ?? '')
  }, [client.manager_id])

  useEffect(() => {
    if (!editing || !canEdit) return
    let cancelled = false
    setAccounts(null)
    setListError(null)
    listAssignees().then((people) => {
      if (!cancelled) setAccounts(people)
    }).catch(() => {
      if (!cancelled) setListError('Не удалось загрузить список сотрудников.')
    })
    return () => { cancelled = true }
  }, [editing, canEdit, attempt])

  async function save() {
    setSaving(true)
    const result = await updateManager(client.id, managerId === '' ? null : managerId)
    setSaving(false)
    if (result.ok) {
      setEditing(false)
      setError(null)
      return
    }
    setError(result.reason ?? 'Не удалось сохранить')
  }

  if (!editing) {
    return (
      <Section title="Ответственный менеджер">
        <ReadRow label="Менеджер" value={client.manager?.full_name ?? 'Не назначен'} />
        {canEdit && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        )}
      </Section>
    )
  }

  return (
    <Section title="Ответственный менеджер">
      {listError ? (
        <div role="alert" className="text-[12px] text-danger">{listError} <button type="button" className="underline" onClick={() => setAttempt(n => n + 1)}>Повторить</button></div>
      ) : accounts === null ? (
        <p className="text-[12px] text-muted">Загружаем сотрудников…</p>
      ) : (
        <Select
          aria-label="Ответственный менеджер"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— не назначен —</option>
          {client.manager_id && !accounts.some(account => account.id === client.manager_id) && (
            <option value={client.manager_id}>{client.manager?.full_name ?? 'Текущий менеджер'} · недоступен</option>
          )}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.full_name}
            </option>
          ))}
        </Select>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || accounts === null || Boolean(listError)}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setManagerId(client.manager_id ?? '')
            setEditing(false)
            setError(null)
          }}
        >
          Отмена
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Section>
  )
}
