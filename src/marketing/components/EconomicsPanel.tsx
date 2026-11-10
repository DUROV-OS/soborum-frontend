import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'

type Proof = { record_id: number; version: number; amount: string; state: string; incurred_on: string; filename: string; sha256: string; locator: string; allocation_basis: string[]; tax_basis: string; checked_by: string | null }
type Project = { id: number; title: string; number: string; deal_id: number; request_id: number; recognized_advertising: string | null; advertising_documents: Proof[]; complete: boolean; closure_state: string; actual_profit: string | null; actual_margin_percent: string | null; net_revenue: string | null; below_target: boolean | null; issues: string[]; source_hash: string }
type Group = { source: string; medium: string; campaign: string; requests: { id: number }[]; unique_contacts: number; qualified_unique_contacts: number; deal_ids: number[]; projects: Project[]; closed_project_count: number; closed_project_profit: string | null }
type Report = { date_from: string; date_to: string; checked_at: string; partial_today: boolean; total_requests: number; unique_contacts: number; linked_projects: number; closed_projects: number; closed_project_profit: string | null; groups: Group[]; period_advertising: { recognized_amount: string | null; documents: {record_id: number; project_ids: number[]; amount: string; state: string}[]; pending_count: number; stale_count: number }; unlinked_projects_all_time: { id: number; reason: string }[]; invalid_deal_ids: number[]; limitations: string[]; source_hash: string }
const cash = (v: string | null) => v === null ? 'Нет подтверждения' : new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(v))
const states: Record<string, string> = { open: 'Сверка затрат не завершена', awaiting_director: 'Ждёт руководителя', approved: 'Результат утверждён', stale: 'Основания изменились', duplicate_order_line: 'Требуется устранить двойной учёт' }
const costStates: Record<string, string> = { recognized: 'Признано бухгалтером', pending: 'Ждёт бухгалтера', stale: 'Нужна повторная сверка' }
const box = 'rounded-2xl border border-border bg-surface p-4 sm:p-5'
const projectUrl = (id: number) => `/accounting?tab=costs&project=${id}`

export function EconomicsPanel() {
  const allowed = useAuthStore(s => ['clients', 'accounting', 'costing'].every(k => s.hasAccess(k as 'clients' | 'accounting' | 'costing')))
  return allowed ? <EconomicsReport /> : <section className={box}><h2 className="font-semibold">Экономика рекламы</h2><p className="mt-2 text-sm text-muted">Для просмотра затрат и прибыли нужны права на клиентов, бухгалтерию и себестоимость. Оценка качества обращений доступна во вкладке «Конверсии».</p></section>
}

