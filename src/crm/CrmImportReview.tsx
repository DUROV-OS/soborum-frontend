import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '@/auth/store'
import { ApiError, apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

type Review = { source_digest: string; content_digest?: string; review_id: number | null;
  disposition: 'business' | 'restricted' | 'unknown'; current: boolean; public_data: { text?: string; filename?: string } }

/** No review lookup, original download or classification occurs until an admin opens it. */
export function CrmImportReview({ sourceId, filename }: { sourceId: number; filename?: string }) {
  const admin = useAuthStore(state => state.current?.role === 'admin')
  const [open, setOpen] = useState(false), [review, setReview] = useState<Review | null>(null)
  const [value, setValue] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [stale, setStale] = useState(false)
  const alive = useRef(true), mutation = useRef(false), generation = useRef(0)
  const index = filename == null ? -1 : 0
  const path = `/import-reviews/${sourceId}`
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++ } }, [])
  async function load(keepDraft = false) {
    const ticket = ++generation.current
    setBusy(true); setError(''); setConfirmed(false)
    try {
      const next = await apiRequest<Review>({ section: 'crm', path, query: { attachment_index: index } })
      if (!alive.current || ticket !== generation.current) return
      setReview(next); setStale(false)
      if (!keepDraft) setValue(index < 0 ? next.public_data.text || '' : next.public_data.filename || '')
    } catch (cause) { if (alive.current && ticket === generation.current) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить состояние доступа') }
    finally { if (alive.current && ticket === generation.current) setBusy(false) }
  }
  async function save(disposition: 'business' | 'restricted') {
    if (!review || busy || mutation.current || stale || (disposition === 'business' && (!confirmed || !value.trim()))) return
    mutation.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest({ section: 'crm', path, method: 'POST', body: {
        attachment_index: index, expected_review_id: review.review_id, source_digest: review.source_digest,
        disposition, content_reviewed: disposition === 'business' && confirmed,
        ...(disposition === 'business' ? index < 0 ? { text: value.trim() } : { filename: value.trim(), content_digest: review.content_digest } : {}),
      } })
      if (!alive.current) return
      setNotice(disposition === 'business' ? 'Проверка сохранена. Доступ определяется правами сотрудника и остальными ограничениями этой записи.' : 'Доступ к содержимому для сотрудников закрыт. Оригинал сохранён.')
      await load()
    } catch (cause) {
      if (!alive.current) return
      if (cause instanceof ApiError && cause.status === 409) {
        setStale(true); setConfirmed(false)
        setError('Запись или файл изменились. Обновите версию и проверьте содержимое заново.')
      } else setError(cause instanceof Error ? cause.message : 'Не удалось изменить доступ')
    } finally { mutation.current = false; if (alive.current) setBusy(false) }
  }
  if (!admin) return null
  const status = !review ? 'Загрузка…' : review.disposition === 'restricted' ? 'Закрыто для продаж' : review.current && review.disposition === 'business' ? 'Проверено · разрешение сохранено' : 'Не проверено · содержимое закрыто'
  const close = () => { if (!busy) { generation.current++; setOpen(false) } }
  return <>
    <Button size="sm" variant="ghost" aria-label={filename == null ? 'Проверить доступ к заметке' : `Проверить доступ к файлу ${filename}`}
      onClick={() => { setOpen(true); setReview(null); setValue(''); setNotice(''); void load() }}>Доступ для продаж</Button>
    {open && createPortal(<Modal open title={index < 0 ? 'Доступ к старой заметке' : 'Доступ к старому файлу'} onClose={close} width="max-w-xl">
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-surface-muted p-3 text-sm">{status}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
        <p className="text-sm">Разрешайте только проверенные рабочие сведения. Паспортные и семейные данные должны оставаться закрыты.</p>
        {index >= 0 && <div className="space-y-2"><p className="break-all text-sm">{filename}</p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => { void downloadFile('crm', `/files/${sourceId}/download`, filename || 'Файл').catch(cause => { if (alive.current) setError(cause instanceof Error ? cause.message : 'Не удалось скачать оригинал') }) }}>Скачать оригинал для проверки</Button></div>}
        <Field label={index < 0 ? 'Текст для продаж' : 'Название файла для продаж'} required>
          {index < 0 ? <Textarea rows={5} maxLength={20000} value={value} disabled={busy} onChange={event => { setValue(event.target.value); setConfirmed(false) }} />
            : <Input maxLength={255} value={value} disabled={busy} onChange={event => { setValue(event.target.value); setConfirmed(false) }} />}
        </Field>
        <p className="text-xs text-muted">{index < 0 ? 'Коллеги увидят только указанный текст. Исходная запись сохранится для администратора.' : 'Коллеги смогут скачать проверенное содержимое под этим названием. Изменённый файл потребует новой проверки.'}</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || stale || !review} onChange={event => setConfirmed(event.target.checked)} />Я проверил содержимое: здесь только рабочие сведения для продаж, без паспортных и семейных данных.</label>
        {stale && <Button variant="secondary" disabled={busy} onClick={() => void load(true)}>Обновить версию для проверки</Button>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || stale || !review || !confirmed || !value.trim()} onClick={() => void save('business')}>Разрешить для продаж</Button>
          <Button variant="secondary" disabled={busy || stale || !review} onClick={() => void save('restricted')}>Закрыть доступ</Button>
          <Button variant="ghost" disabled={busy} onClick={close}>Готово</Button>
        </div>
      </div>
    </Modal>, document.body)}
  </>
}
