import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, RefreshCw, History } from 'lucide-react'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { PurchaseEvidenceForm, SupplierTrustForm, MarketOfferForm, SupplierDocumentUpload } from './PurchaseControlForms'

export type Doc = { id: number; filename: string }
export type Citation = { file_id: number; locator: string }
export type Terms = { vat: string; vat_rate: string; delivery_per_unit: string; destination: string; payment_terms: string; min_quantity: string; max_quantity: string; evidence: Citation }
export type PriceInput = { number: string; document_date: string; valid_until: string; receipt_id: number | null; receipt_evidence: Citation | null; lines: (Terms & { index: number })[] }
export type Review = {
  order_id: number; supplier_id: number; supplier_name: string; currency: string; version: number; fingerprint: string
  decision: 'manual_review' | 'eligible' | 'auto_approved'; reasons: { code: string; message: string }[]
  trust: { id: number; verified: boolean }; price: { id: number; verified: boolean; request: PriceInput | null }
  approval_id: number | null; previous_approval_id: number | null; documents: Doc[]
  permissions: { accounting: boolean; director: boolean }; people: { accounting: string; director: string }; payment_blockers: string[]
  lines: { index: number; title: string; material_id: number | null; unit: string; quantity: string; unit_price: string; delivered_unit_price: string | null
    previous: { order_id?: number; number?: string; receipt_id: number; delivered_unit_price?: string } | null
    targets: { order_id: number; number: string; quantity: string; estimate_id: number; recipe_id: number }[]
    issues: string[]; market_review_due: boolean
    offers: { id: number; supplier_id: number; supplier: string; delivered_unit_price: string; valid_until: string; document_date: string; evidence: Citation }[] }[]
}
export const call = <T,>(path: string, body?: unknown) => apiRequest<T>({ section: 'purchasing', path, method: body === undefined ? 'GET' : 'POST', body })
export const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить действие'
export const amount = (n: string | null | undefined, currency: string) => n == null ? 'Нет подтверждения' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 6 }) + ' ' + currency

