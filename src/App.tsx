import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { AppRouter } from '@/app/router'

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const booting = useAuthStore((s) => s.booting)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // Push permission is requested only by the notification button, after a user gesture.

  if (booting) {
    return <div className="flex h-screen items-center justify-center text-[13px] text-muted">Загрузка…</div>
  }

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
