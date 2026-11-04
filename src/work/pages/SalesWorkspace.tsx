import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Briefcase, Users, MessagesSquare, ClipboardList, Bell } from 'lucide-react'
import { catalog } from '@/crm/api'

const links = [
  { title: 'Сделки', note: 'Все сделки, этапы и следующие шаги', to: '/crm?tab=deal', icon: Briefcase },
  { title: 'Входящие обращения', note: 'Новые заявки клиентов и принятие в работу', to: '/crm?tab=inquiry', icon: Users },
  { title: 'Контакты', note: 'Контактные лица клиентов', to: '/crm?tab=contact', icon: Users },
  { title: 'Компании', note: 'Организации клиентов и связанные сделки', to: '/crm?tab=company', icon: Briefcase },
  { title: 'Задачи', note: 'Назначенные вам задачи и сроки', to: '/tasks', icon: ClipboardList },
  { title: 'MAX', note: 'Общение из подключённого рабочего аккаунта', to: '/chats', icon: MessagesSquare },
  { title: 'Команда', note: 'Сотрудники с доступом к CRM', to: '/team', icon: Users },
  { title: 'Уведомления', note: 'Личные уведомления по работе', to: '/notifications', icon: Bell },
]

/** Sales landing deliberately does not load the owner dashboard or ERP clients. */
export function SalesWorkspace({ view = 'today' }: { view?: 'today' | 'work' | 'sales' }) {
  const title = view === 'today' ? 'Главное на сегодня' : view === 'work' ? 'Работа' : 'Продажи'
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return <div className="mx-auto max-w-[1440px] space-y-7 pb-6">
    <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Рабочий обзор</p>
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">{title}<span className="text-brand">.</span></h1>
      <p className="mt-2 text-[13px] text-muted">{view === 'today' ? today : 'Рабочие инструменты отдела продаж'}</p></div>
    <section aria-label="Отдел продаж" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {links.map(({ title, note, to, icon: Icon }) => <Link key={to} to={to} className="rounded-2xl border border-border bg-surface p-5 shadow-card hover:border-brand/40">
        <div className="flex items-center gap-3"><Icon size={21} className="text-brand" /><h2 className="flex-1 text-[17px] font-medium text-ink">{title}</h2><ArrowUpRight size={16} className="text-muted" /></div>
        <p className="mt-3 text-[13px] text-muted">{note}</p></Link>)}
    </section>
    <section className="rounded-2xl border border-border bg-surface p-5"><h2 className="text-[18px] font-semibold text-ink">Обратная связь</h2>
      <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-brand"><Link to="/feedback/my">Мои заявки →</Link><Link to="/feedback">Подать заявку →</Link></div></section>
  </div>
}

export function SalesTeam() {
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { let active = true; catalog().then(data => { if (active) { setUsers(data.users); setState('ready') } }).catch(() => { if (active) setState('error') }); return () => { active = false } }, [])
  return <div className="mx-auto max-w-3xl space-y-5"><h1 className="text-[28px] font-semibold text-ink">Команда</h1><p className="text-sm text-muted">Сотрудники с доступом к CRM</p>
    {state === 'loading' ? <p role="status">Загружаем команду…</p> : state === 'error' ? <p role="alert">Не удалось загрузить команду.</p> : users.length === 0 ? <p>Сотрудников пока нет.</p> : <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">{users.map(user => <li key={user.id} className="px-5 py-4 text-sm">{user.name}</li>)}</ul>}</div>
}
