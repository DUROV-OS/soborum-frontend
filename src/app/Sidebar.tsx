import { Fragment, useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, X } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { useFeedbackStore } from '@/feedback/store'
import { awaitsReply } from '@/feedback/types'
import { useNotificationsStore } from '@/notifications/store'
import { SECTIONS, SectionId } from '@/shared/sections'
import { visibleWorkflows, workflowContext } from '@/shared/workflows'
import { InstallAppButton } from '@/shared/mobile/InstallApp'

/** Общие инструменты; рабочие процессы добавляются из единого справочника. */
const MENU: SectionId[] = [
  'today',
  'tasks',
  'work',
  'ai',
  'board',
  'agents',
  'ai_proposals',
  'notifications',
  'feedback_my',
  'feedback_admin',
  'admin',
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const isAdmin = useAuthStore((s) => s.current?.role === 'admin')
  const loadFeedback = useFeedbackStore((s) => s.load)
  // Новые заявки и те, где сотрудник ответил и ждёт ответа (0090).
  const newFeedbackCount = useFeedbackStore(
    (s) => s.requests.filter((r) => r.status === 'new' || awaitsReply(r)).length,
  )
  const loadMyFeedback = useFeedbackStore((s) => s.loadMine)
  const unseenFeedbackCount = useFeedbackStore((s) => s.mine.reduce((sum, r) => sum + r.unseen_updates, 0))
  const unreadNotificationsCount = useNotificationsStore((s) => s.unreadCount)
  const { pathname, search } = useLocation()
  const groups = visibleWorkflows(hasAccess)
  const context = workflowContext(pathname, search, groups)
  const [expanded, setExpanded] = useState<string[]>(context ? [context.group.id] : [])
  useEffect(() => {
    if (context)
      setExpanded((previous) =>
        previous.includes(context.group.id) ? previous : [...previous, context.group.id],
      )
  }, [context?.group.id])

  // Счётчик новых заявок в пункте «Заявки» (0075-c) — только администратору,
  // остальным этот пункт меню и не показывается.
  useEffect(() => {
    if (isAdmin) loadFeedback().catch(() => {})
  }, [isAdmin, loadFeedback])

  // Счётчик непрочитанных обновлений по своим заявкам в «Моих заявках»
  // (0090) — всем. Ответ администратора приходит без пуша, поэтому
  // перечитываем раз в минуту.
  useEffect(() => {
    loadMyFeedback().catch(() => {})
    const timer = window.setInterval(() => loadMyFeedback().catch(() => {}), 60_000)
    return () => window.clearInterval(timer)
  }, [loadMyFeedback])

  // «Работа» видна, если доступен хотя бы один вложенный раздел
  // Публичный справочник поставщиков также входит в хаб.
  const showWork = groups.length > 0
  const canSee = (id: SectionId) => (id === 'work' ? showWork : hasAccess(id))
  const items = MENU.flatMap((id) => {
    const section = SECTIONS.find((s) => s.id === id)
    return section && canSee(id) ? [section] : []
  })
  const workActive = !!context || pathname === '/work'
  const workflowItems = (
    <>
      {groups.map((group) => {
        const Icon = group.icon,
          opened = expanded.includes(group.id)
        return (
          <li key={'workflow-' + group.id}>
            <button
              type="button"
              aria-expanded={opened}
              aria-controls={'workflow-' + group.id}
              className={
                'flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm ' +
                (context?.group.id === group.id
                  ? 'bg-sidebar-accent text-white'
                  : 'text-white/75 hover:text-white')
              }
              onClick={() =>
                setExpanded((previous) =>
                  opened ? previous.filter((id) => id !== group.id) : [...previous, group.id],
                )
              }
            >
              <Icon size={19} />
              <span className="flex-1">{group.label}</span>
              <ChevronDown size={15} className={opened ? 'rotate-180' : ''} />
            </button>
            {opened && (
              <ul id={'workflow-' + group.id} className="ml-6 mt-1 space-y-0.5 border-l border-white/15 pl-2">
                {group.entries.map((entry) => {
                  const active = context?.entry.id === entry.id
                  return (
                    <li key={entry.id}>
                      <Link
                        to={entry.to}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={
                          'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-[13px] ' +
                          (active
                            ? 'bg-white font-medium text-sidebar'
                            : 'text-white/70 hover:bg-sidebar-accent hover:text-white')
                        }
                      >
                        <span className="min-w-0 flex-1">{entry.label}</span>
                        {entry.readOnly && <span className="text-[9px] opacity-65">Просмотр</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </>
  )

  return (
    <aside
      aria-label="Главное меню"
      className={`mobile-safe-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh w-72 shrink-0 flex-col bg-sidebar text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex h-24 shrink-0 items-center justify-between px-7">
        <NavLink to="/today" onClick={onClose} className="text-[24px] font-semibold tracking-tight">
          Durov OS<span className="text-white/55">.</span>
        </NavLink>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="rounded-lg p-2 text-white/60 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
        <ul className="space-y-1.5">
          {items.map((section) => {
            const Icon = section.icon
            return (
              <Fragment key={section.id}>
                <li
                  className={section.id === 'feedback_my' ? 'mt-3 border-t border-white/10 pt-3' : undefined}
                >
                  <NavLink
                    to={section.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex min-h-[52px] items-center gap-3.5 rounded-xl px-4 py-3 text-[14px] transition-colors ${
                        (section.id === 'work' ? workActive : isActive)
                          ? 'bg-white font-medium text-sidebar'
                          : 'text-white/75 hover:bg-sidebar-accent hover:text-white'
                      }`
                    }
                  >
                    <Icon size={20} strokeWidth={1.6} />
                    <span className="flex-1">{section.label}</span>
                    {section.id === 'feedback_admin' && newFeedbackCount > 0 && (
                      <span className="rounded-pill bg-brand px-2 py-0.5 text-[12px] font-medium text-white">
                        {newFeedbackCount}
                      </span>
                    )}
                    {section.id === 'notifications' && unreadNotificationsCount > 0 && (
                      <span
                        className="rounded-pill bg-brand px-2 py-0.5 text-[12px] font-medium text-white"
                        title="Непрочитанные уведомления"
                      >
                        {unreadNotificationsCount}
                      </span>
                    )}
                    {section.id === 'feedback_my' && unseenFeedbackCount > 0 && (
                      <span
                        className="rounded-pill bg-brand px-2 py-0.5 text-[12px] font-medium text-white"
                        title="Новые обновления по вашим заявкам"
                      >
                        {unseenFeedbackCount}
                      </span>
                    )}
                    {section.id === 'ai' && <ArrowUpRight size={15} className="opacity-50" />}
                  </NavLink>
                </li>
                {(section.id === 'ai' || (section.id === 'work' && !canSee('ai'))) && workflowItems}
              </Fragment>
            )
          })}
        </ul>
        <div className="mt-5">
          <InstallAppButton dark />
        </div>
      </nav>
      <div className="m-5 rounded-xl border border-white/15 p-4">
        <p className="text-[13px] font-medium text-white/85">Больше времени на главное</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/50">
          Люди, процессы и решения — в одном рабочем пространстве.
        </p>
      </div>
    </aside>
  )
}
