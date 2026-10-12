import { Bell, BellOff, BellRing } from 'lucide-react'
import { useBrowserPush } from '@/shared/hooks/useBrowserPush'

/**
 * Явный повторный запрос разрешения на push из шапки (0080-e) — на случай,
 * если сотрудник отказал при входе. Полноценная страница «Настройки
 * уведомлений» (0080-d) ведётся в соседней ветке и объединит эту кнопку
 * у себя при мерже; до тех пор это самостоятельный доступ к той же функции.
 */
export function PushNotificationsButton() {
  const { status, error, permission, enable } = useBrowserPush()

  if (permission === 'unsupported') return null

  const label =
    status === 'granted' ? 'Уведомления включены' : status === 'requesting' ? 'Запрашиваем…' : 'Включить уведомления'

  const Icon = status === 'granted' ? BellRing : status === 'denied' ? BellOff : Bell

  return (
    <button
      type="button"
      onClick={() => void enable()}
      disabled={status === 'granted' || status === 'requesting'}
      aria-label={label}
      title={error ?? label}
      className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-brand/40 disabled:cursor-default disabled:opacity-60"
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