export function AutomaticReview({ orderId, orderVersion, canEdit }: { orderId: number; orderVersion: number; canEdit: boolean }) {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [form, setForm] = useState<'price' | 'trust' | 'offer' | null>(null)
  const [history, setHistory] = useState<{ id: number; kind: string; actor: string; created_at: string }[] | null>(null)
  const reload = () => { setForm(null); setHistory(null); setRevision(v => v + 1) }
  useEffect(() => {
    let active = true
    setReview(null); setForm(null); setHistory(null)
    call<Review>(`/orders/${orderId}/automatic-review`)
      .then(value => { if (active) setReview(value) }).catch(e => { if (active) setError(message(e)) })
    return () => { active = false }
  }, [orderId, orderVersion, revision])
  const approve = async () => {
    if (!review) return
    setBusy(true); setError('')
    try { await call(`/orders/${orderId}/automatic-approval`, { request_id: crypto.randomUUID(), fingerprint: review.fingerprint }); reload() }
    catch (e) { setError(message(e)); setRevision(v => v + 1) }
    finally { setBusy(false) }
  }
  const labels = { manual_review: 'Нужны подтверждения', eligible: 'Условия выполнены', auto_approved: 'Закупка согласована по правилам' }
  const download = (sid: number, fid: number, name: string) => void downloadFile('purchasing', `/suppliers/${sid}/documents/${fid}`, name).catch(e => setError(message(e)))
  return <section className="space-y-4 rounded-2xl border border-border bg-surface-muted p-4" aria-label="Контроль закупки">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={20} />Контроль закупки</h3><Button variant="ghost" className="min-h-11" onClick={() => { setError(''); reload() }} disabled={busy}><RefreshCw size={16} />Обновить проверку</Button></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!review ? <p role="status" className="text-sm text-muted">{error ? 'Проверка недоступна. Повторите загрузку.' : 'Сверяем документы и связи…'}</p> : <>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className={`font-semibold ${review.decision === 'manual_review' ? 'text-warning' : 'text-brand-dark'}`}>{labels[review.decision]}</p>
        <p className="mt-1 text-sm text-muted">{review.approval_id ? `Решение №${review.approval_id}. Основания актуальны.` : 'Поставщик → документы и цена → согласованная продажа → норма техкарты.'}</p>
        {!!review.previous_approval_id && !review.approval_id && <p className="mt-2 text-sm text-warning">Прошлое решение №{review.previous_approval_id} требует повторной проверки.</p>}
        {!!review.reasons.length && <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{review.reasons.map(r => <li key={r.code}>{r.message}</li>)}</ul>}
        {review.decision === 'eligible' && canEdit && <Button className="mt-4 min-h-11 h-auto py-3" disabled={busy} onClick={() => void approve()}>Проверить и зафиксировать согласование</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface p-3"><p className="text-sm font-medium">Поставщик: {review.trust.verified ? 'проверен' : 'требует проверки'}</p><p className="mt-1 text-xs text-muted">{review.people.director} · договор и сведения о контрагенте</p>
          {canEdit && review.permissions.director && <Button variant="secondary" className="mt-3 min-h-11" onClick={() => setForm(form === 'trust' ? null : 'trust')}>Статус поставщика</Button>}</div>
        <div className="rounded-xl bg-surface p-3"><p className="text-sm font-medium">Цена: {review.price.verified ? 'документы проверены' : 'нужны документы'}</p><p className="mt-1 text-xs text-muted">{review.people.accounting} · цена, НДС, доставка и партия</p>
          {canEdit && review.permissions.accounting && <Button variant="secondary" className="mt-3 min-h-11" onClick={() => setForm(form === 'price' ? null : 'price')}>Проверить цены</Button>}</div>
      </div>
      {form === 'trust' && <SupplierTrustForm review={review} done={reload} />}
      {form === 'price' && <PurchaseEvidenceForm review={review} done={reload} />}
      {review.lines.map(line => <article key={line.index} className="rounded-xl border border-border bg-surface p-4">
        <p className="font-medium">{line.title}</p><p className="text-xs text-muted">{line.quantity} {line.unit} · строка {line.index + 1}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm"><div><dt className="text-muted">Сейчас с доставкой / ед.</dt><dd className="font-semibold">{amount(line.delivered_unit_price, review.currency)}</dd></div><div><dt className="text-muted">Последняя закупка / ед.</dt><dd className="font-semibold">{amount(line.previous?.delivered_unit_price, review.currency)}</dd>
          {line.previous?.order_id && <a className="mt-1 inline-block min-h-11 py-2 text-xs text-brand-dark underline" href={`/purchasing?order=${line.previous.order_id}`}>Заказ {line.previous.number} · приёмка №{line.previous.receipt_id}</a>}</div></dl>
        {line.targets.map((target, i) => <Link key={i} className="mt-2 block min-h-11 py-2 text-sm text-brand-dark underline" to={`/sales?order=${target.order_id}`}>Продажа {target.number} · {target.quantity} {line.unit} · техкарта №{target.recipe_id}</Link>)}
        <div className="mt-3 border-t border-border pt-3"><p className="text-sm font-medium">Сравнение рынка</p>
          {line.market_review_due ? <p className="mt-2 text-sm text-warning">Нужно обновить сравнение: нет сопоставимого предложения другого поставщика за последние 14 дней.</p> : <ul className="mt-2 space-y-2 text-sm">{line.offers.map(o => <li key={o.id}><strong>{o.supplier}: {amount(o.delivered_unit_price, review.currency)}</strong><span className="block text-xs text-muted">С доставкой · от {o.document_date}, действует до {o.valid_until}{line.delivered_unit_price && Number(o.delivered_unit_price) < Number(line.delivered_unit_price) ? ' · дешевле текущей закупки' : ''}</span><button className="min-h-11 py-2 text-brand-dark underline" onClick={() => download(o.supplier_id, o.evidence.file_id, 'Предложение поставщика')}>Документ: {o.evidence.locator}</button></li>)}</ul>}</div>
      </article>)}
      {canEdit && review.permissions.accounting && <Button variant="secondary" className="min-h-11 h-auto py-3" onClick={() => setForm(form === 'offer' ? null : 'offer')}>Добавить предложение другого поставщика</Button>}
      {form === 'offer' && <MarketOfferForm review={review} done={reload} />}
      <p className="text-xs text-muted">Сравниваем одинаковые единицы, валюту, НДС, место доставки, условия оплаты и подходящий размер партии. Это не подтверждение минимальной цены на всём рынке.</p>
      <details className="rounded-xl border border-border p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Документы поставщика ({review.documents.length})</summary>
        {review.documents.map(d => <button key={d.id} className="block min-h-11 break-all py-2 text-left text-sm text-brand-dark underline" onClick={() => download(review.supplier_id, d.id, d.filename)}>{d.filename}</button>)}
        {canEdit && <SupplierDocumentUpload supplierId={review.supplier_id} done={reload} />}</details>
      <Button variant="ghost" className="min-h-11" onClick={() => void call<typeof history>(`/orders/${orderId}/control-history`).then(setHistory).catch(e => setError(message(e)))}><History size={16} />История проверок</Button>
      {history && <ol className="space-y-2 text-xs text-muted">{history.length ? history.map(h => <li key={h.id}>№{h.id} · {{ trust: 'Статус поставщика', price: 'Проверка цены', offer: 'Предложение рынка', approval: 'Согласование по правилам' }[h.kind] ?? h.kind} · {h.actor} · {new Date(h.created_at).toLocaleString('ru-RU')}</li>) : <li>Проверок пока нет.</li>}</ol>}
      <p className="rounded-xl border border-border p-3 text-xs text-muted">{review.payment_blockers.join(' ')}</p>
    </>}
  </section>
}
