import type { Account, AccessLevel } from './types'
import type { SectionId } from '@/shared/sections'

/** Navigation only; server ownership and data permissions are a separate boundary. */
export function isSalesManager(account: Account | null): boolean {
  return !!account && account.role !== 'admin' &&
    (account.job_role === 'manager' || account.access_profile === 'sales_manager')
}

export function salesNavigationLevel(account: Account, section: SectionId): AccessLevel {
  if (['today', 'work', 'chats', 'notifications', 'feedback_my'].includes(section)) return 'full'
  const level = section === 'crm' || section === 'clients' || section === 'partners' ? account.module_access.clients
    : section === 'tasks' ? account.module_access.tasks : 'none'
  return level ?? 'none'
}

export function salesHome(_account: Account): string {
  return '/today'
}

export function salesRouteAllowed(pathname: string, search: string): boolean {
  const query = new URLSearchParams(search)
  if (pathname === '/crm') {
    return !query.has('tab') || ['deal', 'contact', 'company', 'task', 'inquiry', 'pipeline', 'stage'].includes(query.get('tab') || '')
  }
  if (pathname === '/tasks') return !query.has('scope') || query.get('scope') === 'mine'
  if (['/today', '/work', '/sales', '/team', '/notifications', '/feedback', '/feedback/my'].includes(pathname)) return true
  if (/^\/chats(?:\/-?\d+)?$/.test(pathname)) return true
  if (/^\/partners(?:\/\d+)?$/.test(pathname)) return true
  return false
}
