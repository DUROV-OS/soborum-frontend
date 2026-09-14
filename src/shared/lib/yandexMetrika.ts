declare global {
  interface Window {
    ym?: (...args: unknown[]) => void
  }
}

// webvisor (запись сессий сотрудников) по умолчанию выключен — включить можно только по явному запросу.
export function initYandexMetrika(): void {
  if (import.meta.env.DEV) return
  const counterId = import.meta.env.VITE_YANDEX_METRIKA_ID
  if (!counterId) return

  const w = window as unknown as Record<string, unknown>
  w.ym =
    w.ym ||
    function (...args: unknown[]) {
      ;((w.ym as { a?: unknown[] }).a = (w.ym as { a?: unknown[] }).a || []).push(args)
    }
  ;(w.ym as { l: number }).l = Number(new Date())
  const existing = document.getElementsByTagName('script')[0]
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://mc.yandex.ru/metrika/tag.js'
  existing.parentNode?.insertBefore(script, existing)

  window.ym?.(Number(counterId), 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  })
}
