import { useState } from 'react'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'
import { ChangePasswordModal } from './ChangePasswordModal'

const JOB_LABELS = { director: 'Руководитель', manager: 'Менеджер', accountant: 'Бухгалтер', storekeeper: 'Специалист по складу и снабжению', production_manager: 'Начальник производства' } as const

export function RoleSwitcher() {
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const navigate = useNavigate()
  const current = useAuthStore((s) => s.current)
  const logout = useAuthStore((s) => s.logout)

  if (!current) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Меню учётной записи"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-border px-2 py-1.5 text-left hover:bg-surface-muted sm:px-3"
        title={current.full_name}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center text-sm font-medium sm:hidden">{current.full_name.slice(0, 1)}</span>
        <span className="hidden min-w-0 max-w-56 sm:block">
          <span className="block truncate text-[13px] font-medium leading-tight text-ink">
            {current.full_name}
          </span>
          <span className="block text-[11px] leading-tight text-muted">
            {current.job_role ? JOB_LABELS[current.job_role] : current.role === 'admin' ? 'Администратор' : 'Сотрудник'}
          </span>
        </span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-border bg-surface p-1.5 shadow-xl">
            <div className="px-2.5 py-1.5 text-[11px] text-muted">{current.email}</div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                setChangingPassword(true)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] text-ink hover:bg-surface-muted"
            >
              <KeyRound size={14} />
              Изменить пароль
            </button>
            <button
              type="button"
              onClick={() => {
                logout()
                setOpen(false)
                navigate('/login', { replace: true })
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] text-danger hover:bg-danger-bg"
            >
              <LogOut size={14} />
              Выйти
            </button>
          </div>
        </>
      )}

      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  )
}
