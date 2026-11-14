import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, UsersRound } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { isCollaborationRoute, visibleCollaborationTools } from './catalog'
import { ToolIcon } from './ToolIcon'

export function CollaborationMenu({ onNavigate }: { onNavigate: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLLIElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const { pathname, search } = useLocation()
  const current = useAuthStore(s => s.current), hasAccess = useAuthStore(s => s.hasAccess)
  const tools = visibleCollaborationTools(hasAccess)
  const active = isCollaborationRoute(pathname, tools)
  // Keep the section expanded while the right-hand tool changes.
  useEffect(() => { if (active) setOpen(true) }, [pathname, search, active])
  useEffect(() => { setOpen(active) }, [current?.id])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!active && !root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && root.current?.contains(document.activeElement)) {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open, active])
  function navigate() { setOpen(true); onNavigate() }
  return <li ref={root} className={`collaboration-menu${open ? ' is-open' : ''}`}>
    <button ref={trigger} type="button" className={`collaboration-trigger${active ? ' is-active' : ''}`} aria-expanded={open} aria-controls="collaboration-menu-items" onClick={() => setOpen(value => !value)}>
      <UsersRound size={20} strokeWidth={1.6} aria-hidden="true"/><span className="min-w-0 flex-1">Совместная работа</span><ChevronDown size={14} className={open ? 'rotate-180' : ''} aria-hidden="true"/>
    </button>
    {open && <ul id="collaboration-menu-items" aria-label="Инструменты совместной работы" className="collaboration-submenu">
      {tools.map((tool, index) => <li key={tool.id} className={index > 0 && tool.id === 'tasks' ? 'collaboration-menu-divider' : undefined}>
        {tool.to ? <Link to={tool.to} onClick={navigate} aria-current={pathname === tool.to || pathname.startsWith(tool.to + '/') ? 'page' : undefined}>
          <ToolIcon id={tool.id}/><span>{tool.label}</span>{tool.id === 'messenger' && <small>MAX</small>}
        </Link> : <span className="collaboration-planned" aria-disabled="true" title={tool.description}><ToolIcon id={tool.id}/><span>{tool.label}</span><small>Скоро</small></span>}
      </li>)}
      <li className="collaboration-menu-divider"><Link to="/collaboration" onClick={navigate} aria-current={pathname === '/collaboration' ? 'page' : undefined} className="collaboration-overview">Обзор рабочего пространства</Link></li>
    </ul>}
  </li>
}
