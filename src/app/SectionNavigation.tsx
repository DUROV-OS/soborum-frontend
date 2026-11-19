import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PrimaryNavigation } from './PrimaryNavigation'

type NavigationContext = { target: HTMLDivElement | null; setTarget: (node: HTMLDivElement | null) => void; custom: boolean; setCustom: (custom: boolean) => void }
const Context = createContext<NavigationContext | null>(null)

export function SectionNavigationProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const [custom, setCustom] = useState(false)
  const value = useMemo(() => ({ target, setTarget, custom, setCustom }), [target, custom])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function SectionNavigationHost() {
  const context = useContext(Context)!
  return <div data-section-navigation className="min-w-0 shrink-0 px-4 pt-2 sm:px-6">
    <div ref={context.setTarget} />
    {!context.custom && <PrimaryNavigation />}
  </div>
}

/** Relocate the existing controls, retaining their page state and permissions. */
export function ModuleNavigation({ children, label }: { children: ReactNode; label: string }) {
  const context = useContext(Context)
  const target = context?.target, setCustom = context?.setCustom
  useLayoutEffect(() => {
    if (!target || !setCustom) return
    setCustom(true)
    return () => setCustom(false)
  }, [target, setCustom])
  const content = <nav aria-label={label} className="rounded-xl border border-border bg-surface px-2">{children}</nav>
  return target ? createPortal(content, target) : content
}
