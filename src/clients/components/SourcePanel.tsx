import { useEffect, useState } from 'react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client } from '../types'
import { ReadRow, Section } from './PanelPrimitives'

/**
 * Кто привёл клиента (0079-c): пришёл сам или через агентство-партнёр.
 * В отличие от остальных базовых данных источник не замораживается после
 * создания — агентство нередко выясняется позже, уже в работе с клиентом.
 */
export function SourcePanel({ client }: { client: Client }) {
  const updateSource = useClientsStore((s) => s.updateSource)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [editing, setEditing] = useState(false)
  const [viaAgency, setViaAgency] = useState(client.via_agency)
  const [name, setName] = useState(client.agency_name ?? '')
  const [contact, setContact] = useState(client.agency_contact ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setViaAgency(client.via_agency)
    setName(client.agency_name ?? '')
    setContact(client.agency_contact ?? '')
  }, [client.via_agency, client.agency_name, client.agency_contact])

  async function save() {
    if (viaAgency && !name.trim()) {
      setError('Укажите, какое агентство привело клиента')
      return
    }
    setSaving(true)
    const result = await updateSource(client.id, {
      via_agency: viaAgency,
      agency_name: viaAgency ? name.trim() : null,
      agency_contact: viaAgency ? contact.trim() || null : null,
    })
    setSaving(false)
    if (result.ok) {
      setEditing(false)
      setError(null)
      return
    }
    setError(result.reason ?? 'Не удалось сохранить источник')
  }

  if (!editing) {
    return (
      <Section title="Источник клиента">
        <ReadRow label="Как пришёл" value={client.via_agency ? 'Привело агентство' : 'Напрямую'} />
        {client.via_agency && <ReadRow label="Агентство" value={client.agency_name} />}
        {client.via_agency && <ReadRow label="Контакт агента" value={client.agency_contact} />}
        {canEdit && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        )}
      </Section>
    )
  }

  return (
    <Section title="Источник клиента">
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={viaAgency}
          onChange={(e) => setViaAgency(e.target.checked)}
          className="h-4 w-4 accent-[#395b4b]"
        />
        Клиента привело агентство
      </label>
      {viaAgency && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Агентство" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название агентства" />
          </Field>
          <Field label="Контакт агента" hint="Необязательно">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+7 900 … / @agent" />
          </Field>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
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
