import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { DocumentInput } from './PurchaseControlForms'
import type { Citation } from './AutomaticReview'
import { ReceiptReconciliation, type Reconciliation } from './ReceiptReconciliation'

type Receipt = { id: number; supplier_id: number; number: string; occurred_at: string; note: string; edit_token: string; operation_id: number | null; source_id: string | null; lines: { title: string; unit: string; quantity: string | number; unit_price: string | number }[] }
type History = { id: number; created_at: string; actor_id: number; content: { request: { reason: string }; before: Receipt; after: Receipt } }
const call = <T,>(path: string, method: 'GET' | 'PATCH' = 'GET', body?: unknown) => apiRequest<T>({ section: 'purchasing', path, method, body })
const localDate = (date: string) => { const d = new Date(date); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function ReceiptEditor({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [row, setRow] = useState<Receipt | null>(null), [history, setHistory] = useState<History[]>([])
  const [number, setNumber] = useState(''), [date, setDate] = useState(''), [note, setNote] = useState(''), [reason, setReason] = useState('')
  const [lines, setLines] = useState<{ quantity: string; unit_price: string }[]>([]), [evidence, setEvidence] = useState<Citation>({ file_id: 0, locator: '' })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const retry = useRef({ json: '', id: '' })
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([call<Receipt>(`/receipts/${id}`), call<History[]>(`/receipts/${id}/history`)]).then(([r, h]) => {
      if (!active) return
      setRow(r); setHistory(h); setNumber(r.number); setDate(localDate(r.occurred_at)); setNote(r.note || '')
      setLines(r.lines.map(l => ({ quantity: String(l.quantity), unit_price: String(l.unit_price) })))
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [id])
  const numericChange = !!row && lines.some((l, i) => Number(l.quantity) !== Number(row.lines[i].quantity) || Number(l.unit_price) !== Number(row.lines[i].unit_price))
  const save = async () => {
    if (!row || busy) return
    setBusy(true); setError('')
    try {
      if (!date || !number.trim() || reason.trim().length < 3) throw new Error('Заполните номер, дату и причину изменения.')
      if (lines.some(l => !l.quantity.trim() || !l.unit_price.trim() || !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0 || !Number.isFinite(Number(l.unit_price)) || Number(l.unit_price) < 0)) throw new Error('Проверьте количество и цену каждой позиции.')
      const data = { edit_token: row.edit_token, number: number.trim(), occurred_at: date === localDate(row.occurred_at) && /(?:Z|[+-]\d{2}:\d{2})$/.test(row.occurred_at) ? row.occurred_at : new Date(date).toISOString(), note, reason, lines, evidence: numericChange ? evidence : null, reconciliation_id: numericChange ? reconciliation?.approval_id : undefined }
      const json = JSON.stringify(data)
      if (retry.current.json !== json) retry.current = { json, id: crypto.randomUUID() }
      await call(`/receipts/${id}`, 'PATCH', { ...data, request_id: retry.current.id })
      await onSaved()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Modal open title="Изменить приёмку" width="max-w-3xl" onClose={onClose} footer={<>{(reason.trim().length < 3 || (numericChange && (!evidence.file_id || !evidence.locator.trim()))) && <p className="w-full self-center text-xs text-muted sm:mr-auto sm:w-auto">{reason.trim().length < 3 ? "Укажите причину изменения." : "Выберите документ и строку, подтверждающие корректировку."}</p>}<Button variant="secondary" onClick={onClose} disabled={busy}>Отмена</Button><Button onClick={save} disabled={busy || !row || reason.trim().length < 3 || (numericChange && (!evidence.file_id || !evidence.locator.trim()))}>Сохранить изменения</Button></>}>
    <div className="space-y-4">
      {error && <p role="alert" className="text-danger">{error}</p>}
      {!row ? <p className="text-muted">Загрузка приёмки…</p> : <>
        <p className="text-sm text-muted">Сохраним автора, причину, прежние и новые значения. Количество изменит остаток только на разницу. Цена заказа и выполненные платежи сохраняются отдельно.</p>
        {!!row.source_id && !row.operation_id && <ReceiptReconciliation id={id} supplierId={row.supplier_id} onChange={setReconciliation} />}
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Номер приёмки" required><Input aria-label="Номер приёмки" maxLength={255} value={number} onChange={e => setNumber(e.target.value)} /></Field><Field label="Дата документа" required><Input aria-label="Дата приёмки" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></Field></div>
          {lines.map((l, i) => <div key={i} className="rounded-lg border border-border p-3"><p className="mb-2 font-medium">{row.lines[i].title} · {row.lines[i].unit}</p><div className="grid grid-cols-2 gap-3">{(['quantity', 'unit_price'] as const).map(key => <Field key={key} label={key === 'quantity' ? 'Количество' : 'Цена, ₽'}><Input aria-label={`${key === 'quantity' ? 'Количество приёмки' : 'Цена приёмки'} ${i + 1}`} type="number" step="any" min={key === 'quantity' ? '0.000001' : '0'} disabled={!!row.source_id && !row.operation_id && !reconciliation?.can_correct} value={l[key]} onChange={e => setLines(v => v.map((x, n) => n === i ? { ...x, [key]: e.target.value } : x))} /></Field>)}</div></div>)}
          <p className="font-medium">Итого: {lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unit_price), 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</p>
          <Field label="Комментарий"><Textarea value={note} maxLength={5000} onChange={e => setNote(e.target.value)} /></Field>
          <Field label="Причина изменения" required><Textarea aria-label="Причина изменения приёмки" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></Field>
          {numericChange && <DocumentInput supplierId={row.supplier_id} value={evidence} change={setEvidence} title="Основание корректировки" />}
        </fieldset>
        {history.length > 0 && <details><summary className="cursor-pointer font-medium">История изменений · {history.length}</summary><div className="mt-3 space-y-3">{history.map(h => <div key={h.id} className="rounded-lg border border-border p-3 text-sm"><p>{new Date(h.created_at).toLocaleString('ru-RU')} · сотрудник №{h.actor_id}</p><p>{h.content.request.reason}</p><p>Номер: {h.content.before.number} → {h.content.after.number}</p>{h.content.after.lines.map((l, i) => <p key={i}>{l.title}: {h.content.before.lines[i].quantity} → {l.quantity}; цена {h.content.before.lines[i].unit_price} → {l.unit_price} ₽</p>)}</div>)}</div></details>}
      </>}
    </div>
  </Modal>
}
