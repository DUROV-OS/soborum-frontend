import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ASSIGNABLE_SECTIONS, SectionId } from '@/shared/sections'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { HelpButton } from '@/shared/ui/HelpButton'
import { Modal } from '@/shared/ui/Modal'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { useAuthStore } from '../store'
import { AdminsTab } from './AdminsTab'
import { AccessLevel, Account, Role } from '../types'

const ACCESS_LEVEL_OPTIONS: [AccessLevel, string][] = [
  ['none', 'Нет доступа'],
  ['view', 'Только просмотр'],
  ['edit', 'Редактирование'],
  ['full', 'Полный доступ'],
]

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Матрица доступа',
    body: (
      <p>
        Строки таблицы — сотрудники, столбцы — разделы системы. На пересечении — уровень доступа: «Нет доступа»
        (раздел скрыт), «Только просмотр» (видит данные, не меняет), «Редактирование» (создаёт и меняет записи) или
        «Полный доступ» (плюс разрушительные и административные действия раздела). Администраторы видят и могут
        всё всегда, независимо от значений в этой таблице.
      </p>
    ),
  },
  {
    title: 'Управление доступом',
    body: (
      <p>
        Выберите уровень в выпадающем списке на пересечении сотрудника и раздела — изменение применяется сразу.
      </p>
    ),
  },
  {
    title: 'Администраторы',
    body: (
      <p>
        Вкладка «Администраторы» — список учётных записей с полным доступом ко всей системе. Сделать
        администратором можно любого сотрудника из матрицы, снять права — из этой вкладки. Свою
        собственную роль изменить нельзя, и в системе всегда должен остаться хотя бы один активный
        администратор.
      </p>
    ),
  },
  {
    title: 'Новый сотрудник',
    body: (
      <p>
        Кнопка «Новый сотрудник» в правом верхнем углу открывает форму: ФИО, почта, пароль, роль и —
        для роли «Сотрудник» — сразу уровень доступа к каждому разделу.
      </p>
    ),
  },
]

export function AccessMatrixPage() {
  const accounts = useAuthStore((s) => s.accounts)
  const loadAccounts = useAuthStore((s) => s.loadAccounts)
  const updateAccess = useAuthStore((s) => s.updateAccess)
  const addAccount = useAuthStore((s) => s.addAccount)
  const setAccountRole = useAuthStore((s) => s.setAccountRole)
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const [tab, setTab] = useState<'matrix' | 'admins'>('matrix')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const onboarding = useSectionOnboarding('admin')

  useEffect(() => {
    loadAccounts().catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить сотрудников'))
  }, [loadAccounts])

  const workers = accounts.filter((a) => a.role === 'worker')
  const admins = accounts.filter((a) => a.role === 'admin')
  const currentId = useAuthStore((s) => s.current?.id ?? null)

  async function setRole(account: Account, role: Role, confirmText: string) {
    if (!window.confirm(confirmText)) return
    setError(null)
    setNotice(null)
    try {
      await setAccountRole(account.id, role)
      setNotice(
        role === 'admin'
          ? `«${account.full_name}» теперь администратор — полный доступ ко всем разделам.`
          : `С «${account.full_name}» сняты права администратора, доступ к разделам обнулён.`,
      )
      setTab(role === 'admin' ? 'admins' : 'matrix')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить роль')
    }
  }

  function demote(account: Account) {
    void setRole(
      account,
      'worker',
      `Снять права администратора с «${account.full_name}»?\n\n` +
        'Учётная запись станет обычным сотрудником без доступа к разделам — ' +
        'права нужно будет выставить заново в матрице доступа.',
    )
  }

  async function setLevel(accountId: number, section: SectionId, level: AccessLevel) {
    const account = accounts.find((a) => a.id === accountId)
    if (!account) return
    const next = { ...account.module_access, [section]: level }
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
          <h1 className="text-[20px] font-medium text-ink">Доступ</h1>
          <p className="mt-1 text-[13px] text-muted">
            {tab === 'matrix'
              ? '4 уровня доступа на раздел: нет доступа, только просмотр, редактирование, полный доступ. Администраторы видят и могут всё всегда.'
              : 'Администраторы получают полный доступ ко всем разделам системы, включая этот.'}
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

      <div className="mb-5 flex gap-1 border-b border-border">
        {([
          ['matrix', `Матрица доступа (${workers.length})`],
          ['admins', `Администраторы (${admins.length})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === value ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-success-bg p-2.5 text-[13px] text-success">{notice}</p>}

      {tab === 'admins' ? (
        <AdminsTab
          admins={admins}
          currentId={currentId}
          onDemote={demote}
          onResetPassword={handleResetPassword}
        />
      ) : (
      <>
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
                  const level = account.module_access[section.id] ?? 'none'
                  return (
                    <td key={section.id} className="px-3 py-3 text-center">
                      <Select
                        aria-label={`${account.full_name}: ${section.label}`}
                        value={level}
                        onChange={(e) => setLevel(account.id, section.id, e.target.value as AccessLevel)}
                        className="w-full min-w-[9rem]"
                      >
                        {ACCESS_LEVEL_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
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
      </>
      )}

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
  onCreate: (input: {
    email: string
    password: string
    full_name: string
    role: Role
    module_access: Partial<Record<SectionId, AccessLevel>>
  }) => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('worker')
  const [levels, setLevels] = useState<Partial<Record<SectionId, AccessLevel>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('worker')
    setLevels({})
    setError(null)
  }

  async function handleSubmit() {
    if (!fullName || !email || !password) return
    setSaving(true)
    try {
      // Администратору матрица не нужна — он получает полный доступ по роли,
      // и бэк всё равно чистит гранты при назначении админом (0074).
      await onCreate({
        email,
        password,
        full_name: fullName,
        role,
        module_access: role === 'admin' ? {} : levels,
      })
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
        <Field label="Роль" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="worker">Сотрудник</option>
            <option value="admin">Администратор — полный доступ ко всем разделам</option>
          </Select>
        </Field>
        {role === 'admin' ? (
          <p className="rounded-md bg-surface-muted p-2.5 text-[12px] text-muted">
            Администратор видит и может всё в системе, включая раздел «Доступ». Уровни по разделам ему
            не выставляются.
          </p>
        ) : (
        <Field label="Доступ к разделам">
          <div className="flex flex-col gap-2">
            {ASSIGNABLE_SECTIONS.map((section) => (
              <div key={section.id} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink">{section.label}</span>
                <Select
                  aria-label={section.label}
                  value={levels[section.id] ?? 'none'}
                  onChange={(e) =>
                    setLevels((prev) => ({ ...prev, [section.id]: e.target.value as AccessLevel }))
                  }
                  className="w-44"
                >
                  {ACCESS_LEVEL_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </Field>
        )}
        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