function EconomicsReport() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [from, setFrom] = useState(today.slice(0, 8) + '01'), [to, setTo] = useState(today)
  const [data, setData] = useState<Report | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const load = useCallback(async () => {
    const n = ++seq.current; setData(null); setError(''); setBusy(true)
    try {
      if (!from || !to || from > to) throw new Error('Укажите начало и конец периода в правильном порядке')
      const result = await apiRequest<Report>({ section: 'marketing', path: '/economics', query: { date_from: from, date_to: to } })
      if (n === seq.current) setData(result)
    } catch (e) { if (n === seq.current) setError(e instanceof Error ? e.message : 'Не удалось проверить экономику рекламы') }
    finally { if (n === seq.current) setBusy(false) }
  }, [from, to])
  useEffect(() => { void load(); return () => { seq.current++ } }, [load])
  return <section aria-label="Экономика рекламы" className="space-y-5">
    <div className={`${box} bg-gradient-to-br from-brand/5 to-surface`}>
      <h2 className="text-xl font-semibold">От обращения до прибыли</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">Каждая связь ведёт к исходной записи. Прибыль показывается после сверки Татьяной и утверждения руководителем; рекламный расход подтверждается документами.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">{['Обращение сайта', 'Сделка CRM', 'Проект', 'Документы', 'Утверждённый результат'].map((v, i) => <span key={v} className="flex items-center gap-2"><span className="rounded-full border border-border bg-surface px-3 py-2">{v}</span>{i < 4 && <ArrowRight size={14} className="text-muted" />}</span>)}</div>
    </div>
    <div className="flex flex-wrap items-end gap-3"><Field label="Обращения с"><Input aria-label="Начало периода экономики" type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="По"><Input aria-label="Конец периода экономики" type="date" value={to} onChange={e => setTo(e.target.value)} /></Field><Button variant="secondary" disabled={busy} onClick={() => void load()}><RefreshCw size={15} />Перепроверить</Button></div>
    {busy && <p role="status" className="text-sm text-muted">Проверяем связи, документы и согласования…</p>}
    {error && <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{error}</p>}
    {data && <>
      <p className="text-xs text-muted">Обращения {data.date_from} — {data.date_to}, Москва. Проверено {new Date(data.checked_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}.{data.partial_today && ' Период включает незавершённый день.'} Результаты проектов — за всё время.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Обращения сайта', String(data.total_requests), `Уникальные контакты: ${data.unique_contacts}`],
        ['Связанные проекты', String(data.linked_projects), 'Только явная связь через сделку'],
        ['Результат утверждён', `${data.closed_projects} из ${data.linked_projects}`, 'Проверены затраты и выручка'],
        ['Прибыль закрытых проектов', cash(data.closed_project_profit), 'Подтверждённая часть, не итог всей рекламы'],
      ].map(([label, value, note]) => <article key={label} className={box}><p className="text-sm text-muted">{label}</p><p className="mt-2 break-words text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-muted">{note}</p></article>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className={box}><h3 className="font-semibold">Реклама, признанная за период</h3><p className="mt-3 text-2xl font-semibold">{cash(data.period_advertising.recognized_amount)}</p><p className="mt-2 text-sm text-muted">Распределения на проекты по дате возникновения затрат, после исключения налога по документу. Все проекты компании, независимо от даты обращения.</p><p className="mt-3 text-sm">Ждёт бухгалтера: {data.period_advertising.pending_count} · Нужна повторная сверка: {data.period_advertising.stale_count}</p><details className="mt-3 text-sm"><summary className="cursor-pointer text-brand">Показать основания периода</summary><div className="mt-3 space-y-2">{data.period_advertising.documents.map(d => <p key={d.record_id}>Основание №{d.record_id} · {cash(d.amount)} · {costStates[d.state]}{d.project_ids.map(id => <Link key={id} className="ml-2 text-brand underline" to={projectUrl(id)}>Проект №{id}</Link>)}</p>)}{!data.period_advertising.documents.length && <p className="text-muted">Документы рекламы за период ещё не зарегистрированы.</p>}</div></details></article>
        <article className={box}><h3 className="font-semibold">Что мешает рассчитать окупаемость</h3><p className="mt-3 text-sm">Нет сверенного полного расхода рекламных сервисов и распределения по кампаниям. Поэтому стоимость целевого контакта и ROMI пока не определены.</p><p className="mt-3 text-sm text-muted">Оплата сервиса и остаток на рекламном счёте не заменяют фактический расход. Общую рекламу нельзя автоматически распределить на дома без утверждённого основания.</p></article>
      </div>
      <div className="space-y-4"><h3 className="text-lg font-semibold">Источники обращений и проекты</h3>{data.groups.map((g, index) => <article key={index} className={box}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-all font-semibold">{g.source}{g.campaign && ` · ${g.campaign}`}</h4><p className="mt-1 break-all text-xs text-muted">{g.medium || 'Канал не указан'} · сохранённые UTM-метки</p></div><p className="text-sm">Обращения: {g.requests.length} · Целевые контакты: {g.qualified_unique_contacts} · Сделки: {g.deal_ids.length} · Проекты: {g.projects.length}</p></div>
        {!g.projects.length && <p className="mt-4 text-sm text-muted">Проекты не связаны с этими обращениями. Менеджеру нужно проверить исходное обращение в сделке и связь сметы со сделкой.</p>}
        <div className="mt-4 space-y-3">{g.projects.map(p => <div key={p.id} className="rounded-xl border border-border p-4">
          <Link className="break-words font-medium text-brand hover:underline" to={`/costing?tab=estimates&estimate=${p.id}`}>{p.number || `Смета №${p.id}`} · {p.title}</Link><p className="mt-1 text-xs text-muted">Обращение №{p.request_id} → сделка №{p.deal_id} → проект №{p.id}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted">Признанная реклама проекта</p><p className="mt-1 font-medium">{cash(p.recognized_advertising)}</p></div><div><p className="text-xs text-muted">Утверждённая прибыль</p><p className="mt-1 font-medium">{cash(p.actual_profit)}</p></div><div><p className="text-xs text-muted">Маржа · минимум 35%</p><p className={`mt-1 font-medium ${p.below_target ? 'text-danger' : ''}`}>{p.actual_margin_percent === null ? 'Не подтверждена' : `${p.actual_margin_percent}%`}</p></div></div>
          <p className={`mt-3 text-sm ${p.complete ? 'text-brand' : 'text-muted'}`}>{states[p.closure_state] || p.closure_state}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Документы и что проверить</summary><div className="mt-3 space-y-3">{p.issues.map(issue => <p key={issue} className="text-amber-800">{issue}</p>)}{p.advertising_documents.map(d => <div key={d.record_id} className="rounded-lg bg-surface-muted p-3"><p className="flex items-start gap-2"><FileText size={16} className="mt-0.5 shrink-0" /><span className="break-all">{d.filename} · {cash(d.amount)}</span></p><p className="mt-2">{costStates[d.state]} · {d.incurred_on}{d.checked_by && ` · ${d.checked_by}`}</p><p className="mt-2">{d.locator} · {d.allocation_basis.join('; ')}</p><p className="mt-2 text-muted">{d.tax_basis}</p><p className="mt-2 break-all text-xs text-muted">SHA-256 файла: {d.sha256} · версия {d.version}</p></div>)}{!p.advertising_documents.length && <p className="text-muted">Расход рекламы документами пока не подтверждён.{p.complete && ' Отсутствие этой статьи проверено при закрытии проекта.'}</p>}<Link className="inline-block text-brand underline" to={projectUrl(p.id)}>Открыть затраты и сканы проекта</Link><p className="break-all text-xs text-muted">Снимок расчёта: {p.source_hash}</p></div></details>
        </div>)}</div>
      </article>)}{!data.groups.length && <p className={box}>За период нет сохранённых обращений сайта. Это не означает отсутствие звонков или отклика на рекламу.</p>}</div>
      {(data.unlinked_projects_all_time.length > 0 || data.invalid_deal_ids.length > 0) && <details className={box}><summary className="cursor-pointer font-medium">Проверить связи: {data.unlinked_projects_all_time.length} проектов вне отчёта · {data.invalid_deal_ids.length} ошибок сделок</summary><p className="mt-3 text-sm text-muted">Все действующие проекты без корректной связи с обращением; период обращения для них не определён. Система не угадывает источник по имени клиента.</p><div className="mt-3 space-y-2 text-sm">{data.unlinked_projects_all_time.map(p => <p key={p.id}><Link className="text-brand underline" to={`/costing?tab=estimates&estimate=${p.id}`}>Смета №{p.id}</Link> · {p.reason}</p>)}{data.invalid_deal_ids.map(id => <p key={id}>Сделка №{id}: клиент не совпадает с исходным обращением.</p>)}</div></details>}
      <details className={box}><summary className="cursor-pointer text-sm font-medium">Как считается отчёт</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">{data.limitations.map(text => <li key={text}>{text}</li>)}</ul><p className="mt-3 break-all text-xs text-muted">Контрольный отпечаток: {data.source_hash}. Отпечаток описывает текущие данные; это не неизменяемый архив отчётов.</p></details>
    </>}
  </section>
}
