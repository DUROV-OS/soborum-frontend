import { useEffect, useRef } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { AppRouter } from '@/app/router'
import { useBrowserPush } from '@/shared/hooks/useBrowserPush'
import { pushSupported } from '@/shared/lib/pushNotifications'

export function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const booting = useAuthStore((s) => s.booting)
  const current = useAuthStore((s) => s.current)
  const { enable: enablePush } = useBrowserPush()
  const pushAskedRef = useRef(false)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  // Запрос разрешения на push на первом экране после входа (0080-e), плюс
  // (если разрешили) оформление подписки и отправка её на backend —
  // `useBrowserPush.enable()` делает обе части одним вызовом.
  // `Notification.permission === 'default'` — браузер ещё не спрашивал и
  // сам не покажет диалог повторно после отказа/разрешения, поэтому это
  // не навязчивый повтор на каждый вход: явный повторный запрос — кнопка
  // в шапке (см. `PushNotificationsButton`).
  useEffect(() => {
    if (!current || pushAskedRef.current) return
    if (!pushSupported() || Notification.permission !== 'default') return
    pushAskedRef.current = true
    void enablePush()
  }, [current, enablePush])

  if (booting) {
    return <div className="flex h-screen items-center justify-center text-[13px] text-muted">Загрузка…</div>
  }

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
