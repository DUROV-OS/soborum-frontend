import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

const Context = createContext<Map<string, unknown> | null>(null)

export function WorkspaceViewProvider({ children }: { children: ReactNode }) {
  const [views] = useState(() => new Map<string, unknown>())
  return <Context.Provider value={views}>{children}</Context.Provider>
}

export function useWorkspaceViews() {
  return useContext(Context)
}

/** Keep view preferences in memory for the current account and browser session. */
export function useWorkspaceViewState<T>(key: string | null, initial: T | (() => T)) {
  const views = useWorkspaceViews()
  const [value, setValue] = useState<T>(() => {
    if (key && views?.has(key)) return views.get(key) as T
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  useLayoutEffect(() => {
    if (key) views?.set(key, value)
  }, [key, value, views])
  return [value, setValue] as const
}
