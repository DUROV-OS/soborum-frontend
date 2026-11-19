import { useLayoutEffect } from 'react'
import { rememberPurchaseTab } from '@/purchasing/PurchaseViewState'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { useCollaborationTools } from '@/collaboration/useCollaborationTools'
import { calendarSections, calendarSection } from '@/collaboration/calendarSections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'

export function PrimaryNavigation() {
  const hasAccess = useAuthStore(s => s.hasAccess)
  const userId = useAuthStore(s => s.current?.id)
  const { pathname, search } = useLocation()
  const tools = useCollaborationTools().filter(tool => tool.to)
  const context = workflowContext(pathname, search, visibleWorkflows(hasAccess))
  const purchasing = context?.group.id === 'purchasing' ? context : undefined
  const purchaseTab = purchasing?.entry.id
  const redirected = pathname === '/purchasing' && !search
  useLayoutEffect(() => {
    if (purchaseTab && !redirected) rememberPurchaseTab(userId, purchaseTab)
  }, [purchaseTab, userId, redirected])

  if (purchasing) return <nav aria-label="Разделы закупок"
    className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface px-2">
    {purchasing.group.entries.map(entry => {
      const active = entry.id === purchaseTab
      return <Link key={entry.id} to={entry.to} aria-current={active ? 'page' : undefined}
        ref={element => { if (element && active) element.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }}
        className={'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm ' +
          (active ? 'border-brand bg-brand/5 font-semibold text-brand-dark' : 'border-transparent text-ink hover:bg-surface-muted')}>
        {entry.label}
      </Link>
    })}
  </nav>
  if (pathname === '/calendar') return <nav aria-label="Разделы календаря" className="collaboration-tabs calendar-section-tabs">
    {calendarSections.map(([id, label]) => <Link key={id} to={'/calendar?section=' + id} aria-current={calendarSection(search) === id ? 'page' : undefined}>{label}</Link>)}
  </nav>
  if (pathname === '/collaboration') return <nav aria-label="Инструменты совместной работы" className="collaboration-tabs">
    {tools.map(tool => <Link key={tool.id} to={tool.to!}>{tool.label}</Link>)}
  </nav>
  if (!context) return null
  return <nav aria-label={'Раздел ' + context.group.label} className="collaboration-tabs">
    {context.group.entries.map(entry => <Link key={entry.id} to={entry.to} aria-current={entry.id === context.entry.id ? 'page' : undefined}>{entry.label}</Link>)}
  </nav>
}
