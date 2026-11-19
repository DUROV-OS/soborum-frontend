import { useWorkspaceViewState } from '@/shared/lib/workspaceViewState'

export type PurchaseTab = 'suppliers' | 'supplier-orders' | 'supplier-invoices' | 'receipts' | 'supplier-returns' | 'supplier-factures'

export function usePurchaseViewState<T>(tab: PurchaseTab | null, field: string, initial: T) {
  return useWorkspaceViewState(tab ? 'purchasing:' + tab + ':' + field : null, initial)
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
