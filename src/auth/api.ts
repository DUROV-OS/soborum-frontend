import { apiRequest, login as loginRequest, setToken } from '@/shared/lib/httpClient'
import { SectionId } from '@/shared/sections'
import { Account } from './types'

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
  module_access: SectionId[]
}

/** POST /api/auth/users */
export function createAccount(input: CreateAccountInput): Promise<Account> {
  return apiRequest<Account>({
    section: SECTION,
    path: '/users',
    method: 'POST',
    body: { ...input, role: 'worker' },
  })
}

/** PUT /api/auth/users/:id/access */
export function updateAccountAccess(id: number, module_access: SectionId[]): Promise<Account> {
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
