import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { RoleSwitcher } from '@/auth/pages/RoleSwitcher'
import { FeedbackButton } from '@/feedback/components/FeedbackButton'
import { MeetingButton } from '@/meeting/components/MeetingButton'
import { PushNotificationsButton } from '@/notifications/components/PushNotificationsButton'
import { SECTIONS } from '@/shared/sections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'
import { useAuthStore } from '@/auth/store'
import { isSalesManager } from '@/auth/salesNavigation'

export function Topbar({ onMenuClick, menuOpen }: { onMenuClick: () => void; menuOpen: boolean }) {
  const location = useLocation()
  const section = SECTIONS.find((s) => location.pathname.startsWith(s.path))
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const salesManager = useAuthStore((s) => isSalesManager(s.current))
  const context = workflowContext(location.pathname, location.search, visibleWorkflows(hasAccess))

  return (
    <header className="workspace-topbar mobile-safe-topbar flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Открыть меню"
          aria-controls="main-navigation"
          aria-expanded={menuOpen}
          className="-ml-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-ink hover:bg-surface-muted lg:hidden"
        >
          <Menu size={20} />
        </button>
        <span className="truncate text-[13px] font-medium text-muted">
          {context ? context.group.label + ' · ' + context.entry.label : (section?.label ?? 'Durov OS')}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {!salesManager && <MeetingButton />}
        {!salesManager && <PushNotificationsButton />}
        {!salesManager && <FeedbackButton />}
        <RoleSwitcher />
      </div>
    </header>
  )
}
