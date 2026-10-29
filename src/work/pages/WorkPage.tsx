import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowUpRight, Briefcase, CircleCheck, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { getSectionSignal } from '@/today/api'
import { DashboardAction, WidgetTone } from '@/today/types'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SECTIONS, SectionId, SectionMeta } from '@/shared/sections'
import { visibleWorkflows } from '@/shared/workflows'

type Heat = 'red' | 'amber' | 'green'

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
  const groups = visibleWorkflows(hasAccess)
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[22px] font-medium text-ink">Работа</h1>
        <p className="mt-1 text-sm text-muted">
          Разделы по рабочим процессам: от заказа до исполнения и расчётов.
        </p>
      </div>
      {groups.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="Нет доступных разделов"
          description="Разделы появятся после выдачи доступа."
        />
      ) : (
        groups.map((group) => {
          const Icon = group.icon
          return (
            <section key={group.id} aria-labelledby={'work-' + group.id}>
              <div className="mb-3 flex items-start gap-3">
                <Icon size={21} className="mt-0.5 text-brand" />
                <div>
                  <h2 id={'work-' + group.id} className="text-lg font-medium">
                    {group.label}
                  </h2>
                  <p className="text-xs text-muted">{group.note}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.entries.map((entry) => {
                  const base = SECTIONS.find((s) => s.id === entry.section)!
                  const section = { ...base, label: entry.label, path: entry.to }
                  return entry.signal ? (
                    <WorkTile key={entry.id} id={entry.section} section={section} note={entry.note} />
                  ) : (
                    <StaticWorkTile
                      key={entry.id}
                      section={section}
                      note={entry.note}
                      badge={entry.readOnly ? 'Просмотр' : undefined}
                    />
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

/** Компактная карточка раздела без сигнала внимания — без min-height и без
 * места под блок «стоит заняться» / «что проверено» (его там никогда не будет). */
function StaticWorkTile({ section, note, badge }: { section: SectionMeta; note: string; badge?: string }) {
  const Icon = section.icon
  return (
    <NavLink
      to={section.path}
      className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-brand/40 hover:shadow-panel"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-brand-dark">
        <Icon size={20} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
          {section.label}
          {badge && (
            <span className="rounded-pill bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {badge}
            </span>
          )}
          <ArrowUpRight
            size={14}
            className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand"
          />
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{note}</p>
      </div>
    </NavLink>
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
  badge?: string
}) {
  const [action, setAction] = useState<DashboardAction | null>(null)
  const [checked, setChecked] = useState(false)
  const [clearText, setClearText] = useState<string | null>(null)
  const [agentNote, setAgentNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSectionSignal(id)
      .then((signal) => {
        if (!cancelled) {
          setAction(signal.action)
          setChecked(signal.checked)
          setClearText(signal.clear_text)
          setAgentNote(signal.agent_note ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAction(null)
          setChecked(false)
          setClearText(null)
          setAgentNote(null)
        }
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
            {badge && (
              <span className="rounded-pill bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                {badge}
              </span>
            )}
            <ArrowUpRight
              size={15}
              className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand"
            />
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{note}</p>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-label="Загрузка сигнала"
          className="mt-4 space-y-2 rounded-lg border-l-[3px] border-border bg-surface-muted/60 p-3.5"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
        </div>
      ) : action && heat ? (
        <div className={`mt-4 flex-1 rounded-lg border-l-[3px] p-3.5 ${HEAT_BLOCK[heat]}`}>
          <div className={`mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold ${HEAT_TEXT[heat]}`}>
            <Sparkles size={14} className="text-ai-accent" />
            стоит заняться:
          </div>
          <p className="text-[15px] leading-relaxed text-ink">
            {action.description} ({action.count})
          </p>
        </div>
      ) : (
        checked &&
        clearText && (
          // Только текст бэка о том, что именно проверено и чисто (0084-c), без
          // общей добавки «всё в порядке»: для производства он приходит лишь при
          // благополучной оценке готовности.
          <div
            className={`mt-4 flex flex-1 items-start gap-1.5 rounded-lg border-l-[3px] p-3.5 ${HEAT_BLOCK.green}`}
          >
            <CircleCheck size={14} className={`mt-1 shrink-0 ${HEAT_TEXT.green}`} />
            <p className="text-[15px] leading-relaxed text-ink">{clearText}</p>
          </div>
        )
      )}

      {!loading && agentNote && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-ai-accent" />
          {agentNote}
        </p>
      )}
    </NavLink>
  )
}
