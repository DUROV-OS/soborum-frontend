import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHouseModelProductions } from '../api'
import { HouseModelProduction } from '../types'

/** «Дома этой модели в работе» (задача 0073-b): реальные `Production`, чей
 * клиент выбрал эту модель (`Client.house_model_key`). Переход по клику ведёт
 * на уже существующую страницу производства — там задачи дома видны и
 * редактируются как обычно, отдельного редактора задач здесь не заводится. */
export function ModelHousesBlock({ modelKey }: { modelKey: string }) {
  const [houses, setHouses] = useState<HouseModelProduction[] | null>(null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setHouses(null)
    setError(false)
    getHouseModelProductions(modelKey)
      .then((data) => {
        if (!cancelled) setHouses(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [modelKey])

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-[14px] font-medium text-ink">Дома этой модели в работе</h2>

      {error && <p className="text-[13px] text-muted">Не удалось загрузить список домов.</p>}

      {!houses && !error && <p className="text-[13px] text-muted">Загрузка…</p>}

      {houses && houses.length === 0 && (
        <p className="text-[13px] text-muted">Пока не строится ни один дом этой модели.</p>
      )}

      {houses && houses.length > 0 && (
        <div className="flex flex-col gap-2">
          {houses.map((house) => (
            <button
              key={house.production_id}
              type="button"
              onClick={() => navigate(`/production/${house.production_id}`)}
              className="rounded-md border border-border bg-surface-muted px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-brand/40"
            >
              {house.client_display_name}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
