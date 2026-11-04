import type { Account, AccessLevel } from './types'
import type { SectionId } from '@/shared/sections'

/** Navigation only; server ownership and data permissions are a separate boundary. */
export function isSalesManager(account: Account | null): boolean {
  return !!account && account.role !== 'admin' &&
    (account.job_role === 'manager' || account.access_profile === 'sales_manager')
}

export function salesNavigationLevel(account: Account, section: SectionId): AccessLevel {
  const level = section === 'crm' || section === 'clients' ? account.module_access.clients
    : section === 'tasks' ? account.module_access.tasks : 'none'
  return level === 'full' ? 'edit' : level ?? 'none'
}

export function salesHome(account: Account): string {
  return salesNavigationLevel(account, 'crm') !== 'none' ? '/crm'
    : salesNavigationLevel(account, 'tasks') !== 'none' ? '/tasks' : '/crm'
}

export function salesRouteAllowed(pathname: string, search: string): boolean {
  const query = new URLSearchParams(search)
  if (pathname === '/crm') {
    return !query.has('tab') || ['deal', 'contact', 'company', 'task', 'inquiry'].includes(query.get('tab') || '')
  }
  if (pathname === '/tasks') return !query.has('scope') || query.get('scope') === 'mine'
  return false
}
