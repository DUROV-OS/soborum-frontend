import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, FileCheck2, FileText, LockKeyhole, RefreshCw, Upload } from 'lucide-react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { dateLabel, exportFile, money } from './api'
import { Basis, Document, governance, Material, Plan, ProjectReview, Proof, ReviewAccess, ReviewItem, ReviewQueue, stages, stageLabels } from './governance'

const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить действие'
const panel = 'rounded-2xl border border-border bg-surface p-4 sm:p-6'
const number = (value: string | number) => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 8 })
type Selection = { kind: 'estimate' | 'item' | 'month'; id: number }

export function ApprovalsPage() {
  const [params, setParams] = useSearchParams()
  const [access, setAccess] = useState<ReviewAccess | null>(null)
  const [queue, setQueue] = useState<ReviewQueue | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [tab, setTab] = useState<'estimate' | 'item' | 'month'>('estimate')
  const [filter, setFilter] = useState(''), [pending, setPending] = useState(true)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [newPlan, setNewPlan] = useState(false)
  const kind = params.get('kind'), id = Number(params.get('id'))
  const selection: Selection | null = id > 0 && ['estimate', 'item', 'month'].includes(kind ?? '') ? { kind: kind as Selection['kind'], id } : null
  async function refresh() {
    setBusy(true); setError('')
    try {
      const current = await governance<ReviewAccess>('/access')
      setAccess(current)
      const [q, p] = await Promise.all([governance<ReviewQueue>('/queue'), current.financial ? governance<Plan[]>('/month-plans') : Promise.resolve([])])
      setQueue(q); setPlans(p)
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  const open = (kind: Selection['kind'], id: number) => setParams({ kind, id: String(id) })
  const matches = (title: string) => title.toLocaleLowerCase().includes(filter.toLocaleLowerCase())
  const estimates = queue?.estimates.filter(r => matches(r.title + ' ' + r.number) && (!pending || !r.state.director_approved)) ?? []
  const items = queue?.items.filter(r => matches(r.title) && (!pending || !r.production_approved)) ?? []
  const months = plans.filter(r => r.current && matches(r.month) && (!pending || !r.approved))
  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-brand">Контроль расчётов</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Согласования и основания</h1><p className="mt-2 max-w-2xl text-sm text-muted">От проверенного состава до утверждённой цены. У каждого решения — своя версия, ответственный и подтверждение.</p></div><Button variant="secondary" disabled={busy} onClick={refresh}><RefreshCw size={16} />Обновить</Button></header>
    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-surface p-4 text-sm text-danger">{error}</p>}
    {!access && busy && <p role="status">Загружаем порядок согласования…</p>}
    {access && <>
      <ol className="grid gap-3 md:grid-cols-3" aria-label="Порядок согласования">{stages.map((stage, i) => <li className={panel} key={stage}><div className="flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{i + 1}</span>{i < 2 && <ArrowRight size={16} className="text-muted" />}</div><h2 className="mt-3 font-semibold">{stageLabels[stage]}</h2><p className="mt-1 text-sm text-muted">{access.responsible[stage]?.name ?? 'Ответственный не назначен'}</p>{access.stages.includes(stage) && <p className="mt-2 text-xs font-medium text-brand">Ваш этап</p>}</li>)}</ol>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Объекты согласования">{([['estimate', 'Проекты'], ['item', 'Типовые составы'], ...(access.financial ? [['month', 'Месячные расходы']] : [])] as [typeof tab, string][]).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={'rounded-lg px-3 py-2 text-sm font-medium ' + (tab === key ? 'bg-brand text-white' : 'bg-surface-muted text-muted')}>{label}</button>)}</div>{tab === 'month' && access.edit && <Button size="sm" onClick={() => setNewPlan(true)}>Новый план / новая версия</Button>}</div>
        <div className="my-5 flex flex-wrap items-center gap-4"><Input className="max-w-sm" aria-label="Поиск согласования" placeholder={tab === 'month' ? 'Месяц, например 2026-11' : 'Название проекта или изделия'} value={filter} onChange={e => setFilter(e.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} />Только требующие проверки</label></div>
        {tab === 'estimate' && <div className="divide-y divide-border">{estimates.map(row => <QueueRow key={row.id} title={row.title} subtitle={`${row.number || 'Проект №' + row.id} · версия ${row.version}`} status={stageLabels[row.state.next_stage]} approved={row.state.director_approved} onClick={() => open('estimate', row.id)} />)}{!estimates.length && <Empty busy={busy} />}</div>}
        {tab === 'item' && <><p className="mb-3 text-sm text-muted">Согласование типового состава открывает расчёт прайса. Комплектацию каждого проекта производство проверяет отдельно.</p><div className="divide-y divide-border">{items.map(row => <QueueRow key={row.id} title={row.title} subtitle={'Версия ' + row.version} status={row.production_approved ? 'Состав согласован' : 'Проверка производства'} approved={row.production_approved} onClick={() => open('item', row.id)} />)}{!items.length && <Empty busy={busy} />}</div></>}
        {tab === 'month' && <><p className="mb-3 text-sm text-muted">Цех + склад + штат + прочие постоянные расходы, поровну на плановое число изделий. Проект привязывается к месяцу явно.</p><div className="divide-y divide-border">{months.map(row => <QueueRow key={row.id} title={row.month.slice(0, 7)} subtitle={`${money(row.total)} / ${row.content.planned_units} изделий = ${money(row.per_unit)} на изделие · версия ${row.version}`} status={row.approved ? 'План утверждён' : row.accounting_approved ? 'Проверка руководителя' : 'Проверка бухгалтера'} approved={row.approved} onClick={() => open('month', row.id)} />)}{!months.length && <Empty busy={busy} />}</div></>}
      </section>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted"><LockKeyhole size={16} className="shrink-0" />Согласования сохраняются в истории. Контрольная сумма обнаруживает изменение файла; содержание документа лично проверяет ответственный.</p>
      {selection && <ReviewDialog key={selection.kind + selection.id} selection={selection} access={access} plans={plans} onClose={() => setParams({})} onChanged={refresh} />}
      {newPlan && <PlanEditor plans={plans} onClose={() => setNewPlan(false)} onSaved={async row => { setNewPlan(false); await refresh(); open('month', row.id) }} />}
    </>}
  </div>
}

function Empty({ busy }: { busy: boolean }) { return <p role="status" className="py-8 text-center text-sm text-muted">{busy ? 'Обновляем список…' : 'В этом списке пока нет записей. Измените фильтр или создайте расчёт.'}</p> }
function QueueRow({ title, subtitle, status, approved, onClick }: { title: string; subtitle: string; status: string; approved: boolean; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-surface-muted"><span className="min-w-0 flex-1 break-words"><span className="block font-medium">{title}</span><span className="mt-1 block text-xs text-muted">{subtitle}</span></span><span className={'rounded-full px-3 py-1.5 text-xs ' + (approved ? 'bg-brand/10 text-brand' : 'bg-surface-muted text-ink')}>{status}</span><ArrowRight size={16} className="shrink-0 text-muted" /></button>
}
function Materials({ rows }: { rows: Material[] }) {
  return <ul className="divide-y divide-border rounded-xl border border-border px-3">{rows.map((row, i) => <li key={i} className="flex items-start justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words">{row.name}</span><span className="shrink-0 font-medium">{number(row.quantity)} {row.unit}</span></li>)}</ul>
}
function Composition({ basis }: { basis: Basis }) {
  return <section className="space-y-2"><h3 className="font-medium">{basis.title}</h3>{basis.source_recipe_id && <p className="text-xs text-muted">Техкарта №{basis.source_recipe_id} · версия {basis.source_recipe_version}</p>}{basis.note && <p className="whitespace-pre-wrap text-sm">{basis.note}</p>}{basis.lines.length > 0 && <Materials rows={basis.lines} />}{basis.replacements.length > 0 && <><p className="text-xs text-muted">Заменяет в базовом составе:</p><Materials rows={basis.replacements} /></>}{basis.members?.map((member, i) => <Composition key={i} basis={member} />)}</section>
}

function ReviewDialog({ selection, access, plans, onClose, onChanged }: { selection: Selection; access: ReviewAccess; plans: Plan[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<ProjectReview | Plan | ReviewItem | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [work, setWork] = useState(''), [reason, setReason] = useState(''), [checked, setChecked] = useState(false)
  const [proofs, setProofs] = useState<Record<string, { document_id: string; locator: string }>>({})
  const [planId, setPlanId] = useState('')
  const path = (selection.kind === 'estimate' ? '/estimates/' : selection.kind === 'item' ? '/items/' : '/month-plans/') + selection.id
  async function load() { const row = await governance<ProjectReview | Plan | ReviewItem>(path); setData(row); setChecked(false); setProofs({}); setWork(''); setReason('') }
  useEffect(() => { load().catch(e => setError(message(e))) }, [path])
  const project = selection.kind === 'estimate' ? data as ProjectReview | null : null
  const plan = selection.kind === 'month' ? data as Plan | null : null
  const item = selection.kind === 'item' ? data as ReviewItem | null : null
  const facts = project?.facts ?? plan?.facts ?? [], docs = project?.documents ?? plan?.documents ?? []
  const history = project?.history ?? plan?.history ?? []
  const financialReview = [...history].reverse().find(row => row.stage === 'accounting' && row.version === data?.version)
  const stage = item ? 'production' : plan ? (plan.approved ? 'complete' : plan.accounting_approved ? 'director' : 'accounting') : project?.state.next_stage
  const ownStage = stage && stage !== 'complete' && access.stages.includes(stage)
  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await fn(); await load(); await onChanged() } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!data || !ownStage || !checked) return
    const evidence: Proof[] = stage === 'accounting' ? facts.map(fact => ({ key: fact.key, value: fact.value ?? '', document_id: Number(proofs[fact.key]?.document_id), locator: proofs[fact.key]?.locator ?? '' })) : []
    await action(() => governance(path + '/' + stage, 'POST', { version: data.version, request_id: crypto.randomUUID(), reason, work_scope: work, evidence }))
  }
  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) { setError('Документ должен быть не больше 20 МБ'); return }
    const form = new FormData(); form.append('file', file)
    setBusy(true); setError('')
    try {
      await apiRequest({ section: 'costing', path: `/governance/documents/${selection.kind}/${selection.id}`, method: 'POST', form })
      // Refresh attachments without erasing the operator's unfinished document references.
      setData(await governance(path))
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <Modal open title={item?.title ?? project?.title ?? (plan ? 'Расходы · ' + plan.month.slice(0, 7) : 'Согласование')} width="max-w-4xl" onClose={onClose}><div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-surface-muted p-3 text-sm text-danger">{error}</p>}
    {!data && <p role="status">Загружаем основание…</p>}
    {data && <><div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted">Версия {data.version}{project && ` · ${number(project.quantity)} изделий`}</span><span className="rounded-full bg-brand/10 px-3 py-1.5 text-brand">{item?.production_approved ? 'Состав согласован' : stage ? stageLabels[stage] : ''}</span></div>
      {project && <ol className="grid gap-2 sm:grid-cols-3" aria-label="Состояние проекта">{stages.map((key, i) => <li key={key} className={'rounded-lg border p-3 text-xs ' + (project.state[`${key}_approved`] ? 'border-brand/30 bg-brand/5 text-brand' : 'border-border text-muted')}><span className="flex items-center gap-2">{project.state[`${key}_approved`] ? <Check size={14} /> : `${i + 1}.`} {stageLabels[key]}</span></li>)}</ol>}
      {project?.state.issues?.length ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h3 className="font-medium">Что нужно завершить</h3><ul className="mt-2 list-disc space-y-1 pl-4">{project.state.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></section> : null}
      {item && <Composition basis={item.basis} />}
      {project && <section className="space-y-3"><h3 className="font-semibold">Материалы на весь проект</h3><Materials rows={project.bom} />{project.note && <p className="whitespace-pre-wrap text-sm">{project.note}</p>}{project.technical_basis && <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm">Исходные составы и технологические примечания</summary><div className="mt-3 space-y-5">{project.technical_basis.parts.map((part, i) => <Composition key={i} basis={part.item} />)}</div></details>}</section>}
      {project?.result && <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Цена', money(project.result.price)], ['Полная себестоимость', money(project.result.cost)], ['Прибыль', money(project.result.profit)], ['Маржа · минимум 35%', project.result.margin_percent == null ? '—' : number(project.result.margin_percent) + '%']].map(([label, value]) => <div className="rounded-xl bg-surface-muted p-3" key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 break-words text-lg font-semibold">{value}</p></div>)}</section>}
      {project && access.financial && <section className="space-y-3 rounded-xl border border-border p-4"><h3 className="font-semibold">Постоянные расходы</h3>{project.overhead_plan ? <p className="text-sm">{project.overhead_plan.month.slice(0, 7)} · {money(project.overhead_plan.total)} / {project.overhead_plan.content.planned_units} изделий = {money(project.overhead_plan.per_unit)} на изделие</p> : <p className="text-sm text-muted">Утверждённый месячный план пока не выбран.</p>}{access.edit && <div className="flex flex-wrap gap-2"><Select aria-label="Месячный план проекта" value={planId} onChange={e => setPlanId(e.target.value)} className="min-w-0 flex-1"><option value="">Выберите утверждённый месяц…</option>{plans.filter(p => p.approved && p.current).map(p => <option key={p.id} value={p.id}>{p.month.slice(0, 7)} · {money(p.per_unit)} / изделие · v{p.version}</option>)}</Select><Button size="sm" variant="secondary" disabled={busy || !planId} onClick={() => action(() => governance(path + '/overhead-plan', 'PUT', { version: data.version, plan_id: Number(planId) }))}>Привязать план</Button></div>}<p className="text-xs text-muted">Привязка создаёт новую версию расчёта. После неё бухгалтер и руководитель проверяют итог заново.</p></section>}
      {plan && <section className="rounded-xl bg-surface-muted p-4"><p className="text-lg font-semibold">{money(plan.total)} / {plan.content.planned_units} изделий = {money(plan.per_unit)}</p><p className="mt-1 text-sm text-muted">Постоянные расходы на одно изделие</p><p className="mt-3 whitespace-pre-wrap text-sm">{plan.content.note}</p>{!plan.current && <p className="mt-3 text-danger">Есть более новая версия месяца. Эта версия сохранена в истории.</p>}</section>}
      {access.financial && !item && <section className="space-y-3"><h3 className="flex items-center gap-2 font-semibold"><FileText size={18} />Документы и сканы</h3>{docs.map(doc => <DocumentRow key={doc.id} doc={doc} onError={setError} />)}{!docs.length && <p className="text-sm text-muted">Документы ещё не приложены.</p>}{access.edit && <label className="block rounded-xl border border-dashed border-border p-4 text-sm"><span className="flex items-center gap-2 font-medium"><Upload size={16} />Прикрепить документ</span><input aria-label="Прикрепить документ" className="mt-3 max-w-full text-xs" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = '' }} /><span className="mt-2 block text-xs text-muted">PDF, PNG, JPEG или WEBP, до 20 МБ. Файл получает контрольную сумму при загрузке.</span></label>}</section>}
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {facts.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Основание каждого числа</h3><p className="text-xs text-muted">Включая нулевые расходы и процентные ставки. Значения берутся из этой версии расчёта.</p>{facts.map(fact => <div key={fact.key} className="space-y-3 rounded-xl border border-border p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{fact.label}</span><strong>{fact.value == null ? 'Не указано' : number(fact.value)} {fact.unit}</strong></div>{ownStage && stage === 'accounting' && <div className="grid gap-2 sm:grid-cols-2"><Select aria-label={'Документ: ' + fact.label} required value={proofs[fact.key]?.document_id ?? ''} onChange={e => setProofs(old => ({ ...old, [fact.key]: { locator: old[fact.key]?.locator ?? '', document_id: e.target.value } }))}><option value="">Документ-основание…</option>{docs.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</Select><Input aria-label={'Страница и строка: ' + fact.label} required minLength={3} placeholder="Страница 2, строка 8" value={proofs[fact.key]?.locator ?? ''} onChange={e => setProofs(old => ({ ...old, [fact.key]: { document_id: old[fact.key]?.document_id ?? '', locator: e.target.value } }))} /></div>}</div>)}</section>}
        {ownStage && !(item?.production_approved) && plan?.current !== false && <section className="space-y-4 rounded-xl border border-brand/30 bg-brand/5 p-4"><h3 className="flex items-center gap-2 font-semibold"><FileCheck2 size={18} />Ваше согласование</h3>{stage === 'production' && <Field label="Согласованный состав работ и условия производства"><Textarea aria-label="Состав работ" required minLength={5} value={work} onChange={e => setWork(e.target.value)} placeholder="Укажите работы, технологические условия и ограничения для этого состава" /></Field>}<Field label="Комментарий к решению"><Textarea aria-label="Комментарий к решению" required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></Field><label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" required checked={checked} onChange={e => setChecked(e.target.checked)} /><span>{stage === 'accounting' ? 'Лично сверил(а) каждое число и процент с указанным документом и строкой.' : stage === 'production' ? 'Лично проверил состав, количества материалов и указанные работы.' : 'Проверил(а) основания и принимаю эту версию расчёта.'}</span></label><Button type="submit" disabled={!checked || (stage === 'accounting' && (!facts.length || facts.some(f => f.value == null)))}>{busy ? 'Сохраняем…' : stage === 'production' ? 'Согласовать состав и работы' : stage === 'accounting' ? 'Подтвердить суммы и документы' : plan ? 'Утвердить месячный план' : 'Утвердить цену'}</Button></section>}
        {!ownStage && stage && stage !== 'complete' && <p className="rounded-xl bg-surface-muted p-4 text-sm">Следующий шаг выполняет {access.responsible[stage]?.name ?? 'ещё не назначенный ответственный'}: {stageLabels[stage].toLocaleLowerCase()}.</p>}
      </fieldset></form>
      {financialReview && <section className="space-y-3 rounded-xl border border-brand/20 p-4"><h3 className="font-semibold">Что проверил бухгалтер</h3><p className="text-xs text-muted">{financialReview.actor} · {dateLabel(financialReview.created_at)} · версия {financialReview.version}</p>{financialReview.evidence?.map(proof => <div key={proof.key} className="border-t border-border pt-3 text-sm"><p className="font-medium">{facts.find(f => f.key === proof.key)?.label ?? proof.key}: {number(proof.value)}</p><p className="mt-1 break-words text-xs text-muted">{proof.title} · {proof.locator}</p></div>)}</section>}
      {history.length > 0 && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">История решений · {history.length}</summary><ol className="mt-4 space-y-4">{history.map(entry => <li key={entry.id} className="border-l-2 border-brand/30 pl-3 text-sm"><p className="font-medium">{stageLabels[entry.stage]} · версия {entry.version}</p><p className="mt-1 text-xs text-muted">{entry.actor} · {dateLabel(entry.created_at)}</p><p className="mt-2 whitespace-pre-wrap">{entry.reason}</p>{entry.work_scope && <p className="mt-2 whitespace-pre-wrap">Работы: {entry.work_scope}</p>}{entry.evidence?.map(proof => <p key={proof.key} className="mt-1 break-words text-xs text-muted">{facts.find(f => f.key === proof.key)?.label ?? proof.key} = {proof.value} · {proof.title} · {proof.locator}</p>)}</li>)}</ol></details>}
      {project && access.financial && <Link className="inline-flex text-sm font-medium text-brand underline" to={'/costing?tab=estimates&estimate=' + project.id}>Открыть редактор сметы</Link>}
    </>}
  </div></Modal>
}

function DocumentRow({ doc, onError }: { doc: Document; onError: (value: string) => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-surface-muted p-3"><div className="min-w-0 flex-1"><p className="break-words text-sm">{doc.title}</p><p className="mt-1 break-all font-mono text-[10px] text-muted" title={doc.sha256}>SHA-256 · {doc.sha256}</p></div><Button size="sm" variant="secondary" onClick={() => exportFile(`/governance/documents/${doc.id}/download`, doc.filename ?? doc.title).catch(e => onError(message(e)))}>Открыть файл</Button></div>
}

function PlanEditor({ plans, onClose, onSaved }: { plans: Plan[]; onClose: () => void; onSaved: (plan: Plan) => Promise<void> }) {
  const [month, setMonth] = useState(''), [units, setUnits] = useState(''), [values, setValues] = useState({ factory: '', warehouse: '', staff: '', other: '' }), [note, setNote] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const previous = plans.find(p => p.month === month + '-01' && p.current)
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const row = await governance<Plan>('/month-plans', 'POST', { month: month + '-01', previous_version: previous?.version ?? 0, planned_units: Number(units), ...values, note }); await onSaved(row) } catch (e) { setError(message(e)) } finally { setBusy(false) } }
  return <Modal open title="Месячный план постоянных расходов" onClose={onClose}><form onSubmit={submit} className="space-y-4"><p className="text-sm text-muted">Это черновик. Для применения к проектам нужны документы, проверка бухгалтера и утверждение руководителя.</p><fieldset disabled={busy} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Календарный месяц"><Input aria-label="Календарный месяц" type="month" required value={month} onChange={e => setMonth(e.target.value)} /></Field><Field label="Плановое число изделий"><Input aria-label="Плановое число изделий" type="number" min="1" step="1" required value={units} onChange={e => setUnits(e.target.value)} /></Field></div>{previous && <p className="text-sm text-amber-800">Будет создана версия {previous.version + 1}. Расчёты с прежним месячным планом потребуют обновления и повторной проверки.</p>}<div className="grid gap-3 sm:grid-cols-2">{([['factory', 'Цех'], ['warehouse', 'Склад'], ['staff', 'Штатные сотрудники'], ['other', 'Прочие постоянные расходы']] as const).map(([key, label]) => <Field key={key} label={label + ', ₽ за месяц'}><Input aria-label={label} type="number" min={key === 'factory' || key === 'staff' ? '0.01' : '0'} step="0.01" required value={values[key]} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))} /></Field>)}</div><Field label="Что входит в план"><Textarea aria-label="Что входит в план" required value={note} onChange={e => setNote(e.target.value)} /></Field><Button type="submit">{busy ? 'Сохраняем…' : 'Создать черновик плана'}</Button></fieldset>{error && <p role="alert" className="text-danger">{error}</p>}</form></Modal>
}
