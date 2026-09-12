import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { Markdown } from '@/shared/ui/Markdown'
import { getHouseModel } from '../api'
import { ConfirmationBadge } from '../components/ConfirmationBadge'
import { HouseModelDetail } from '../types'

function Section({ title, content }: { title: string; content: string | null }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-[14px] font-medium text-ink">{title}</h2>
      {content ? (
        <Markdown text={content} className="text-[13px] leading-relaxed text-ink" />
      ) : (
        <p className="text-[13px] text-muted">Не задокументировано.</p>
      )}
    </section>
  )
}

export function HouseModelDetailPage() {
  const { key = '' } = useParams()
  const [model, setModel] = useState<HouseModelDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setModel(null)
    setError(null)
    getHouseModel(key)
      .then((data) => {
        if (!cancelled) setModel(data)
      })
      .catch(() => {
        if (!cancelled) setError('Проект не найден или не удалось его загрузить')
      })
    return () => {
      cancelled = true
    }
  }, [key])

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/house-models"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        Все проекты
      </Link>

      {error && <EmptyState title="Не удалось открыть проект" description={error} />}
      {!model && !error && <LoadingState label="Загрузка проекта…" />}

      {model && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-medium text-ink">{model.title}</h1>
              <ConfirmationBadge confirmation={model.confirmation} />
            </div>
            <p className="text-[13px] text-muted">{model.confirmation_label}</p>
            {model.client_name && <p className="mt-1 text-[13px] text-ink">Клиент: {model.client_name}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              {model.area_footprint_m2 != null && <span>{model.area_footprint_m2} м² застройки</span>}
              {model.area_total_m2 != null && <span>{model.area_total_m2} м² общая</span>}
              {model.price_site_rub != null && <span>{model.price_site_rub.toLocaleString('ru-RU')} ₽ (цена сайта)</span>}
              {model.deal_amount_rub != null && (
                <span>{model.deal_amount_rub.toLocaleString('ru-RU')} ₽ (сумма сделки)</span>
              )}
            </div>
          </div>

          <Section title="Характеристики" content={model.characteristics_md} />
          <Section title="Планировка" content={model.planning_md} />
          <Section title="Конфигурации / тарифы" content={model.configurations_md} />
          <Section title="Модули" content={model.modules_md} />
          <Section title="Экономика" content={model.economics_md} />
          <Section title="Производственный опыт" content={model.production_experience_md} />
          <Section title="Реальные сделки без ПЗ" content={model.deals_without_pz_md} />
          <Section title="Проектные файлы" content={model.files_md} />
          {model.notes_md && <Section title="Заметки" content={model.notes_md} />}

          <section className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
            <h2 className="mb-2 text-[13px] font-medium text-muted">
              Открытые вопросы компании (не баги интерфейса)
            </h2>
            {model.open_questions_md ? (
              <Markdown text={model.open_questions_md} className="text-[12px] leading-relaxed text-muted" />
            ) : (
              <p className="text-[12px] text-muted">Открытых вопросов не зафиксировано.</p>
            )}
          </section>

          <p className="text-[11px] text-muted">Источник: {model.source_note_path}</p>
        </div>
      )}
    </div>
  )
}
