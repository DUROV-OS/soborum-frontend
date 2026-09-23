import { useState } from 'react'
import { FileAsset } from '@/clients/types'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { useAccountingStore } from '../store'
import { CounterpartyPicker } from './CounterpartyPicker'
import { MovementDocumentsField } from './MovementDocumentsField'
import {
  ASSESSMENT_LABEL,
  CLIENT_SOURCE_SUBKINDS,
  CREATABLE_SUBKINDS,
  MoneyAssessment,
  MoneySubkind,
  SUBKIND_LABEL,
} from '../types'

const EMPTY = {
  subkind: 'sale_income' as MoneySubkind,
  account_id: '' as number | '',
  counterparty_id: null as number | null,
  amount: '',
  tax: '',
  assessment: 'actual' as MoneyAssessment,
  affects_profit: true,
  client_id: '' as number | '',
  payment_purpose: '',
  comment: '',
  link: '',
  documents: [] as FileAsset[],
}

export function CreateMovementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clients = useAccountingStore((s) => s.clients)
  const create = useAccountingStore((s) => s.create)
  const organizations = useAccountingStore((s) => s.organizations)
  const selectedAccountId = useAccountingStore((s) => s.selectedAccountId)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsClient = CLIENT_SOURCE_SUBKINDS.includes(form.subkind)

  // Счета всех организаций одним списком: проводку заводят с той вкладки, где
  // открыт раздел, но переложить её на счёт другого юрлица прямо в форме —
  // нормальный случай, ради него не надо закрывать окно.
  const accountOptions = organizations.flatMap((org) =>
    org.accounts
      .filter((a) => a.is_active)
      .map((a) => ({ id: a.id, label: `${org.short_name} — ${a.name}` })),
  )
  // Предзаполнение счётом текущей вкладки; пока справочник не загружен — пусто.
  const accountId = form.account_id === '' ? selectedAccountId : form.account_id

  function reset() {
    setForm(EMPTY)
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function submit() {
    setError(null)
    const amount = Number(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setError('Укажите положительную сумму')
      return
    }
    if (needsClient && form.client_id === '') {
      setError('Выберите клиента')
      return
    }
    if (accountId === null) {
      setError('Выберите счёт, по которому прошёл платёж')
      return
    }
    setBusy(true)
    const result = await create({
      subkind: form.subkind,
      amount,
      account_id: accountId,
      counterparty_id: form.counterparty_id ?? undefined,
      tax: form.tax === '' ? undefined : Number(form.tax),
      assessment: form.assessment,
      affects_profit: form.affects_profit,
      client_id: needsClient ? Number(form.client_id) : undefined,
      payment_purpose: form.payment_purpose.trim() || undefined,
      comment: form.comment.trim() || undefined,
      document_ids: form.documents.length ? form.documents.map((d) => d.id) : undefined,
      link: form.link.trim() || undefined,
    })
    setBusy(false)
    if (result.ok) close()
    else setError(result.reason ?? 'Не удалось создать проводку')
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новая проводка"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy || accountId === null}>
            {busy ? '…' : 'Создать черновик'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Счёт" required hint="Организация и счёт, по которому прошёл платёж.">
          <Select
            value={accountId ?? ''}
            onChange={(e) =>
              setForm({ ...form, account_id: e.target.value === '' ? '' : Number(e.target.value) })
            }
          >
            <option value="">— выберите счёт —</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Контрагент" hint="Необязательно. Нужен, чтобы видеть историю платежей по нему.">
          <CounterpartyPicker
            value={form.counterparty_id}
            onChange={(counterparty_id) => setForm({ ...form, counterparty_id })}
          />
        </Field>

        <Field label="Вид проводки" required hint="Зарплата и оплата поставки заводятся из своих разделов.">
          <Select
            value={form.subkind}
            onChange={(e) => setForm({ ...form, subkind: e.target.value as MoneySubkind, client_id: '' })}
          >
            {CREATABLE_SUBKINDS.map((s) => (
              <option key={s} value={s}>
                {SUBKIND_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>

        {needsClient && (
          <Field label="Клиент" required>
            <Select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              <option value="">— выберите клиента —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Сумма, ₽" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Налог, ₽">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.tax}
              onChange={(e) => setForm({ ...form, tax: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Оценка">
          <Select
            value={form.assessment}
            onChange={(e) => setForm({ ...form, assessment: e.target.value as MoneyAssessment })}
          >
            {(Object.keys(ASSESSMENT_LABEL) as MoneyAssessment[]).map((a) => (
              <option key={a} value={a}>
                {ASSESSMENT_LABEL[a]}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={form.affects_profit}
            onChange={(e) => setForm({ ...form, affects_profit: e.target.checked })}
          />
          Учитывать в оценке прибыли
        </label>

        <Field label="Назначение платежа">
          <Input
            value={form.payment_purpose}
            onChange={(e) => setForm({ ...form, payment_purpose: e.target.value })}
            placeholder="необязательно"
          />
        </Field>

        <Field label="Комментарий">
          <Textarea
            rows={2}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="необязательно"
          />
        </Field>

        <Field label="Ссылка" hint="Необязательно — на договор, чат, счёт и т.п.">
          <Input
            type="url"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="https://…"
          />
        </Field>

        <Field label="Документ">
          <MovementDocumentsField
            documents={form.documents}
            onChange={(documents) => setForm({ ...form, documents })}
          />
        </Field>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
