import { WorkspaceViewProvider } from '@/shared/lib/workspaceViewState'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NotificationToasts } from '@/notifications/components/NotificationToasts'
import { useNotificationPolling } from '@/notifications/hooks/useNotificationPolling'
import { MeetingPanel } from '@/meeting/components/MeetingPanel'
import { logClientEvent } from '@/shared/lib/clientLog'
import { RouteBoundary } from './RouteBoundary'
import { useMobileNavigation } from './useMobileNavigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuthStore } from '@/auth/store'
import { isSalesManager } from '@/auth/salesNavigation'
import { BrowserPhoneProvider } from '@/crm/BrowserPhone'
import { WebsiteInquiryUpdates } from '@/crm/WebsiteInquiryUpdates'
import { CalendarReminders } from '@/collaboration/CalendarReminders'
import { SectionNavigationHost, SectionNavigationProvider } from './SectionNavigation'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const userId = useAuthStore(state => state.current?.id)
  const location = useLocation()
  const mobile = useMobileNavigation()
  const contentRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.inert = mobile && sidebarOpen
    if (!mobile) setSidebarOpen(false)
  }, [mobile, sidebarOpen])

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }) }, [location.pathname])
  const salesManager = useAuthStore((s) => isSalesManager(s.current))
  const canViewCrm = useAuthStore(state => state.hasAccess('crm'))
  useNotificationPolling(!salesManager)

  useEffect(() => {
    setSidebarOpen(false)
    // Переходы по экранам — в клиентский лог сессии (0075-b).
    logClientEvent('nav', location.pathname + location.search)
  }, [location.pathname, location.search])

  return (
    <WebsiteInquiryUpdates key={userId} enabled={canViewCrm && (salesManager || location.pathname === "/crm")}
      soundUserId={canViewCrm && salesManager ? userId : undefined}>
    <BrowserPhoneProvider><WorkspaceViewProvider key={userId}><SectionNavigationProvider><div className="workspace-shell flex h-dvh w-full">
      <Sidebar open={sidebarOpen} desktopCollapsed={desktopCollapsed} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <div ref={contentRef} className="flex min-w-0 flex-1 flex-col">
        <Topbar menuOpen={sidebarOpen} onMenuClick={() => setSidebarOpen(true)}
          desktopCollapsed={desktopCollapsed} toggleDesktopMenu={() => setDesktopCollapsed(value => !value)} />
        <SectionNavigationHost />
        <main ref={mainRef} id="main-content" className="workspace-content mobile-safe-content flex-1 overflow-y-auto">
          <CalendarReminders />
          <div className={`workspace-page${location.pathname === "/crm" ? " workspace-page--crm" : ""}`}><RouteBoundary><Outlet /></RouteBoundary></div>
        </main>
      </div>
      {!salesManager && <MeetingPanel />}
      {!salesManager && <NotificationToasts />}
    </div></SectionNavigationProvider></WorkspaceViewProvider></BrowserPhoneProvider>
    </WebsiteInquiryUpdates>
  )
}
