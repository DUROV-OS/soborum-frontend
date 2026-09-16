import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ASSIGNABLE_SECTIONS, SectionId } from '@/shared/sections'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
import { HelpButton } from '@/shared/ui/HelpButton'
import { Modal } from '@/shared/ui/Modal'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { useAuthStore } from '../store'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Матрица доступа',
    body: (
      <p>
        Строки таблицы — сотрудники, столбцы — разделы системы. Галочка означает, что сотрудник видит раздел и
        может в нём работать. Администраторы видят все разделы всегда, независимо от галочек в этой таблице.
      </p>
    ),
  },
  {
    title: 'Управление доступом',
    body: (
      <p>
        Кликните по галочке в ячейке, чтобы включить или выключить доступ сотрудника к разделу — изменение
        применяется сразу.
      </p>
    ),
  },
  {
    title: 'Новый сотрудник',
    body: (
      <p>
        Кнопка «Новый сотрудник» в правом верхнем углу открывает форму: ФИО, почта, пароль и сразу — список
        разделов, к которым нужно дать доступ.
      </p>
    ),
  },
]

export function AccessMatrixPage() {
  const accounts = useAuthStore((s) => s.accounts)
  const loadAccounts = useAuthStore((s) => s.loadAccounts)
  const updateAccess = useAuthStore((s) => s.updateAccess)
  const addAccount = useAuthStore((s) => s.addAccount)
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const onboarding = useSectionOnboarding('admin')

  useEffect(() => {
    loadAccounts().catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников'))
  }, [loadAccounts])

  const workers = accounts.filter((a) => a.role === 'worker')

  async function toggle(accountId: number, section: SectionId, hasIt: boolean) {
    const account = accounts.find((a) => a.id === accountId)
    if (!account) return
    const next = hasIt
      ? account.module_access.filter((s) => s !== section)
      : [...account.module_access, section]
    setError(null)
    try {
      await updateAccess(accountId, next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить доступ')
    }
  }

  async function handleResetPassword(account: { id: number; full_name: string }) {
    if (!window.confirm(`Сбросить пароль сотрудника «${account.full_name}» до default-пароля?`)) return
    setError(null)
    setNotice(null)
    try {
      await resetPassword(account.id)
      setNotice(`Пароль сотрудника «${account.full_name}» сброшен: password1234`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сбросить пароль')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Матрица доступа</h1>
          <p className="mt-1 text-[13px] text-muted">
            Доступ к разделу — либо есть, либо нет. Администраторы видят всё всегда.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} />
            Новый сотрудник
          </Button>
          <HelpButton onClick={onboarding.show} />
        </div>
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-success-bg p-2.5 text-[13px] text-success">{notice}</p>}

      <Link
        to="/agents"
        className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-brand/40"
      >
        <div>
          <p className="text-[14px] font-medium text-ink">Панель агентов</p>
          <p className="mt-1 text-[12px] text-muted">
            Разметка, блоки юриста и следы восьми ролей — отдельно от матрицы доступа.
          </p>
        </div>
        <ArrowRight size={17} className="shrink-0 text-muted" />
      </Link>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="px-4 py-2.5 font-medium text-muted">Сотрудник</th>
              {ASSIGNABLE_SECTIONS.map((section) => (
                <th key={section.id} className="px-3 py-2.5 text-center font-medium text-muted">
                  {section.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-medium text-muted">Пароль</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((account) => (
              <tr key={account.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{account.full_name}</div>
                  <div className="text-[12px] text-muted">{account.email}</div>
                </td>
                {ASSIGNABLE_SECTIONS.map((section) => {
                  const hasIt = account.module_access.includes(section.id)
                  return (
                    <td key={section.id} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${account.full_name}: ${section.label}`}
                        checked={hasIt}
                        onChange={() => toggle(account.id, section.id, hasIt)}
                        className="h-4 w-4 accent-[rgb(var(--brand))]"
                      />
                    </td>
                  )
                })}
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(account)}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[12px] text-ink hover:border-brand/40"
                  >
                    <KeyRound size={13} />
                    Сбросить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateAccountModal open={creating} onClose={() => setCreating(false)} onCreate={addAccount} />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Доступ»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}

function CreateAccountModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: { email: string; password: string; full_name: string; module_access: SectionId[] }) => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sections, setSections] = useState<SectionId[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFullName('')
    setEmail('')
    setPassword('')
    setSections([])
    setError(null)
  }

  async function handleSubmit() {
    if (!fullName || !email || !password) return
    setSaving(true)
    try {
      await onCreate({ email, password, full_name: fullName, module_access: sections })
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать сотрудника')
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
      title="Новый сотрудник"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!fullName || !email || !password || saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="ФИО" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван" />
        </Field>
        <Field label="Почта" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@example.com" />
        </Field>
        <Field label="Пароль" required>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Доступ к разделам">
          <div className="flex flex-col gap-2">
            {ASSIGNABLE_SECTIONS.map((section) => (
              <label key={section.id} className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={sections.includes(section.id)}
                  onChange={(e) =>
                    setSections((prev) =>
                      e.target.checked
                        ? [...prev, section.id]
                        : prev.filter((s) => s !== section.id),
                    )
                  }
                  className="h-4 w-4 accent-[rgb(var(--brand))]"
                />
                {section.label}
              </label>
            ))}
          </div>
        </Field>
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
