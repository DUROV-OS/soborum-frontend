import { create } from 'zustand'

const STORAGE_KEY = 'soborbum.jarvis.enabled'

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    /* нет доступа к localStorage — тумблер просто не переживёт перезагрузку */
  }
}

interface JarvisState {
  /** Включён ли режим Jarvis — тумблер в Topbar, персистентно в localStorage,
   * не завязан на текущий роут (0051-a). */
  enabled: boolean
  toggle: () => void
  disable: () => void
}

export const useJarvisStore = create<JarvisState>((set) => ({
  enabled: loadEnabled(),

  toggle: () =>
    set((state) => {
      const next = !state.enabled
      saveEnabled(next)
      return { enabled: next }
    }),

  disable: () => {
    saveEnabled(false)
    set({ enabled: false })
  },
}))
