import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MESSENGER_SUGGESTIONS } from '@/clients/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { usePartnersStore } from '../store'
import { Partner, PARTNER_CATEGORIES, PartnerCategory, PartnerContact, PartnerInput } from '../types'

const MESSENGER_LIST_ID = 'partner-messenger-suggestions'
const CITY_LIST_ID = 'partner-city-suggestions'

interface FormState {
  category: PartnerCategory | ''
  name: string
  city: string
  organization: string
  phone: string
  email: string
  contacts: PartnerContact[]
  comment: string
}

function initialState(partner?: Partner): FormState {
  return {
    category: partner?.category ?? '',
    name: partner?.name ?? '',
    city: partner?.city ?? '',
    organization: partner?.organization ?? '',
    phone: partner?.phone ?? '',
    email: partner?.email ?? '',
    contacts: partner?.contacts.length ? partner.contacts : [{ messenger: 'Telegram', contact: '' }],
    comment: partner?.comment ?? '',
  }
}

/** Добавление партнёра или, если передан `partner`, правка его данных.
 * Обязательны категория, имя и город — без города заказчику непонятно,
 * откуда партнёр. */
export function PartnerFormModal({
  open,
  onClose,
  partner,
}: {
  open: boolean
  onClose: () => void
  partner?: Partner
}) {
  const create = usePartnersStore((s) => s.create)
  const update = usePartnersStore((s) => s.update)
  const cities = usePartnersStore((s) => s.cities)
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(() => initialState(partner))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialState(partner))
      setError(null)
    }
  }, [open, partner])

  const valid = Boolean(form.category && form.name.trim() && form.city.trim())

  function patch(changes: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...changes }))
  }

  function updateContact(index: number, changes: Partial<PartnerContact>) {
    patch({ contacts: form.contacts.map((c, i) => (i === index ? { ...c, ...changes } : c)) })
  }

  async function handleSubmit() {
    if (!valid || !form.category) return
    const input: PartnerInput = {
      category: form.category,
      name: form.name.trim(),
      city: form.city.trim(),
      organization: form.organization.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      contacts: form.contacts
        .filter((c) => c.messenger.trim() && c.contact.trim())
        .map((c) => ({ messenger: c.messenger.trim(), contact: c.contact.trim() })),
      comment: form.comment.trim() || null,
    }
    setSaving(true)
    if (partner) {
      const result = await update(partner.id, input)
      setSaving(false)
      if (result.ok) onClose()
      else setError(result.reason ?? 'Не удалось сохранить')
      return
    }
    try {
      const created = await create(input)
      onClose()
      navigate(`/partners/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить партнёра')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={partner ? 'Данные партнёра' : 'Новый партнёр'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? 'Сохранение…' : partner ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <datalist id={MESSENGER_LIST_ID}>
        {MESSENGER_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id={CITY_LIST_ID}>
        {cities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Категория" required>
            <Select value={form.category} onChange={(e) => patch({ category: e.target.value as PartnerCategory })}>
              <option value="" disabled>
                Выберите…
              </option>
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Город" required>
            <Input
              list={CITY_LIST_ID}
              value={form.city}
              onChange={(e) => patch({ city: e.target.value })}
              placeholder="Москва"
            />
          </Field>
        </div>
        <Field label="ФИО или название" required>
          <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Иванов Иван Иванович" />
        </Field>
        <Field label="Организация" hint="У риэлтора — агентство, в котором он работает">
          <Input value={form.organization} onChange={(e) => patch({ organization: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Телефон">
            <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+7 900 000-00-00" />
          </Field>
          <Field label="Почта">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="mail@example.com"
            />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Способы связи</span>
          <div className="flex flex-col gap-2">
            {form.contacts.map((c, i) => (
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
                  onClick={() =>
                    patch({
                      contacts:
                        form.contacts.length === 1
                          ? [{ messenger: '', contact: '' }]
                          : form.contacts.filter((_, x) => x !== i),
                    })
                  }
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
            onClick={() => patch({ contacts: [...form.contacts, { messenger: '', contact: '' }] })}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-brand"
          >
            <Plus size={13} />
            Ещё способ связи
          </button>
        </div>

        <Field label="Комментарий">
          <Textarea rows={2} value={form.comment} onChange={(e) => patch({ comment: e.target.value })} />
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
