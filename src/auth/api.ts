import { apiRequest, login as loginRequest, setToken } from '@/shared/lib/httpClient'
import { SectionId } from '@/shared/sections'
import { Account, AccessLevel, Role } from './types'

const SECTION = 'auth'

/** POST /api/auth/login + GET /api/auth/me */
export async function login(email: string, password: string): Promise<Account> {
  const token = await loginRequest(email, password)
  setToken(token)
  return apiRequest<Account>({ section: SECTION, path: '/me', timeoutMs: 8000 })
}

/** GET /api/auth/me */
export function me(): Promise<Account> {
  return apiRequest<Account>({ section: SECTION, path: '/me', timeoutMs: 8000 })
}

/** GET /api/auth/users */
export function listAccounts(): Promise<Account[]> {
  return apiRequest<Account[]>({ section: SECTION, path: '/users' })
}

export interface CreateAccountInput {
  email: string
  password: string
  full_name: string
  /** Роль создаваемой учётной записи (0074). Администратору гранты не нужны — он
   * и так видит всё, поэтому форма в этом случае шлёт пустую матрицу. */
  role: Role
  module_access: Partial<Record<SectionId, AccessLevel>>
}

/** POST /api/auth/users */
export function createAccount(input: CreateAccountInput): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: '/users',
    method: 'POST',
    body: input,
  })
}

/** PATCH /api/auth/users/:id — смена роли (0074).
 * Бэк отклоняет смену собственной роли и снятие прав с последнего админа. */
export function updateAccountRole(id: number, role: Role): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: `/users/${id}`,
    method: 'PATCH',
    body: { role },
  })
}

/** PUT /api/auth/users/:id/access */
export function updateAccountAccess(id: number, module_access: Partial<Record<SectionId, AccessLevel>>): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: `/users/${id}/access`,
    method: 'PUT',
    body: { module_access },
  })
}

/** POST /api/auth/users/:id/reset-password */
export function resetAccountPassword(id: number): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: `/users/${id}/reset-password`,
    method: 'POST',
  })
}

/** POST /api/auth/me/password */
export function changePassword(currentPassword: string, newPassword: string): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: '/me/password',
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  })
}
