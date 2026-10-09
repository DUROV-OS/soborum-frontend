import { useEffect, useMemo, useState } from 'react'
import { Handshake, Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { DataTable, DataTableColumn } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input, Select } from '@/shared/ui/Field'
import { Tabs } from '@/shared/ui/Tabs'
import { usePartnersStore } from '../store'
import { categoryLabel, Partner, PARTNER_CATEGORIES, PartnerCategory } from '../types'
import { PartnerFormModal } from '../components/PartnerFormModal'

type CategoryTab = 'ALL' | PartnerCategory

function digitsOf(value: string): string {
  const digits = value.replace(/\D/g, '')
  // Ведущая 8/7 у российского номера — как на бэкенде (app.clients.service._phone_tail).
  return digits.length > 10 && (digits[0] === '8' || digits[0] === '7') ? digits.slice(1) : digits
}

/** Отбор по поиску — те же правила, что у GET /api/partners/?search=: имя,
 * организация, цифры телефона. На фронте, чтобы счётчики категорий считались
 * по всей базе, а поиск и фильтры переключались без запросов. */
function matchesSearch(partner: Partner, text: string): boolean {
  const query = text.trim().toLocaleLowerCase('ru')
  if (!query) return true
  if (partner.name.toLocaleLowerCase('ru').includes(query)) return true
  if ((partner.organization ?? '').toLocaleLowerCase('ru').includes(query)) return true
  const digits = digitsOf(query)
  return Boolean(digits) && digitsOf(partner.phone ?? '').endsWith(digits)
}

const COLUMNS: DataTableColumn<Partner>[] = [
  {
    header: 'Партнёр',
    accessor: (p) => (
      <div>
        <div className="font-medium text-ink">{p.name}</div>
        {p.organization && <div className="text-[12px] text-muted">{p.organization}</div>}
      </div>
    ),
    sortValue: (p) => p.name,
  },
  { header: 'Категория', accessor: (p) => categoryLabel(p.category), sortValue: (p) => categoryLabel(p.category) },
  { header: 'Город', accessor: (p) => p.city, sortValue: (p) => p.city },
  { header: 'Телефон', accessor: (p) => p.phone ?? '—' },
  {
    header: 'Комментарий',
    className: 'max-w-[200px]',
    accessor: (p) =>
      p.comment ? (
        <span className="line-clamp-2 text-[13px] text-ink" title={p.comment}>
          {p.comment}
        </span>
      ) : (
        '—'
      ),
  },
  {
    header: 'Договорённости',
    className: 'max-w-[220px]',
    accessor: (p) => {
      const latest = p.notes[0]
      if (!latest) return '—'
      return (
        <div title={latest.text}>
          <div className="line-clamp-2 text-[13px] text-ink">{latest.text}</div>
          <div className="mt-0.5 text-[11px] text-muted">{new Date(latest.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
      )
    },
  },
  {
    header: 'Добавлен',
    accessor: (p) => new Date(p.created_at).toLocaleDateString('ru-RU'),
    sortValue: (p) => new Date(p.created_at),
    align: 'right',
  },
]

export function PartnersPage() {
  const partners = usePartnersStore((s) => s.partners)
  const cities = usePartnersStore((s) => s.cities)
  const loading = usePartnersStore((s) => s.loading)
  const error = usePartnersStore((s) => s.error)
  const load = usePartnersStore((s) => s.load)
  const navigate = useNavigate()
  const canEdit = accessLevelAtLeast(useAccessLevel('clients'), 'edit')
  const [tab, setTab] = useState<CategoryTab>('ALL')
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  // Город и поиск сужают базу; вкладка категории — последний шаг, чтобы
  // счётчики на вкладках показывали, сколько найдётся при переключении.
  const narrowed = useMemo(() => {
    const cityKey = city.trim().toLocaleLowerCase('ru')
    return partners.filter(
      (p) => (!cityKey || p.city.trim().toLocaleLowerCase('ru') === cityKey) && matchesSearch(p, query),
    )
  }, [partners, city, query])

  const rows = tab === 'ALL' ? narrowed : narrowed.filter((p) => p.category === tab)
  const countOf = (key: CategoryTab) => (key === 'ALL' ? narrowed.length : narrowed.filter((p) => p.category === key).length)
  const tabs = [
    { key: 'ALL' as CategoryTab, label: `Все · ${countOf('ALL')}` },
    ...PARTNER_CATEGORIES.map((c) => ({ key: c.key as CategoryTab, label: `${c.plural} · ${countOf(c.key)}` })),
  ]
  const filtering = Boolean(city || query.trim() || tab !== 'ALL')

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">База партнёров</h1>
          <p className="mt-1 text-[13px] text-muted">
            Все, кого мы нашли для сотрудничества: коммерция, агентства, риэлторы и специалисты по земле
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Имя, организация, телефон"
              aria-label="Поиск партнёра"
              className="w-60 pl-8 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-pill p-1 text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Город" className="w-44">
            <option value="">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Добавить партнёра
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <Tabs tabs={tabs} activeKey={tab} onChange={setTab} />
      </div>

      {error ? (
        <EmptyState title="Не удалось загрузить базу партнёров" description={error} />
      ) : !loading && partners.length === 0 ? (
        <EmptyState
          icon={<Handshake size={28} />}
          title="В базе пока никого нет"
          description="Добавьте первого партнёра — агентство, риэлтора, специалиста по земле или коммерческую компанию."
          action={
            canEdit && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} />
                Добавить партнёра
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={rows}
          keyOf={(p) => String(p.id)}
          onRowClick={(p) => navigate(`/partners/${p.id}`)}
          loading={loading}
          emptyLabel={filtering ? 'Никого не нашлось — попробуйте изменить фильтры' : 'В базе пока никого нет'}
        />
      )}

      <PartnerFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
