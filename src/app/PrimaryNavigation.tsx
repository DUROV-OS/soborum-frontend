import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { useCollaborationTools } from '@/collaboration/useCollaborationTools'
import { calendarSections, calendarSection } from '@/collaboration/calendarSections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'

export function PrimaryNavigation() {
  const hasAccess = useAuthStore(s => s.hasAccess)
  const { pathname, search } = useLocation()
  const tools = useCollaborationTools().filter(tool => tool.to)
  if (pathname === '/calendar') return <nav aria-label="Разделы календаря" className="collaboration-tabs calendar-section-tabs">
    {calendarSections.map(([id, label]) => <Link key={id} to={'/calendar?section=' + id} aria-current={calendarSection(search) === id ? 'page' : undefined}>{label}</Link>)}
  </nav>
  if (pathname === '/collaboration') return <nav aria-label="Инструменты совместной работы" className="collaboration-tabs">
    {tools.map(tool => <Link key={tool.id} to={tool.to!}>{tool.label}</Link>)}
  </nav>
  const context = workflowContext(pathname, search, visibleWorkflows(hasAccess))
  if (!context) return null
  return <nav aria-label={'Раздел ' + context.group.label} className="collaboration-tabs">
    {context.group.entries.map(entry => <Link key={entry.id} to={entry.to} aria-current={entry.id === context.entry.id ? 'page' : undefined}>{entry.label}</Link>)}
  </nav>
}
