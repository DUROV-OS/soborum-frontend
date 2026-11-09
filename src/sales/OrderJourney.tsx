import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Circle, RefreshCw, Route, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import type { SectionId } from '@/shared/sections'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

type Purchase = { title?: string; unit?: string; id: number; number: string; quantity: string; fresh: boolean; material_id: number; supplier_order_id: number; supplier_line: number; expected_at: string | null; receipts: { id: number; number: string; quantity: string; local_stock_posted: boolean }[] }
type JourneyLine = {
  index: number; title: string; unit: string; quantity: string; shipped: string; remaining: string; reserved: string; free_for_line: string; shortage: string; stock_tracked: boolean
  estimate: null | { id: number; number: string; revision: number; approved: boolean; fresh: boolean; stages: { stage: string; person: string; approved: boolean; signoff_id: number | null }[] }
  quote_href: string; recipe: null | { id: number; title: string; valid: boolean; completed_fraction: string; runs: { id: number; issue_operation_id: number; receipt_operation_id: number }[] }
  materials: { id: number; title: string; unit: string; norm: string; remaining: string; available: string; shortage: string }[]
  purchases: Purchase[]; shipments: { id: number; number: string; status: string; historical: boolean; quantity: string; operation_id: number | null }[]
  next: { code: string; title: string; responsible: string; href: string | null; section: SectionId | null }; warnings: string[]; can_allocate: boolean
}
type Journey = { order_id: number; number: string; version: number; status: string; archived: boolean; expected_at: string | null; overdue: boolean; as_of: string; source_hash: string; note: string; lines: JourneyLine[]; can_release: boolean }
type SupplyOption = { supplier_order_id: number; supplier_line: number; supplier_version: number; number: string; material_id: number; title: string; unit: string; available_quantity: string; expected_at: string | null }
const call = <T,>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) => apiRequest<T>({ section: 'sales', path, method, body })
const qty = (n: string) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 })
const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось проверить маршрут заказа'
const stages: Record<string, string> = { production: 'Состав и работы', accounting: 'Расходы и документы', director: 'Цена и маржа' }
const statuses: Record<string, string> = { draft: 'Черновик', posted: 'Проведена', cancelled: 'Отменена' }

