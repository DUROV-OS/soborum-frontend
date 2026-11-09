import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import * as a from './controlApi'

const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить операцию'

export function ProofInput({value, onChange, disabled}: {value: a.Proof | null; onChange: (v: a.Proof | null) => void; disabled?: boolean}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <div className="space-y-2">
    <p className="text-xs text-muted">PDF или скан · до 20 МБ</p>
    <input ref={input} type="file" aria-label="Загрузить подтверждающий документ" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy || disabled} className="hidden" onChange={async e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setBusy(true); setError(''); onChange(null)
      try { onChange(await a.uploadProof(file)) } catch (err) { setError(message(err)) } finally { setBusy(false) }
    }} />
    <Button size="sm" variant="secondary" disabled={busy || disabled} onClick={() => input.current?.click()}><Paperclip size={15} />{busy ? 'Загрузка…' : value ? 'Заменить документ' : 'Прикрепить документ'}</Button>
    {busy && <p role="status" className="text-sm">Загрузка документа…</p>}
    {value && <button className="block break-all text-left text-sm text-brand-dark underline" onClick={() => void a.downloadProof(value).catch(e => setError(message(e)))}>{value.filename}</button>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>
}
