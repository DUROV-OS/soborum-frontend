import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useProductionStore } from '../store'

/**
 * Одно производство (один дом) — сущность разрастается за пределы списка
 * модулей: документы/поставки/сборка/остальное — внутренние разделы именно
 * этого производства, а не всего раздела «Производство» (см. запрос
 * Арсения от 16.09.2026 — список производств остаётся простым виджетом на
 * /production, роутинг по разделам — только здесь, внутри /production/:id).
 */

const TABS = [
  { path: 'glavnaya', label: 'Главная' },
  { path: 'postavka', label: 'Поставка' },
  { path: 'sborka', label: 'Сборка' },
  { path: 'ostalnoe', label: 'Остальное' },
]

export function ProductionDetailShell() {
  const { id = '' } = useParams()
  const productionId = Number(id)
  const production = useProductionStore((s) => s.production)
  const loadProduction = useProductionStore((s) => s.loadProduction)
  const deleteProduction = useProductionStore((s) => s.deleteProduction)
  const canFull = accessLevelAtLeast(useAccessLevel('production'), 'full')
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    loadProduction(productionId)
  }, [productionId, loadProduction])

  if (!production || production.id !== productionId) {
    return <p className="text-[13px] text-muted">Загрузка…</p>
  }

  async function handleDelete() {
    if (!production) return
    if (!window.confirm(`Удалить производство №${production.id}? Отменить нельзя.`)) return
    setDeleting(true)
    const result = await deleteProduction(production.id)
    if (result.ok) {
      navigate('/production', { replace: true })
      return
    }
    setDeleting(false)
    setDeleteError(result.reason ?? 'Не удалось удалить производство')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/production" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        Все производства
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[18px] font-medium text-ink">
          Производство №{production.id}
          {production.name && production.name !== 'Дом' && (
            <span className="ml-2 text-[13px] font-normal text-muted">· {production.name}</span>
          )}
        </h1>
        <div className="flex gap-2 self-start">
          <AskAiButton domain="production" contextLabel={`Производство №${production.id}`} contextNote={`[production_id=${production.id}] `} />
          {canFull && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Удалить производство"
              title="Удалить производство"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:bg-danger/40"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {deleteError && <p className="mb-3 text-[12px] text-danger">{deleteError}</p>}

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `relative shrink-0 whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors ${
                isActive ? 'text-brand-dark' : 'text-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {tab.label}
                {isActive && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand" />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="pt-5">
        <Outlet context={{ production }} />
      </div>
    </div>
  )
}