export function OrderJourney({ orderId, version, onChanged }: { orderId: number; version?: number; onChanged?: () => void }) {
  const [data, setData] = useState<Journey | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [allocating, setAllocating] = useState<JourneyLine | null>(null), [releasing, setReleasing] = useState<Purchase | null>(null)
  const seq = useRef(0), hasAccess = useAuthStore(s => s.hasAccess)
  const load = useCallback(async () => {
    const token = ++seq.current; setBusy(true); setData(null); setError('')
    try { const result = await call<Journey>(`/orders/${orderId}/journey`); if (!result || result.order_id !== orderId || !Array.isArray(result.lines)) throw new Error('Сервер не вернул проверяемый маршрут заказа. Обновите страницу и повторите проверку.'); if (token === seq.current) setData(result) }
    catch (e) { if (token === seq.current) setError(message(e)) }
    finally { if (token === seq.current) setBusy(false) }
  }, [orderId])
  useEffect(() => { void load(); return () => { seq.current++ } }, [load, version])
  function saved() { setAllocating(null); setReleasing(null); void load(); onChanged?.() }
  return <section aria-label="Маршрут заказа" className="space-y-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Route size={20} className="text-brand" /><h3 className="text-base font-semibold">Маршрут заказа</h3></div><Button variant="ghost" size="sm" disabled={busy} onClick={() => void load()} aria-label="Обновить маршрут"><RefreshCw size={15} /></Button></div>
    {busy && <p role="status" className="text-sm text-muted">Сверяем сметы, резервы и документы…</p>}
    {error && <div role="alert" className="rounded-xl border border-danger/30 p-4 text-sm text-danger">{error}<p className="mt-2">Статусы скрыты до успешной повторной проверки.</p><Button className="mt-3" variant="secondary" onClick={() => void load()}>Повторить проверку</Button></div>}
    {data && <>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>Срок: {data.expected_at || 'не указан'}{data.overdue && <strong className="ml-2 text-danger">Просрочен</strong>}</span><span>Сверено {new Date(data.as_of).toLocaleString('ru-RU')}</span></div>
      {data.lines.map(line => <article key={line.index} className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border bg-surface-muted p-4"><p className="text-xs text-muted">Позиция {line.index + 1} · {qty(line.quantity)} {line.unit}</p><h4 className="mt-1 break-words text-base font-semibold">{line.title}</h4>
          <div className={`mt-4 rounded-xl border p-3 ${line.next.code === 'shipped' ? 'border-brand/30 bg-brand/5' : 'border-border bg-surface'}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{line.next.code === 'shipped' ? 'Исполнение' : 'Следующее действие'}</p><p className="mt-1 font-medium">{line.next.title}</p><p className="mt-1 text-xs text-muted">Ответственный: {line.next.responsible}</p>
            {line.next.href && line.next.section && hasAccess(line.next.section) && <Link className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-brand" to={line.next.href}>Перейти к действию <ArrowUpRight size={15} /></Link>}
          </div>
        </div>
        <div className="space-y-5 p-4 text-sm">
          <div><p className="font-semibold">1. Согласование расчёта</p>{line.estimate ? <>
            {hasAccess('estimates') ? <Link className="mt-2 inline-block text-brand" to={line.quote_href}>{line.estimate.number || `Смета №${line.estimate.id}`} · версия {line.estimate.revision}</Link> : <p className="mt-2">Смета №{line.estimate.id} · версия {line.estimate.revision}</p>}
            <ul className="mt-3 space-y-2">{line.estimate.stages.map(s => <li key={s.stage} className="flex items-start gap-2">{s.approved && line.estimate?.fresh ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted" />}<span>{stages[s.stage]}<span className="block text-xs text-muted">{s.person}{s.approved && line.estimate?.fresh ? ` · согласование №${s.signoff_id}` : ' · требуется проверка'}</span></span></li>)}</ul>
          </> : <p className="mt-2 text-muted">Утверждённая смета не связана с этой строкой.</p>}</div>
          <div className="border-t border-border pt-4"><p className="font-semibold">2. Обеспечение и производство</p>
            {line.stock_tracked ? <><dl className="mt-3 grid grid-cols-2 gap-3"><Metric label="В резерве заказа" value={`${qty(line.reserved)} ${line.unit}`} /><Metric label="Свободно для строки" value={`${qty(line.free_for_line)} ${line.unit}`} /><Metric label="Осталось отгрузить" value={`${qty(line.remaining)} ${line.unit}`} /><Metric label="Не обеспечено остатком" value={`${qty(line.shortage)} ${line.unit}`} /></dl><p className="mt-2 text-xs text-muted">Свободный остаток ещё не закреплён. Общий товар распределён между строками один раз.</p></> : <p className="mt-2 text-muted">Услуга: складской резерв не требуется.</p>}
            {line.recipe && <div className="mt-3 rounded-lg bg-surface-muted p-3">{hasAccess('recipes') ? <Link className="font-medium text-brand" to={`/recipes?recipe=${line.recipe.id}`}>Норматив №{line.recipe.id}</Link> : <p>Норматив №{line.recipe.id}</p>}<p className="mt-1 text-xs text-muted">{line.recipe.title}</p><p className="mt-2">{line.recipe.valid ? `Подтверждено выпуском: ${qty(String(Number(line.recipe.completed_fraction) * 100))}% норматива` : 'Нужна сверка норматива и выпуска'}</p>{line.recipe.runs.map(r => <p key={r.id} className="mt-1 text-xs text-muted">Выпуск №{r.id} · выдача №{r.issue_operation_id} → приход №{r.receipt_operation_id}</p>)}</div>}
            {line.materials.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-medium">Материалы для оставшегося выпуска</summary><ul className="mt-2 divide-y divide-border">{line.materials.map(m => <li key={m.id} className="py-2"><p>{m.title}</p><p className="mt-1 text-xs text-muted">Нужно {qty(m.remaining)} {m.unit} · свободно {qty(m.available)} · <span className={Number(m.shortage) > 0 ? 'text-danger' : ''}>не хватает {qty(m.shortage)}</span></p></li>)}</ul></details>}
            {line.purchases.map(p => <div key={p.id} className="mt-3 rounded-lg border border-border p-3"><p className="font-medium">Закупка №{p.number}, строка {p.supplier_line + 1}</p><p className="mt-1">{p.title} · закреплено: {qty(p.quantity)} {p.unit} · {p.fresh ? 'основание актуально' : 'нужна повторная сверка'}</p><p className="mt-1 text-xs text-muted">Срок поставки: {p.expected_at || 'не указан'}</p>{p.receipts.map(r => <p key={r.id} className="mt-2 text-xs text-muted">Приёмка №{r.number || r.id}: {qty(r.quantity)} по всей строке закупки{!r.local_stock_posted && ' · перенесённая история'}</p>)}{!p.receipts.length && <p className="mt-2 text-xs text-muted">Документов приёмки по этой строке пока нет.</p>}{data.can_release && <Button variant="ghost" size="sm" className="mt-2" onClick={() => setReleasing(p)}>Снять закрепление</Button>}</div>)}
            {line.can_allocate && <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAllocating(line)}>Связать с закупкой</Button>}
          </div>
          <div className="border-t border-border pt-4"><p className="font-semibold">3. Отгрузка и результат</p><p className="mt-2">Отгружено: {qty(line.shipped)} из {qty(line.quantity)} {line.unit}</p>{line.shipments.map(s => <p key={s.id} className="mt-2 text-xs">{hasAccess('sales') ? <Link className="text-brand" to={`/sales?tab=shipments&shipment=${s.id}`}>Отгрузка №{s.number}</Link> : <span>Отгрузка №{s.number}</span>} · {statuses[s.status] || s.status} · {qty(s.quantity)} {line.unit}{s.historical && ' · история'}{s.operation_id && ` · операция №${s.operation_id}`}</p>)}{line.estimate && hasAccess('accounting') && <Link className="mt-3 inline-block text-brand" to={`/accounting?tab=costs&project=${line.estimate.id}`}>Затраты и финансовое закрытие →</Link>}<p className="mt-2 text-xs text-muted">Отгрузка не означает оплату или утверждённую прибыль.</p></div>
          {line.warnings.length > 0 && <div className="rounded-lg bg-surface-muted p-3"><div className="flex items-center gap-2 font-medium"><AlertCircle size={15} />Что проверить</div><ul className="mt-2 list-disc space-y-2 pl-5 text-xs text-muted">{line.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
        </div>
      </article>)}
      <p className="text-xs leading-relaxed text-muted">{data.note}</p>
      {allocating && <AllocationDialog order={data} line={allocating} onClose={() => setAllocating(null)} onSaved={saved} />}
      {releasing && <ReleaseDialog order={data} purchase={releasing} onClose={() => setReleasing(null)} onSaved={saved} />}
    </>}
  </section>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-surface-muted p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div> }

function AllocationDialog({ order, line, onClose, onSaved }: { order: Journey; line: JourneyLine; onClose: () => void; onSaved: () => void }) {
  const [options, setOptions] = useState<SupplyOption[]>([]), [loading, setLoading] = useState(true), [choice, setChoice] = useState(''), [quantity, setQuantity] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [key, setKey] = useState(() => crypto.randomUUID())
  const selected = options.find(o => `${o.supplier_order_id}:${o.supplier_line}` === choice), value = Number(quantity.replace(',', '.'))
  const valid = !!selected && quantity.trim() && Number.isFinite(value) && value > 0 && value <= Number(selected.available_quantity)
  useEffect(() => { let active = true; call<SupplyOption[]>(`/orders/${order.order_id}/supply-options?order_line=${line.index}`).then(r => { if (active) setOptions(r) }).catch(e => { if (active) setError(message(e)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [order.order_id, line.index])
  async function save() { if (!selected || !valid) return; setBusy(true); setError(''); try { await call(`/orders/${order.order_id}/supply-allocations`, 'POST', { request_id: key, version: order.version, order_line: line.index, supplier_order_id: selected.supplier_order_id, supplier_version: selected.supplier_version, supplier_line: selected.supplier_line, quantity: quantity.replace(',', '.') }); onSaved() } catch (e) { setError(message(e)) } finally { setBusy(false) } }
  return <Modal open title="Закупка для заказа" onClose={() => { if (!busy) onClose() }} footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Закрыть</Button><Button disabled={busy || !valid} onClick={() => void save()}>Закрепить количество</Button></>}><div className="space-y-4 text-sm"><p>{line.title}</p><p className="text-muted">Выберите существующий заказ поставщику. Позиция должна точно совпадать с изделием или материалом норматива. Оплата и складские движения выполняются отдельно.</p>{loading ? <p role="status">Проверяем свободные позиции закупок…</p> : !options.length ? <p>Нет подходящих свободных позиций. Создайте закупку с привязкой к складской номенклатуре или проверьте ранее закреплённые количества.</p> : <><Field label="Позиция закупки"><Select aria-label="Позиция закупки" disabled={busy} value={choice} onChange={e => { setChoice(e.target.value); setQuantity(''); setKey(crypto.randomUUID()) }}><option value="">Выберите позицию</option>{options.map(o => <option key={`${o.supplier_order_id}:${o.supplier_line}`} value={`${o.supplier_order_id}:${o.supplier_line}`}>№{o.number} · {o.title} · до {qty(o.available_quantity)} {o.unit}</option>)}</Select></Field><Field label="Количество для этого заказа"><Input aria-label="Количество для этого заказа" inputMode="decimal" disabled={busy} value={quantity} onChange={e => { setQuantity(e.target.value); setKey(crypto.randomUUID()) }} /></Field>{selected && <p className="text-xs text-muted">Можно закрепить до {qty(selected.available_quantity)} {selected.unit} с учётом других заказов и норматива.</p>}</>}{error && <p role="alert" className="text-danger">{error}</p>}</div></Modal>
}

function ReleaseDialog({ order, purchase, onClose, onSaved }: { order: Journey; purchase: Purchase; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [key, setKey] = useState(() => crypto.randomUUID())
  async function save() { setBusy(true); setError(''); try { await call(`/orders/${order.order_id}/supply-allocations/${purchase.id}/release`, 'POST', { request_id: key, version: order.version, reason }); onSaved() } catch (e) { setError(message(e)) } finally { setBusy(false) } }
  return <Modal open title="Снять закрепление закупки" onClose={() => { if (!busy) onClose() }} footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Закрыть</Button><Button disabled={busy || !reason.trim()} onClick={() => void save()}>Снять закрепление</Button></>}><div className="space-y-4 text-sm"><p>Закупка №{purchase.number}. История связи сохранится. Сама закупка, оплаты и складские документы не отменяются.</p><Field label="Причина снятия"><Textarea aria-label="Причина снятия" maxLength={500} value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setKey(crypto.randomUUID()) }} /></Field>{error && <p role="alert" className="text-danger">{error}</p>}</div></Modal>
}
