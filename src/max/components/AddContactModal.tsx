import { FormEvent, useEffect, useState } from 'react'
import { startDialog } from '../api'
import { MaxStartDialogResult } from '../types'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

const FORM_ID = 'max-add-contact-form'

/** Цифр меньше 10 — заведомо не номер, в MAX не ходим. */
function hasEnoughDigits(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10
}

/** «Новый контакт» (0093): человек ищется в MAX по номеру, при необходимости
 * добавляется в контакты общего аккаунта под введённым именем, и открывается
 * личный диалог с ним. Сообщений само окно не отправляет. Номер не найден в
 * MAX — окно остаётся открытым с причиной. */
export function AddContactModal({
  open,
  onClose,
  onStarted,
}: {
  open: boolean
  onClose: () => void
  onStarted: (result: MaxStartDialogResult) => void
}) {
  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPhone('')
    setFirstName('')
    setLastName('')
    setError(null)
  }, [open])

  const canSubmit = hasEnoughDigits(phone) && firstName.trim() !== '' && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await startDialog({ phone, firstName: firstName.trim(), lastName: lastName.trim() })
      onStarted(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось найти номер в MAX')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый контакт"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form={FORM_ID} size="sm" disabled={!canSubmit}>
            {submitting ? 'Ищем в MAX…' : 'Найти и написать'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-[12px] text-muted">
          Найдём человека в MAX по номеру и откроем с ним переписку. Если его нет в контактах аккаунта
          организации — добавим под этим именем.
        </p>
        <Field label="Телефон" required hint="Можно в любом виде: +7 900 123-45-67, 8 900…">
          <Input
            type="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 123-45-67"
          />
        </Field>
        <Field label="Имя" required>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={64} />
        </Field>
        <Field label="Фамилия">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={64} />
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
