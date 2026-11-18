import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { isCollaborationRoute, visibleCollaborationTools } from '@/collaboration/catalog'

const links = [
  ['/work', 'Разделы'], ['/today', 'Пульс'], ['/collaboration', 'Совместная работа'],
  ['/calendar', 'Календарь'], ['/marketing', 'Маркетинг'],
] as const

export function PrimaryNavigation() {
  const hasAccess = useAuthStore(s => s.hasAccess)
  const { pathname } = useLocation()
  const collaborationActive = pathname !== '/calendar' && isCollaborationRoute(pathname, visibleCollaborationTools(hasAccess))
  return <nav aria-label="Основные разделы" className="collaboration-tabs shrink-0 px-4 pt-2 sm:px-6">
    {links.filter(([to]) => to !== '/marketing' || hasAccess('marketing')).map(([to, label]) =>
      <Link key={to} to={to} aria-current={(to === '/collaboration' ? collaborationActive : pathname === to || pathname.startsWith(to + '/')) ? 'page' : undefined}>{label}</Link>)}
  </nav>
}
