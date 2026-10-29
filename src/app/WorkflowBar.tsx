import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'

export function WorkflowBar() {
  const hasAccess = useAuthStore((s) => s.hasAccess),
    location = useLocation()
  const context = workflowContext(location.pathname, location.search, visibleWorkflows(hasAccess))
  if (!context) return null
  return (
    <nav aria-label={'Раздел ' + context.group.label} className="mb-5 min-w-0 border-b border-border pb-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link to="/work" aria-label="Все разделы работы" className="hover:text-ink">
          Работа
        </Link>
        <span>›</span>
        <span className="font-medium text-ink">{context.group.label}</span>
        <span className="hidden lg:inline">· {context.group.note}</span>
      </div>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
        {context.group.entries.map((e) => (
          <Link
            key={e.id}
            to={e.to}
            aria-current={context.entry.id === e.id ? 'page' : undefined}
            className={
              'shrink-0 rounded-pill px-3 py-2 text-sm ' +
              (context.entry.id === e.id ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-ink')
            }
          >
            {e.label}
            {e.readOnly && <span className="ml-1.5 text-[10px] opacity-75">Просмотр</span>}
          </Link>
        ))}
      </div>
    </nav>
  )
}
