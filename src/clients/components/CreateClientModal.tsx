import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { ReferrerPicker } from '@/partners/components/ReferrerPicker'
import { PartnerBrief } from '@/partners/types'
import { useClientsStore } from '../store'
import { ClientContact, MESSENGER_SUGGESTIONS } from '../types'

const MESSENGER_LIST_ID = 'messenger-suggestions'

export function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useClientsStore((s) => s.create)
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [contacts, setContacts] = useState<ClientContact[]>([{ messenger: 'Telegram', contact: '' }])
  // Вместо галочки «привело агентство» с текстом (0079-c) — ссылка на
  // партнёра из базы (0083-c): так у партнёра видно всех приведённых клиентов.
  const [referrer, setReferrer] = useState<PartnerBrief | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filledContacts = contacts.filter((c) => c.messenger.trim() && c.contact.trim())
  const valid =
    Boolean(fullName && phone && email) && filledContacts.length > 0

  function reset() {
    setFullName('')
    setPhone('')
    setEmail('')
    setContacts([{ messenger: 'Telegram', contact: '' }])
    setReferrer(null)
    setError(null)
  }

  function updateContact(index: number, patch: Partial<ClientContact>) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  async function handleSubmit() {
    if (!valid) return
    setSaving(true)
    try {
      const client = await create({
        full_name: fullName,
        phone,
        email,
        contacts: filledContacts.map((c) => ({ messenger: c.messenger.trim(), contact: c.contact.trim() })),
        via_agency: false,
        referrer_partner_id: referrer?.id ?? null,
      })
      reset()
      onClose()
      navigate(`/clients/${client.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать клиента')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Новый клиент"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-muted">
        После создания базовые данные нельзя изменить. Исключение — «Кто рекомендовал»: если это
        выяснится позже, рекомендателя можно указать прямо в карточке.
      </p>
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
          <Field label="Телефон" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
          </Field>
          <Field label="Почта" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@example.com" />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink">
            Способы связи<span className="text-danger"> *</span>
          </span>
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
                  onClick={() => setContacts((prev) => (prev.length === 1 ? prev : prev.filter((_, x) => x !== i)))}
                  disabled={contacts.length === 1}
                  className="shrink-0 rounded-md p-2 text-muted hover:text-danger disabled:opacity-30"
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
            Ещё способ связи
          </button>
        </div>

        <Field label="Кто рекомендовал" hint="Риэлтор, агентство или другой партнёр, который привёл клиента">
          <ReferrerPicker value={referrer} onChange={setReferrer} />
        </Field>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
