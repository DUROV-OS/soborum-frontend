import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

export type PurchaseTab = 'suppliers' | 'supplier-orders' | 'supplier-invoices' | 'receipts' | 'supplier-returns' | 'supplier-factures'

const Context = createContext<Map<string, unknown> | null>(null)

export function PurchaseViewProvider({ children }: { children: ReactNode }) {
  const [views] = useState(() => new Map<string, unknown>())
  return <Context.Provider value={views}>{children}</Context.Provider>
}

/** Retain list controls without caching returned records or keeping dialogs open. */
export function usePurchaseViewState<T>(tab: PurchaseTab | null, field: string, initial: T) {
  const views = useContext(Context)
  const key = tab && tab + ':' + field
  const [value, setValue] = useState<T>(() => key && views?.has(key) ? views.get(key) as T : initial)
  useLayoutEffect(() => {
    if (key) views?.set(key, value)
  }, [key, value, views])
  return [value, setValue] as const
}

export function usePurchaseSelection(tab: PurchaseTab | null) {
  const [keys, setKeys] = usePurchaseViewState<string[]>(tab, 'selected-rows', [])
  return {
    keys,
    toggle: (key: string) => setKeys(previous => previous.includes(key)
      ? previous.filter(item => item !== key)
      : [...previous, key]),
  }
}

function storageKey(userId: number) {
  return 'durov.purchasing.last-tab.' + userId
}

export function rememberPurchaseTab(userId: number | undefined, id: string) {
  if (userId == null) return
  try { localStorage.setItem(storageKey(userId), id) } catch { /* Storage can be unavailable. */ }
}

export function lastPurchaseEntry<T extends { id: string; to: string }>(entries: T[], userId?: number) {
  let id = null
  try { if (userId != null) id = localStorage.getItem(storageKey(userId)) } catch { /* Open the first permitted tab. */ }
  return entries.find(entry => entry.id === id) ?? entries[0]
}
