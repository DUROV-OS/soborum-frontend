import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Textarea } from '@/shared/ui/Field'
import { DocumentInput } from './PurchaseControlForms'
import type { Citation } from './AutomaticReview'

export type Reconciliation = {
  fingerprint: string; approved: boolean; approval_id: number | null; can_confirm: boolean; can_correct: boolean
  accountant: { id: number; name: string } | null; director: { id: number; name: string } | null; issues: string[]
  materials: { material_id: number; title: string; unit: string; stock: string | null; price: string | null; expected_stock: string | null; expected_price: string | null; issues: string[]; related: { id: number; number: string; type: string }[] }[]
}
export function ReceiptReconciliation({ id, supplierId, onChange }: { id: number; supplierId: number; onChange: (state: Reconciliation) => void }) {
  const [state, setState] = useState<Reconciliation | null>(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [proof, setProof] = useState<Citation>({ file_id: 0, locator: '' }), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false)
  const generation = useRef(0), callback = useRef(onChange), attempt = useRef({ json: '', id: '' })
  callback.current = onChange
  const load = async () => {
    const request = ++generation.current
    setLoading(true); setError(''); setConfirmed(false)
    if (state) { const pending = { ...state, can_correct: false }; setState(pending); callback.current(pending) }
    try { const result = await apiRequest<Reconciliation>({ section: 'purchasing', path: `/receipts/${id}/reconciliation` }); if (request === generation.current) { setState(result); callback.current(result) } }
    catch (e) { if (request === generation.current) setError((e as Error).message) }
    finally { if (request === generation.current) setLoading(false) }
  }
  useEffect(() => { void load(); return () => { generation.current += 1 } }, [id])
  const confirm = async () => {
    if (!state || busy) return
    const data = { fingerprint: state.fingerprint, evidence: proof, reason, confirmed }
    const json = JSON.stringify(data)
    if (attempt.current.json !== json) attempt.current = { json, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try {
      const result = await apiRequest<Reconciliation>({ section: 'purchasing', path: `/receipts/${id}/reconciliation`, method: 'POST', body: { ...data, request_id: attempt.current.id } })
      setState(result); callback.current(result); setConfirmed(false)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const amount = (v: string | null) => v === null ? 'Нет данных' : Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 8 })
  return <section aria-label="Сверка исходного остатка" className="space-y-3 rounded-xl border border-border bg-surface-muted p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Сверка исходного остатка</h3><Button size="sm" variant="secondary" disabled={loading || busy} onClick={() => void load()}>Обновить проверку</Button></div>
    <p className="text-sm text-muted">Сравниваем оригинал приёмки, отчёт об остатках и последующие операции. Подтверждение сверки само по себе не меняет склад. Исправление вносит руководитель отдельным сохранением.</p>
    {loading && <p role="status" className="text-sm">Проверяем исходные документы…</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {state && <>
      <p className="text-sm font-medium">{state.approved ? 'Сверка подтверждена' : state.issues.length ? `Требуют внимания: ${state.issues.length}` : 'Автоматическая сверка пройдена. Нужно подтверждение бухгалтера.'}</p>
      <p className="text-xs text-muted">Проверяет: {state.accountant?.name || 'Бухгалтер не назначен'} · Корректирует: {state.director?.name || 'Руководитель не назначен'}</p>
      <div className="space-y-2">{state.materials.map(m => <div key={m.material_id} className="rounded-lg border border-border bg-surface p-3 text-sm"><p className="font-medium">{m.title}</p><dl className="mt-2 grid grid-cols-2 gap-2"><div><dt className="text-xs text-muted">Остаток в системе</dt><dd>{amount(m.stock)} {m.unit}</dd></div><div><dt className="text-xs text-muted">По отчёту и коррекциям</dt><dd>{amount(m.expected_stock)} {m.unit}</dd></div><div><dt className="text-xs text-muted">Учётная цена</dt><dd>{amount(m.price)} ₽</dd></div><div><dt className="text-xs text-muted">Расчётная цена</dt><dd>{amount(m.expected_price)} ₽</dd></div></dl>{!!m.related.length && <details className="mt-2"><summary className="cursor-pointer">Связанные операции · {m.related.length}</summary>{m.related.map(d => <p key={d.id} className="mt-1 text-xs">№ {d.number} · запись источника {d.id}</p>)}</details>}</div>)}</div>
      {!!state.issues.length && <details open><summary className="cursor-pointer text-sm font-medium">Что нужно исправить</summary><ul className="mt-2 space-y-2 text-xs text-warning">{state.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}
      {state.can_confirm && !state.approved && !state.issues.length && <fieldset disabled={busy || loading} className="space-y-3">
        <DocumentInput supplierId={supplierId} value={proof} change={v => { setProof(v); setConfirmed(false) }} title="Документ сверки остатка и стоимости" />
        <Field label="Основание сверки"><Textarea aria-label="Основание сверки" value={reason} maxLength={1000} onChange={e => { setReason(e.target.value); setConfirmed(false) }} /></Field>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />По документу проверено: весь материал этой приёмки не использован, его количество и стоимость включены в текущий остаток, последующие операции учтены полностью.</label>
        <Button onClick={() => void confirm()} disabled={!confirmed || !proof.file_id || !proof.locator.trim() || reason.trim().length < 3 || busy}>Подтвердить сверку</Button>
      </fieldset>}
      {state.approved && <p className="text-sm text-success">{state.can_correct ? 'Количество и цена доступны ниже. Для исправления приложите документ-основание.' : 'Для изменения количества и цены откройте приёмку под учётной записью руководителя.'}</p>}
    </>}
  </section>
}
