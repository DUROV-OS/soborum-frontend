import { FormEvent, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select, Textarea } from '@/shared/ui/Field'
import { amount, call, message } from './AutomaticReview'
import type { Citation, Doc, Review, Terms } from './AutomaticReview'

const emptyCitation = (): Citation => ({ file_id: 0, locator: '' })
const emptyTerms = (): Terms => ({ vat: '', vat_rate: '', delivery_per_unit: '', destination: '', payment_terms: '', min_quantity: '', max_quantity: '', evidence: emptyCitation() })
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date())
const frame = 'space-y-4 rounded-xl border border-brand/30 bg-surface p-4'

export function SupplierDocumentUpload({ supplierId, done }: { supplierId: number; done: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      await apiRequest({ section: 'purchasing', path: `/suppliers/${supplierId}/documents`, method: 'POST', form })
      done()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <div className="mt-3 space-y-2"><label className="block text-sm">Добавить документ поставщика<input className="mt-2 block min-h-11 w-full min-w-0 text-xs" aria-label="Добавить документ поставщика" type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
    <p className="text-xs text-muted">PDF или фото до 20 МБ. Загрузка сохраняет файл; цену и условия по нему отдельно подтверждает бухгалтер.</p>
    {busy && <p role="status" className="text-xs text-muted">Загружаем документ…</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>
}

function useSave(done: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const retry = useRef({ json: '', id: '' })
  const save = async (event: FormEvent, path: string, data: unknown) => {
    event.preventDefault()
    if (busy) return
    const json = JSON.stringify({ path, data })
    if (json !== retry.current.json) retry.current = { json, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try { await call(path, { ...(data as object), request_id: retry.current.id }); done() }
    catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  return { busy, error, save }
}

function DocumentInput({ supplierId, value, change, title = 'Документ и место в нём' }: { supplierId: number; value: Citation; change: (v: Citation) => void; title?: string }) {
  const [documents, setDocuments] = useState<Doc[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const currentValue = useRef(value)
  currentValue.current = value
  useEffect(() => {
    let active = true
    setDocuments([])
    call<Doc[]>(`/suppliers/${supplierId}/documents`).then(d => { if (active) setDocuments(old => [...new Map([...old, ...d].map(x => [x.id, x])).values()]) }).catch(e => { if (active) setError(message(e)) })
    return () => { active = false }
  }, [supplierId])
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      const result = await apiRequest<{ file_id: number; filename: string }>({ section: 'purchasing', path: `/suppliers/${supplierId}/documents`, method: 'POST', form })
      setDocuments(d => [...d, { id: result.file_id, filename: result.filename }]); change({ ...currentValue.current, file_id: result.file_id })
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <fieldset className="space-y-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{title}</legend>
    <Field label="Загруженный документ"><Select aria-label={title + ': файл'} required value={value.file_id || ''} onChange={e => change({ ...value, file_id: Number(e.target.value) })}><option value="">Выберите документ</option>{documents.map(d => <option key={d.id} value={d.id}>{d.filename} · №{d.id}</option>)}</Select></Field>
    <label className="block text-xs text-muted">Добавить PDF или фото (до 20 МБ)<input aria-label={title + ': загрузить'} className="mt-2 block min-h-11 w-full min-w-0 text-xs" type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void upload(e.target.files?.[0])} /></label>
    {busy && <p role="status" className="text-xs text-muted">Загружаем документ…</p>}
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    <Field label="Страница, строка, условия"><Input aria-label={title + ': место'} required maxLength={300} value={value.locator} onChange={e => change({ ...value, locator: e.target.value })} placeholder="Страница 1, позиция 3, пункт о доставке" /></Field>
  </fieldset>
}

function TermsFields({ value, change, supplierId }: { value: Terms; change: (v: Terms) => void; supplierId: number }) {
  const field = (key: keyof Omit<Terms, 'evidence'>, label: string, numeric = false) => <Field label={label}><Input required aria-label={label} type={numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : undefined} step={numeric ? 'any' : undefined} min={numeric ? '0' : undefined} maxLength={500} value={value[key]} onChange={e => change({ ...value, [key]: e.target.value })} /></Field>
  return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">
    <Field label="НДС в цене"><Select aria-label="НДС в цене" required value={value.vat} onChange={e => change({ ...value, vat: e.target.value, vat_rate: e.target.value === 'exempt' ? '0' : value.vat_rate })}><option value="">Выберите по документу</option><option value="included">НДС включён в цену</option><option value="exempt">Без НДС</option></Select></Field>
    {field('vat_rate', 'Ставка НДС, %', true)}{field('delivery_per_unit', 'Доставка на единицу, с НДС', true)}{field('destination', 'Место доставки')}
    {field('min_quantity', 'Партия от, ед.', true)}{field('max_quantity', 'Партия до, ед.', true)}
  </div>{field('payment_terms', 'Условия оплаты')}
    <p className="text-xs text-muted">Укажите подтверждённый диапазон партии. В цену доставки включите все сопутствующие расходы на доставку и разгрузку; ноль — только если они включены в цену товара. Цены без включённого применимого НДС требуют ручной сверки заказа.</p>
    <DocumentInput supplierId={supplierId} value={value.evidence} change={evidence => change({ ...value, evidence })} />
  </div>
}

export function SupplierTrustForm({ review, done }: { review: Review; done: () => void }) {
  const [trusted, setTrusted] = useState(true), [reason, setReason] = useState(''), [evidence, setEvidence] = useState(emptyCitation)
  const { busy, error, save } = useSave(done)
  return <form className={frame} aria-label="Проверка поставщика" onSubmit={e => void save(e, `/suppliers/${review.supplier_id}/trust`, { expected_id: review.trust.id, trusted, reason, evidence })}>
    <h4 className="font-medium">Проверка поставщика · {review.supplier_name}</h4><fieldset disabled={busy} className="space-y-3">
      <Field label="Решение"><Select aria-label="Решение о поставщике" value={String(trusted)} onChange={e => setTrusted(e.target.value === 'true')}><option value="true">Подтвердить проверенного поставщика</option><option value="false">Отозвать статус проверенного</option></Select></Field>
      <Field label="Что проверено / причина"><Textarea aria-label="Причина решения" required minLength={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <DocumentInput supplierId={review.supplier_id} value={evidence} change={setEvidence} title="Основание статуса поставщика" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="min-h-11 h-auto py-3">Сохранить личное решение</Button>
    </fieldset>
  </form>
}

export function PurchaseEvidenceForm({ review, done }: { review: Review; done: () => void }) {
  const previous = review.price.request
  const [number, setNumber] = useState(previous?.number ?? ''), [date, setDate] = useState(previous?.document_date ?? dateToday()), [until, setUntil] = useState(previous?.valid_until ?? '')
  const [lines, setLines] = useState(() => review.lines.map(l => ({ ...emptyTerms(), ...previous?.lines.find(t => t.index === l.index), index: l.index })))
  const [receipt, setReceipt] = useState(previous?.receipt_id ?? 0), [evidence, setEvidence] = useState<Citation>(previous?.receipt_evidence ?? emptyCitation())
  const [receipts, setReceipts] = useState<{ id: number; number: string; status: string }[]>([]), [loadError, setLoadError] = useState('')
  const { busy, error, save } = useSave(done)
  useEffect(() => { let active = true; call<{ items: typeof receipts }>(`/receipts?order_id=${review.order_id}&limit=100`).then(r => { if (active) setReceipts(r.items) }).catch(e => { if (active) setLoadError(message(e)) }); return () => { active = false } }, [review.order_id])
  return <form className={frame} aria-label="Подтверждение цен" onSubmit={e => void save(e, `/orders/${review.order_id}/price-evidence`, {
    expected_id: review.price.id, version: review.version, number, document_date: date, valid_until: until, lines,
    receipt_id: receipt || null, receipt_evidence: receipt ? evidence : null,
  })}><h4 className="font-medium">Личная проверка цен · {review.people.accounting}</h4><fieldset disabled={busy} className="space-y-4">
    <p className="text-sm text-muted">Сверьте с документом цены и количества заказа. Для подтверждения прошлой закупки выберите приёмку и её скан.</p>
    <Field label="Номер счёта / документа"><Input aria-label="Номер счёта" required value={number} maxLength={255} onChange={e => setNumber(e.target.value)} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Дата документа"><Input aria-label="Дата документа" required type="date" max={dateToday()} value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="Цена действует до"><Input aria-label="Цена действует до" required type="date" min={date} value={until} onChange={e => setUntil(e.target.value)} /></Field></div>
    {lines.map((line, i) => <fieldset key={line.index} className="space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-medium">{review.lines[i].title}</legend><p className="text-sm">{review.lines[i].quantity} {review.lines[i].unit} × {amount(review.lines[i].unit_price, review.currency)} · цена товара за единицу</p>
      <TermsFields supplierId={review.supplier_id} value={line} change={v => setLines(old => old.map((l, j) => j === i ? { ...v, index: l.index } : l))} /></fieldset>)}
    <Field label="Факт предыдущей закупки"><Select aria-label="Приёмка для истории" value={receipt || ''} onChange={e => setReceipt(Number(e.target.value))}><option value="">Без приёмки — текущий счёт</option>{receipts.filter(r => r.status === 'posted').map(r => <option key={r.id} value={r.id}>{r.number || 'Приёмка'} · №{r.id}</option>)}</Select></Field>
    {loadError && <p role="alert" className="text-sm text-danger">Приёмки недоступны: {loadError}</p>}
    {!!receipt && <DocumentInput supplierId={review.supplier_id} value={evidence} change={setEvidence} title="Документ приёмки" />}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button type="submit" className="min-h-11 h-auto py-3">Подтверждаю цены и условия по документам</Button>
  </fieldset></form>
}

export function MarketOfferForm({ review, done }: { review: Review; done: () => void }) {
  const [suppliers, setSuppliers] = useState<{ id: number; name: string; archived: boolean }[]>([]), [sid, setSid] = useState(0), [index, setIndex] = useState(0)
  const [terms, setTerms] = useState(emptyTerms), [price, setPrice] = useState(''), [number, setNumber] = useState('')
  const [date, setDate] = useState(dateToday()), [until, setUntil] = useState(''), [loadError, setLoadError] = useState('')
  const { busy, error, save } = useSave(done)
  useEffect(() => { let active = true; call<{ suppliers: typeof suppliers }>('/catalog').then(r => { if (active) setSuppliers(r.suppliers) }).catch(e => { if (active) setLoadError(message(e)) }); return () => { active = false } }, [])
  const line = review.lines[index]
  return <form className={frame} aria-label="Предложение рынка" onSubmit={e => void save(e, `/suppliers/${sid}/offers`, { ...terms, material_id: line?.material_id, unit: line?.unit, currency: review.currency, unit_price: price, number, document_date: date, valid_until: until })}>
    <h4 className="font-medium">Подтверждённое предложение другого поставщика</h4><fieldset disabled={busy} className="space-y-3">
      <Field label="Поставщик предложения"><Select aria-label="Поставщик предложения" required value={sid || ''} onChange={e => { setSid(Number(e.target.value)); setTerms(t => ({ ...t, evidence: emptyCitation() })) }}><option value="">Выберите поставщика</option>{suppliers.filter(s => s.id !== review.supplier_id && !s.archived).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Материал предложения"><Select aria-label="Материал предложения" required value={index} onChange={e => setIndex(Number(e.target.value))}>{review.lines.map((l, i) => <option key={i} value={i} disabled={!l.material_id}>{l.title} · {l.unit}</option>)}</Select></Field>
      <Field label={'Цена за единицу, ' + review.currency}><Input aria-label="Цена предложения" required type="number" min="0.000001" step="any" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></Field>
      <Field label="Номер предложения"><Input aria-label="Номер предложения" required value={number} onChange={e => setNumber(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Дата предложения"><Input aria-label="Дата предложения" required type="date" max={dateToday()} value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="Предложение действует до"><Input aria-label="Предложение действует до" required type="date" min={date} value={until} onChange={e => setUntil(e.target.value)} /></Field></div>
      {!!sid && <TermsFields key={sid} supplierId={sid} value={terms} change={setTerms} />}
      {(error || loadError) && <p role="alert" className="text-sm text-danger">{error || loadError}</p>}
      <Button type="submit" disabled={!sid || !line?.material_id} className="min-h-11 h-auto py-3">Подтвердить предложение по документу</Button>
    </fieldset>
  </form>
}
