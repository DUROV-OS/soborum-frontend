import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { RoleSwitcher } from '@/auth/pages/RoleSwitcher'
import { FeedbackButton } from '@/feedback/components/FeedbackButton'
import { MeetingButton } from '@/meeting/components/MeetingButton'
import { PushNotificationsButton } from '@/notifications/components/PushNotificationsButton'
import { SECTIONS } from '@/shared/sections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'
import { useAuthStore } from '@/auth/store'
import { isSalesManager } from '@/auth/salesNavigation'
import { useCollaborationTools } from '@/collaboration/useCollaborationTools'

export function Topbar({ onMenuClick, menuOpen, desktopCollapsed, toggleDesktopMenu }: {
  onMenuClick: () => void; menuOpen: boolean; desktopCollapsed: boolean; toggleDesktopMenu: () => void
}) {
  const location = useLocation()
  const DesktopMenuIcon = desktopCollapsed ? PanelLeftOpen : PanelLeftClose
  const section = SECTIONS.find((s) => location.pathname.startsWith(s.path))
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const salesManager = useAuthStore((s) => isSalesManager(s.current))
  const context = workflowContext(location.pathname, location.search, visibleWorkflows(hasAccess, salesManager))
  const workTitle = context && (context.group.standalone ? context.group.label : context.group.label + ' · ' + context.entry.label)
  const collaborationTool = useCollaborationTools().find(tool => tool.to && (location.pathname === tool.to || location.pathname.startsWith(tool.to + '/')))

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
        <button type="button" onClick={toggleDesktopMenu}
          aria-label={desktopCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}
          aria-controls="main-navigation" aria-expanded={!desktopCollapsed}
          className="-ml-1 hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-inherit hover:bg-white/10 lg:flex">
          <DesktopMenuIcon size={19} />
        </button>
        <span className="truncate text-[13px] font-medium text-muted">
          {collaborationTool ? 'Совместная работа · ' + collaborationTool.label : workTitle ?? section?.label ?? 'Durov OS'}
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
