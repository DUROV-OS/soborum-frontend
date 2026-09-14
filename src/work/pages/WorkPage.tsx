import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowUpRight, Briefcase, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { getSectionSignal } from '@/today/api'
import { DashboardAction, WidgetTone } from '@/today/types'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SECTIONS, SectionId, SectionMeta } from '@/shared/sections'

type Heat = 'red' | 'amber' | 'green'

/**
 * Раздел «Работа» — хаб. Плоская сетка крупных виджетов, каждый ведёт в свой
 * раздел. Внутри виджета — блок «стоит заняться», если по разделу есть
 * реальный сигнал внимания из `GET /api/dashboard/today/section/:id`
 * (та же детерминированная сводка, что и на «Пульсе», см.
 * `app.dashboard.overview` — никаких выдуманных ИИ-советов: если для раздела
 * нет посчитанного по базе действия, блок не показывается вовсе).
 *
 * Каждая плитка тянет свой сигнал **отдельным** запросом (не одним общим
 * /today на всю страницу) — тяжёлый/медленный раздел не держит остальные;
 * бэк кэширует ответ на 6 часов.
 *
 * `badge` — ярлык на плитке ('dev' у «Бухгалтерии»: реестр готов, интеграции
 * ещё в работе). `public` — плитка видна всем, минуя `hasAccess` (у
 * «Поставщиков» доступ отдельным грантом пока не заведён).
 */
const TILES: {
  id: SectionId
  note: string
  badge?: 'dev'
  public?: boolean
}[] = [
  { id: 'cycle', note: 'Все клиенты по этапам сделки' },
  { id: 'clients', note: 'Карточки клиентов, оплаты и документы' },
  { id: 'production', note: 'Заказы в цехе и потребность в материалах' },
  { id: 'warehouse', note: 'Остатки, приход и именованный резерв' },
  { id: 'installation', note: 'Доставка и монтаж на объектах клиентов' },
  { id: 'marketing', note: 'Заявки, каналы и рекламные кампании' },
  { id: 'house_models', note: 'Каталожные модели и индивидуальные проекты — витрина, без редактирования' },
  { id: 'meetings', note: 'Прошедшие совещания, заметки и решения' },
  { id: 'chats', note: 'Все переписки с клиентами и командой в MAX' },
  { id: 'accounting', note: 'Реестр движения денег: приход, расход, статьи и статусы', badge: 'dev' },
  { id: 'suppliers', note: 'Контакты, прайс-листы и оплаты поставщикам', public: true },
]

const HEAT_BLOCK: Record<Heat, string> = {
  red: 'border-danger/70 bg-danger-bg/60',
  amber: 'border-warning/70 bg-warning-bg/60',
  green: 'border-success/70 bg-success-bg/60',
}
const HEAT_TEXT: Record<Heat, string> = {
  red: 'text-danger',
  amber: 'text-warning',
  green: 'text-success',
}

function heatOf(tone: WidgetTone): Heat {
  if (tone === 'danger') return 'red'
  if (tone === 'warning') return 'amber'
  return 'green'
}

export function WorkPage() {
  const hasAccess = useAuthStore((s) => s.hasAccess)

  const tiles = TILES.flatMap((tile) => {
    const section = SECTIONS.find((s) => s.id === tile.id)
    if (!section) return []
    // public-плитки видят все; остальные — по доступу
    if (!(tile.public || hasAccess(tile.id))) return []
    return [{ ...tile, section }]
  })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-medium text-ink">Работа</h1>
        <p className="mt-1 text-[13px] text-muted">Разделы компании — процессы, исполнение и контроль. Сигналы внимания — по реальным данным.</p>
      </div>

      {tiles.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="Нет доступных разделов"
          description="Разделы появятся здесь, когда вам выдадут к ним доступ."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tiles.map(({ id, section, note, badge }) => (
            <WorkTile key={id} id={id} section={section} note={note} badge={badge} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkTile({
  id,
  section,
  note,
  badge,
}: {
  id: SectionId
  section: SectionMeta
  note: string
  badge?: 'dev'
}) {
  const [action, setAction] = useState<DashboardAction | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSectionSignal(id)
      .then((signal) => {
        if (!cancelled) setAction(signal.action)
      })
      .catch(() => {
        if (!cancelled) setAction(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const Icon = section.icon
  const heat = action ? heatOf(action.tone) : null

  return (
    <NavLink
      to={section.path}
      className="group flex min-h-[240px] flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-brand/40 hover:shadow-panel"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand-dark">
          <Icon size={22} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
            {section.label}
            {badge && <span className="rounded-pill bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">{badge}</span>}
            <ArrowUpRight size={15} className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{note}</p>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="Загрузка сигнала" className="mt-4 space-y-2 rounded-lg border-l-[3px] border-border bg-surface-muted/60 p-3.5">
          <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
        </div>
      ) : action && heat && (
        <div className={`mt-4 flex-1 rounded-lg border-l-[3px] p-3.5 ${HEAT_BLOCK[heat]}`}>
          <div className={`mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold ${HEAT_TEXT[heat]}`}>
            <Sparkles size={14} className="text-ai-accent" />
            стоит заняться:
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{action.description} ({action.count})</p>
        </div>
      )}
    </NavLink>
  )
}
