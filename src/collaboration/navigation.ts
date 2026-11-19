import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { useWorkspaceViews, useWorkspaceViewState } from '@/shared/lib/workspaceViewState'
import { calendarSection } from './calendarSections'
import { useCollaborationTools } from './useCollaborationTools'

const overview = { id: 'overview', to: '/collaboration', label: 'Обзор' }
const routeKey = (id: string) => 'collaboration:route:' + id

export function useCollaborationView<T>(tool: string, field: string, initial: T | (() => T)) {
  return useWorkspaceViewState('collaboration:' + tool + ':' + field, initial)
}

export function useCollaborationNavigation() {
  const userId = useAuthStore(state => state.current?.id)
  const views = useWorkspaceViews()
  const { pathname, search } = useLocation()
  const tools = useCollaborationTools()
  const entries = [overview, ...tools.flatMap(tool => tool.to ? [{ id: tool.id, to: tool.to, label: tool.label }] : [])]
  const active = entries.find(entry => pathname === entry.to ||
    (entry.id !== 'overview' && pathname.startsWith(entry.to + '/')))
  const key = 'durov.collaboration.last-tab.' + userId

  const destination = (entry: typeof overview) => {
    // Clicking the selected tab keeps its current URL, including a deep link.
    if (entry.id === active?.id) return pathname + search
    const saved = views?.get(routeKey(entry.id))
    return typeof saved === 'string' ? saved : entry.to
  }

  function resume() {
    let id: string | null = null
    try { if (userId != null) id = localStorage.getItem(key) } catch { /* Open the overview. */ }
    return destination(active ?? entries.find(entry => entry.id === id) ?? overview)
  }

  return { entries: entries.map(entry => ({ ...entry, to: destination(entry) })), active, resume }
}

export function useRememberCollaborationTab(id: string | undefined) {
  const userId = useAuthStore(state => state.current?.id)
  const views = useWorkspaceViews()
  const { pathname, search } = useLocation()
  const key = 'durov.collaboration.last-tab.' + userId
  useLayoutEffect(() => {
    if (!id || userId == null) return
    try { localStorage.setItem(key, id) } catch { /* The current tab is still active. */ }
    if (id === 'calendar') {
      const section = calendarSection(search)
      views?.set(routeKey(id), '/calendar?section=' + section)
    } else if (id === 'messenger' || id === 'gpt' || id === 'meetings') {
      views?.set(routeKey(id), pathname)
    }
  }, [id, key, pathname, search, userId, views])
}
