import { Component, Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Loader2, RefreshCw } from 'lucide-react'

export function RouteLoading() {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
      <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden />
      <span>Открываем раздел…</span>
    </div>
  )
}

class ScreenErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidUpdate(previous: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section role="alert" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-lg font-semibold text-ink">Не удалось открыть раздел</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Проверьте соединение и обновите страницу. Если ошибка повторяется, откройте другой раздел через меню и сообщите о проблеме.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white">
            <RefreshCw size={16} aria-hidden />Обновить страницу
          </button>
          <Link to="/today" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm">На мой экран</Link>
        </div>
      </section>
    )
  }
}

/** Navigation remains available if an individual screen fails to load or render.
 * Reload is explicit: never discard another screen's drafts or an active call automatically.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <ScreenErrorBoundary resetKey={location.key}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ScreenErrorBoundary>
  )
}
