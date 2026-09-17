import { create } from 'zustand'
import { getToken, setToken } from '@/shared/lib/httpClient'
import { SectionId } from '@/shared/sections'
import * as authApi from './api'
import { Account, AccessLevel } from './types'

interface AuthState {
  current: Account | null
  accounts: Account[]
  booting: boolean
  error: string | null
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  loadAccounts: () => Promise<void>
  hasAccess: (section: SectionId) => boolean
  accessLevel: (section: SectionId) => AccessLevel
  updateAccess: (id: number, moduleAccess: Partial<Record<SectionId, AccessLevel>>) => Promise<void>
  addAccount: (input: Omit<authApi.CreateAccountInput, 'email'> & { email: string }) => Promise<void>
  resetPassword: (id: number) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  current: null,
  accounts: [],
  booting: true,
  error: null,

  bootstrap: async () => {
    if (!getToken()) {
      set({ booting: false })
      return
    }
    try {
      const current = await authApi.me()
      set({ current, booting: false })
      if (current.role === 'admin') get().loadAccounts().catch(() => {})
    } catch {
      setToken(null)
      set({ current: null, booting: false })
    }
  },

  login: async (email, password) => {
    set({ error: null })
    try {
      const current = await authApi.login(email, password)
      set({ current })
      if (current.role === 'admin') get().loadAccounts().catch(() => {})
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Не удалось войти' })
      return false
    }
  },

  logout: () => {
    setToken(null)
    set({ current: null, accounts: [] })
  },

  /** GET /auth/users требует роль admin — в bootstrap/login вызывается только для админа, у рабочих список остаётся пустым. */
  loadAccounts: async () => {
    const accounts = await authApi.listAccounts()
    set({ accounts })
  },

  accessLevel: (section) => {
    const account = get().current
    if (!account) return 'none'
    if (account.role === 'admin') return 'full'
    // «Сегодня» доступен каждому вошедшему сотруднику; сервер отдаёт только
    // показатели разрешённых ему разделов и не требует AI-доступа. «Агенты» и
    // «Все чаты» (данные MAX общие для организации) — так же для всех.
    if (section === 'today' || section === 'agents' || section === 'chats') return 'full'
    // «Совещания» — часть доступа к «Марине», отдельного гранта нет.
    if (section === 'meetings') return account.module_access.ai ?? 'none'
    return account.module_access[section] ?? 'none'
  },

  hasAccess: (section) => get().accessLevel(section) !== 'none',

  updateAccess: async (id, moduleAccess) => {
    const updated = await authApi.updateAccountAccess(id, moduleAccess)
    set((state) => ({ accounts: state.accounts.map((a) => (a.id === id ? updated : a)) }))
  },

  addAccount: async (input) => {
    const created = await authApi.createAccount(input)
    set((state) => ({ accounts: [...state.accounts, created] }))
  },

  resetPassword: async (id) => {
    const updated = await authApi.resetAccountPassword(id)
    set((state) => ({ accounts: state.accounts.map((a) => (a.id === id ? updated : a)) }))
  },

  changePassword: async (currentPassword, newPassword) => {
    const updated = await authApi.changePassword(currentPassword, newPassword)
    set({ current: updated })
  },
}))
