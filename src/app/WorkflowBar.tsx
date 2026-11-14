import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { isSalesManager } from '@/auth/salesNavigation'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'

export function WorkflowBar() {
  const navigate = useNavigate()
  const hasAccess = useAuthStore((s) => s.hasAccess),
    location = useLocation()
  const salesManager = useAuthStore((s) => isSalesManager(s.current))
  const context = workflowContext(location.pathname, location.search, visibleWorkflows(hasAccess))
  // Costing has its own role-aware navigation and mobile section selector.
  if (salesManager || !context || ['/costing', '/accounting'].includes(location.pathname)) return null
  return (
    <nav aria-label={'Раздел ' + context.group.label} className="workspace-workflow mb-4 flex min-w-0 items-center justify-between gap-3 text-[13px] text-muted">
      <div className="flex min-w-0 items-center gap-2">
        <Link to="/work" aria-label="Все разделы работы" className="hover:text-ink">
          Работа
        </Link>
        <span>›</span>
        <span className="font-medium text-ink">{context.group.label}</span>
        <span className="hidden truncate sm:inline">› {context.entry.label}</span>
      </div>
      <select aria-label={'Перейти в раздел ' + context.group.label} value={context.entry.to} onChange={event => navigate(event.target.value)} className="min-h-10 min-w-0 max-w-[55%] truncate rounded-lg border border-border bg-surface px-3 text-[13px] text-ink sm:max-w-[240px]">
        {context.group.entries.map(entry => <option key={entry.id} value={entry.to}>{entry.label}{entry.readOnly ? ' · архив' : ''}</option>)}
      </select>
    </nav>
  )
}
