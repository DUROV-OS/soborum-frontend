import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import { Account } from '../types'

/**
 * Вкладка «Администраторы» раздела «Доступ» (0074). Матрица уровней здесь не
 * нужна — админ по роли получает полный доступ ко всем разделам
 * (`User.access_levels` на бэке), поэтому показываем сам список и два
 * действия: снять права и сбросить пароль.
 */
export function AdminsTab({
  admins,
  currentId,
  onDemote,
  onResetPassword,
}: {
  admins: Account[]
  currentId: number | null
  onDemote: (account: Account) => void
  onResetPassword: (account: { id: number; full_name: string }) => void
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            <th className="px-4 py-2.5 font-medium text-muted">Администратор</th>
            <th className="px-3 py-2.5 font-medium text-muted">Добавлен</th>
            <th className="px-3 py-2.5 font-medium text-muted">Состояние</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted">Действия</th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-[13px] text-muted">
                Администраторов нет.
              </td>
            </tr>
          )}
          {admins.map((account) => (
            <tr key={account.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="shrink-0 text-brand" />
                  <div>
                    <div className="font-medium text-ink">
                      {account.full_name}
                      {account.id === currentId && <span className="ml-2 text-[12px] text-muted">— это вы</span>}
                    </div>
                    <div className="text-[12px] text-muted">{account.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-muted">
                {new Date(account.created_at).toLocaleDateString('ru-RU')}
              </td>
              <td className="px-3 py-3">
                {account.is_active ? (
                  <span className="text-success">Активен</span>
                ) : (
                  <span className="text-muted">Отключён</span>
                )}
              </td>
              <td className="px-3 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onResetPassword(account)}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[12px] text-ink hover:border-brand/40"
                  >
                    <KeyRound size={13} />
                    Сбросить пароль
                  </button>
                  <button
                    type="button"
                    onClick={() => onDemote(account)}
                    disabled={account.id === currentId}
                    title={account.id === currentId ? 'Нельзя изменить собственную роль' : undefined}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-[12px] text-ink hover:border-danger/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShieldOff size={13} />
                    Снять права администратора
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
