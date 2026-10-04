import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Input } from '@/shared/ui/Field'
import { usePartnersStore } from '../store'
import { categoryLabel, PartnerBrief, partnerBriefLabel } from '../types'
import { PartnerFormModal } from './PartnerFormModal'

/**
 * «Кто рекомендовал» (0083-c): выбор партнёра из базы партнёров поиском по
 * имени, организации и городу. Если нужного нет — «Добавить партнёра» прямо
 * отсюда, без ухода из формы клиента.
 */
export function ReferrerPicker({
  value,
  onChange,
}: {
  value: PartnerBrief | null
  onChange: (partner: PartnerBrief | null) => void
}) {
  const partners = usePartnersStore((s) => s.partners)
  const loading = usePartnersStore((s) => s.loading)
  const load = usePartnersStore((s) => s.load)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (partners.length === 0) load()
  }, [partners.length, load])

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ru')
    const found = q
      ? partners.filter((p) =>
          [p.name, p.organization ?? '', p.city].some((f) => f.toLocaleLowerCase('ru').includes(q)),
        )
      : partners
    return found.slice(0, 8)
  }, [partners, query])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-[13px] text-ink">
        <span className="truncate">{partnerBriefLabel(value)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Убрать рекомендателя"
          className="shrink-0 rounded-pill p-1 text-muted hover:text-danger"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-3 top-[19px] -translate-y-1/2 text-muted" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Найти в базе партнёров: имя, агентство, город"
        aria-label="Кто рекомендовал"
        className="pl-8"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface p-1 shadow-xl">
          {loading ? (
            <p className="px-2.5 py-2 text-[12px] text-muted">Загрузка…</p>
          ) : matches.length === 0 ? (
            <p className="px-2.5 py-2 text-[12px] text-muted">
              {partners.length === 0 ? 'В базе партнёров пока никого нет' : 'Никого не нашлось'}
            </p>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full flex-col rounded-sm px-2.5 py-1.5 text-left hover:bg-surface-muted"
              >
                <span className="text-[13px] text-ink">{p.name}</span>
                <span className="text-[11px] text-muted">
                  {categoryLabel(p.category)} · {p.city}
                  {p.organization && ` · ${p.organization}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-brand"
      >
        <Plus size={13} />
        Нет в базе — добавить партнёра
      </button>
      <PartnerFormModal open={adding} onClose={() => setAdding(false)} onCreated={(p) => onChange(p)} />
    </div>
  )
}
