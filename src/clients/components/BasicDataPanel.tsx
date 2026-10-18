import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { useClientsStore } from '../store'
import { Client, ClientContact, MESSENGER_SUGGESTIONS } from '../types'
import { ReadRow, Section } from './PanelPrimitives'

const MESSENGER_LIST_ID = 'basic-messenger-suggestions'

/**
 * Базовые данные клиента (0111-b): ФИО, телефон, почта, способы связи. Лид с
 * сайта приходит с тем, что оставил посетитель, остальное дозаполняется по ходу
 * общения — поэтому данные правятся в любой момент. Дубль телефона/почты с другим
 * клиентом бэкенд отклоняет (409) и называет его по имени.
 */
export function BasicDataPanel({ client }: { client: Client }) {
  const updateBasic = useClientsStore((s) => s.updateBasic)
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(client.full_name)
  const [phone, setPhone] = useState(client.phone)
  const [email, setEmail] = useState(client.email)
  const [contacts, setContacts] = useState<ClientContact[]>(client.contacts)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEditing() {
    setFullName(client.full_name)
    setPhone(client.phone)
    setEmail(client.email)
    setContacts(client.contacts)
    setError(null)
    setEditing(true)
  }

  const valid = fullName.trim() !== '' && (phone.trim() !== '' || email.trim() !== '')

  function updateContact(index: number, patch: Partial<ClientContact>) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  async function save() {
    if (!valid) return
    setSaving(true)
    const result = await updateBasic(client.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      contacts: contacts
        .filter((c) => c.messenger.trim() && c.contact.trim())
        .map((c) => ({ messenger: c.messenger.trim(), contact: c.contact.trim() })),
    })
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
      <Section title="Базовые данные">
        <ReadRow label="Телефон" value={client.phone} />
        <ReadRow label="Почта" value={client.email} />
        {client.contacts.length > 0 ? (
          client.contacts.map((c, i) => <ReadRow key={i} label={c.messenger} value={c.contact} />)
        ) : (
          <ReadRow label="Способы связи" value={undefined} />
        )}
        {canEdit && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={startEditing}>
            Изменить
          </Button>
        )}
      </Section>
    )
  }

  return (
    <Section title="Базовые данные">
      <datalist id={MESSENGER_LIST_ID}>
        {MESSENGER_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="flex flex-col gap-4">
        <Field label="ФИО" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Телефон">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
          </Field>
          <Field label="Почта">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@example.com" />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Способы связи</span>
          <div className="flex flex-col gap-2">
            {contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  list={MESSENGER_LIST_ID}
                  value={c.messenger}
                  onChange={(e) => updateContact(i, { messenger: e.target.value })}
                  placeholder="Мессенджер"
                  className="sm:max-w-[40%]"
                />
                <Input
                  value={c.contact}
                  onChange={(e) => updateContact(i, { contact: e.target.value })}
                  placeholder="@ivan / +7 900 …"
                />
                <button
                  type="button"
                  onClick={() => setContacts((prev) => prev.filter((_, x) => x !== i))}
                  className="shrink-0 rounded-md p-2 text-muted hover:text-danger"
                  aria-label="Убрать способ связи"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setContacts((prev) => [...prev, { messenger: '', contact: '' }])}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-brand"
          >
            <Plus size={13} />
            Способ связи
          </button>
        </div>
        <p className="text-[12px] text-muted">Нужен хотя бы один из двух: телефон или почта.</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={!valid || saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Отмена
        </Button>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </Section>
  )
}
