import { Lightbulb } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SECTIONS } from '@/shared/sections'

/**
 * Кнопка «Пожелания» в Topbar — слева от переключателя аккаунта (0075-b).
 * Видна любому вошедшему: писать о проблемах системы может каждый сотрудник.
 * Раздел текущего экрана передаётся на страницу заявки как подсказка.
 */
export function FeedbackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = SECTIONS.find((s) => location.pathname.startsWith(s.path))

  return (
    <button
      type="button"
      onClick={() => navigate('/feedback', { state: { section: section?.id } })}
      aria-label="Пожелания и предложения"
      className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-brand/40"
    >
      <Lightbulb size={14} />
      <span className="hidden sm:inline">Пожелания</span>
    </button>
  )
}
