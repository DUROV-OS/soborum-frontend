import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { getCatalog } from '../api'
import { ConfirmationBadge } from '../components/ConfirmationBadge'
import { HouseModelBrief, HouseModelCatalog } from '../types'

const SERIES_LABEL: Record<string, string> = {
  barn: 'Барн',
  flat: 'Флэт',
}

function formatArea(model: HouseModelBrief): string | null {
  if (model.area_footprint_m2 == null) return null
  const footprint = `${model.area_footprint_m2} м² застройки`
  if (model.area_total_m2 == null) return footprint
  return `${footprint} · ${model.area_total_m2} м² общая`
}

function formatPrice(model: HouseModelBrief): string | null {
  if (model.price_site_rub != null) return `${model.price_site_rub.toLocaleString('ru-RU')} ₽ (цена сайта)`
  if (model.deal_amount_rub != null) return `${model.deal_amount_rub.toLocaleString('ru-RU')} ₽ (сумма сделки)`
  return null
}

export function HouseModelsListPage() {
  const [catalog, setCatalog] = useState<HouseModelCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить каталог типовых проектов')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-medium text-ink">Типовые проекты домов</h1>
        <p className="mt-1 text-[13px] text-muted">
          Витрина каталожных моделей и индивидуальных проектов из базы знаний Durov.House — чисто просмотровый
          раздел, без редактирования.
        </p>
      </div>

      {error && <EmptyState icon={<Home size={22} />} title="Ошибка" description={error} />}

      {!catalog && !error && <LoadingState label="Загрузка каталога…" />}

      {catalog && (
        <div className="flex flex-col gap-8">
          {catalog.series.map((group) => (
            <section key={group.series}>
              <h2 className="mb-3 text-[15px] font-medium text-ink">{SERIES_LABEL[group.series] ?? group.series}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.models.map((model) => (
                  <HouseModelCard key={model.key} model={model} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Индивидуальные проекты</h2>
            {catalog.individual.length === 0 ? (
              <p className="text-[13px] text-muted">Индивидуальных проектов пока нет.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.individual.map((model) => (
                  <HouseModelCard key={model.key} model={model} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function HouseModelCard({ model }: { model: HouseModelBrief }) {
  const area = formatArea(model)
  const price = formatPrice(model)

  return (
    <Link
      to={`/house-models/${model.key}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/40 hover:shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-medium text-ink">{model.title}</span>
        <ConfirmationBadge confirmation={model.confirmation} />
      </div>
      {model.client_name && <p className="text-[12px] text-muted">{model.client_name}</p>}
      <p className="text-[12px] text-muted">{area ?? 'Площадь не задокументирована'}</p>
      <p className="text-[12px] text-muted">{price ?? 'Цена не задокументирована'}</p>
    </Link>
  )
}
