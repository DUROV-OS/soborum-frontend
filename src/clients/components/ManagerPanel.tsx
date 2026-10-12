import { useEffect, useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { useAuthStore } from '@/auth/store'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { ReadRow, Section } from './PanelPrimitives'

/**
 * Ответственный менеджер клиента (0080-a) — адресат уведомлений по нему.
 * Изменять доступно тем же ролям, что меняют стадию клиента (`edit` и выше
 * в разделе «Клиенты») — та же проверка, что у кнопки перевода стадии на
 * {@link ClientDetailPage}.
 *
 * Список сотрудников берётся из общего стора авторизации (`useAuthStore`),
 * который сервер отдаёт только администратору (0080-a: без нового
 * списочного API — переиспользуем `GET /api/auth/users`) — у остальных ролей
 * с правом редактирования карточки список пуст, и выбор недоступен, как и в
 * других местах фронта, где выбирают сотрудника (см. `CreateTaskModal`).
 */
export function ManagerPanel({ client }: { client: Client }) {
  const accounts = useAuthStore((s) => s.accounts)
  const updateManager = useClientsStore((s) => s.updateManager)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [editing, setEditing] = useState(false)
  const [managerId, setManagerId] = useState<number | ''>(client.manager_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setManagerId(client.manager_id ?? '')
  }, [client.manager_id])

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
      {accounts.length === 0 ? (
        <p className="text-[12px] text-muted">
          Список сотрудников доступен только администратору — войдите под администратором, чтобы
          назначить менеджера.
        </p>
      ) : (
        <Select
          value={managerId}
          onChange={(e) => setManagerId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">— не назначен —</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.full_name}
            </option>
          ))}
        </Select>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
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
