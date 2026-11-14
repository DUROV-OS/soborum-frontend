export type Acquisition = {
  is_direct: boolean
  source_label: string
  campaign_id: string | null
  direction: string
  basis: string | null
  has_visit_id: boolean
}

export function AcquisitionBadge({ value, detail = false }: { value?: Acquisition | null; detail?: boolean }) {
  if (!value?.is_direct) return null
  return <div className="mt-2 space-y-1" data-acquisition-source="yandex-direct">
    <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-950"
      title={`Источник по сохранённым меткам: ${value.basis}. Связь с визитом и качество проверяются отдельно.`}>Яндекс Директ</span>
    <p className="break-words text-xs text-muted">{[value.campaign_id ? `Кампания №${value.campaign_id}` : 'Кампания не указана', value.direction !== 'Не определено' ? value.direction : null].filter(Boolean).join(' · ')}</p>
    {detail && <p className="text-xs text-muted">Источник указан по рекламным меткам ({value.basis}). Срабатывание цели и качество обращения проверяются отдельно.</p>}
  </div>
}
