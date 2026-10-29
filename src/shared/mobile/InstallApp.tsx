import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { registerServiceWorker } from '@/shared/lib/pushNotifications'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const InstallContext = createContext<{
  installed: boolean
  prompt: InstallPrompt | null
  clearPrompt: () => void
}>({ installed: false, prompt: null, clearPrompt: () => {} })

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false)
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const available = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const completed = () => { setInstalled(true); setPrompt(null) }
    update()
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', completed)
    display.addEventListener('change', update)
    // Register without requesting push permission. This worker never caches API data.
    if ('serviceWorker' in navigator && window.isSecureContext) {
      void registerServiceWorker().catch(() => {})
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', available)
      window.removeEventListener('appinstalled', completed)
      display.removeEventListener('change', update)
    }
  }, [])

  return <InstallContext.Provider value={{ installed, prompt, clearPrompt: () => setPrompt(null) }}>{children}</InstallContext.Provider>
}

export function InstallAppButton({ dark = false }: { dark?: boolean }) {
  const { installed, prompt, clearPrompt } = useContext(InstallContext)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (installed) return null

  async function install() {
    if (!prompt) { setExpanded((value) => !value); return }
    setBusy(true)
    setFailed(false)
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch {
      setFailed(true)
      setExpanded(true)
    } finally {
      // Browser install prompts can only be used once, including after dismissal.
      clearPrompt()
      setBusy(false)
    }
  }

  return (
    <div className={dark ? 'text-white/85' : 'text-ink'}>
      <button type="button" onClick={() => void install()} disabled={busy}
        aria-expanded={expanded}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium disabled:opacity-60 ${dark ? 'border-white/20 hover:bg-white/10' : 'border-border bg-surface hover:bg-surface-muted'}`}>
        {prompt ? <Download size={17} /> : <Smartphone size={17} />}
        {busy ? 'Открываем установку…' : 'Установить приложение'}
      </button>
      {expanded && (
        <div role="region" aria-label="Установка Durov OS" className="mt-3 text-[13px] leading-relaxed">
          {failed && <p role="status" className="mb-2">Окно установки недоступно. Можно воспользоваться меню браузера.</p>}
          <p className="font-medium">Durov OS на главном экране</p>
          {isApple ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Откройте этот адрес в Safari.</li>
              <li>Нажмите «Поделиться» → «На экран Домой».</li>
              <li>Если есть переключатель «Открывать как веб-приложение», включите его и нажмите «Добавить».</li>
            </ol>
          ) : (
            <p className="mt-2">Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран». Если такого пункта нет, откройте адрес в Chrome или Edge.</p>
          )}
          <p className="mt-2 opacity-75">Открывайте приложение по значку Durov OS. Для работы нужен интернет.</p>
        </div>
      )}
    </div>
  )
}
