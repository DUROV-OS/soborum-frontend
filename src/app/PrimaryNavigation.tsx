import { useLayoutEffect } from 'react'
import { rememberPurchaseTab } from '@/purchasing/PurchaseViewState'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { WorkspaceTabs } from '@/shared/ui/WorkspaceTabs'
import { calendarSections, calendarSection } from '@/collaboration/calendarSections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'

export function PrimaryNavigation() {
  const hasAccess = useAuthStore(s => s.hasAccess)
  const userId = useAuthStore(s => s.current?.id)
  const { pathname, search } = useLocation()
  const context = workflowContext(pathname, search, visibleWorkflows(hasAccess))
  const purchasing = context?.group.id === 'purchasing' ? context : undefined
  const purchaseTab = purchasing?.entry.id
  const redirected = pathname === '/purchasing' && !search
  useLayoutEffect(() => {
    if (purchaseTab && !redirected) rememberPurchaseTab(userId, purchaseTab)
  }, [purchaseTab, userId, redirected])

  if (purchasing) return <WorkspaceTabs label="Разделы закупок" entries={purchasing.group.entries} activeId={purchasing.entry.id} />
  if (pathname === '/calendar') return <nav aria-label="Разделы календаря" className="collaboration-tabs calendar-section-tabs">
    {calendarSections.map(([id, label]) => <Link key={id} to={'/calendar?section=' + id} aria-current={calendarSection(search) === id ? 'page' : undefined}>{label}</Link>)}
  </nav>
  if (!context) return null
  if (context.group.standalone) return context.group.entries.length > 1
    ? <WorkspaceTabs label={'Раздел «' + context.group.label + '»'} entries={context.group.entries} activeId={context.entry.id} />
    : null
  return <nav aria-label={'Раздел ' + context.group.label} className="collaboration-tabs">
    {context.group.entries.map(entry => <Link key={entry.id} to={entry.to} aria-current={entry.id === context.entry.id ? 'page' : undefined}>{entry.label}</Link>)}
  </nav>
}
