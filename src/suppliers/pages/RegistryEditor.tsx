import { useEffect, useRef, useState } from 'react'
import { call, message, statusLabels, type RegistryStatus, type Row } from '@/counterparties/api'
import { DocumentInput } from '@/purchasing/PurchaseControlForms'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'

export type RegistryEdit = { row: Row; status?: RegistryStatus }
type Profile = { id: number; name: string }

export function RegistryEditor({ edit, close, saved }: { edit: RegistryEdit; close: () => void; saved: () => void }) {
  const [row, setRow] = useState(edit.row)
  const [comment, setComment] = useState(edit.row.comment ?? '')
  const [evidence, setEvidence] = useState({ file_id: 0, locator: '' })
  const [signed, setSigned] = useState(false)
  const [profile, setProfile] = useState('')
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const retry = useRef({ payload: '', id: '' })

  const { status } = edit
  const role = row.supplier_id ? 'supplier' : row.client_id ? 'client' : null
  const binding = !role && (status === 'supplier' || status === 'client')
  const wrongRole = !!role && (status === 'supplier' || status === 'client') && role !== status
  const deal = status === 'deal_closed'
  const supplierProof = deal && role === 'supplier'
  const blocked = wrongRole || (deal && !role) || (binding && (!profile || loadingProfiles))
    || (supplierProof && (!evidence.file_id || !evidence.locator.trim() || !signed))
  const title = status ? statusLabels[status] : 'Комментарий'

  useEffect(() => {
    if (!binding) return
    let active = true
    setLoadingProfiles(true)
    setProfileError('')
    const timer = window.setTimeout(() => {
      call<Profile[]>('/registry/profiles', 'GET', undefined, { role: status, q: query })
        .then(value => { if (active) setProfiles(value) })
        .catch(error => { if (active) { setProfileError(message(error)); setProfiles([]) } })
        .finally(() => { if (active) setLoadingProfiles(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [binding, status, query])

  async function save() {
    if (busy || blocked) return
    const data = {
      etag: row.etag,
      ...(status ? { status } : { comment }),
      ...(binding ? { profile_id: Number(profile) } : {}),
      ...(supplierProof ? { evidence, signed } : {}),
    }
    const payload = JSON.stringify(data)
    if (retry.current.payload !== payload) retry.current = { payload, id: crypto.randomUUID() }
    setBusy(true)
    setError('')
    try {
      await call<Row>(`/${row.id}/registry`, 'PATCH', { ...data, request_id: retry.current.id })
      saved()
    } catch (error) {
      setError(message(error))
      if (error instanceof ApiError && error.status === 409 && error.data?.current) {
        setRow(error.data.current as Row)
        setConflict(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => { if (!busy) close() }
  return <Modal open onClose={dismiss} title={title} footer={<>
    <Button variant="ghost" disabled={busy} onClick={dismiss}>Отмена</Button>
    <Button disabled={busy || blocked} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить'}</Button>
  </>}>
    <div className="space-y-3">
      <p className="break-words font-semibold">{row.card.name}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {conflict && <div className="space-y-1 rounded-md bg-surface-muted p-3 text-sm">
        <p>Актуальное значение</p>
        <p className="whitespace-pre-wrap break-words">{status ? row.status && statusLabels[row.status] || '—' : row.comment || '—'}</p>
        <p>Сверьте данные перед повторным сохранением.</p>
      </div>}
      {!status && <Textarea aria-label="Текст комментария" rows={5} maxLength={4000}
        value={comment} disabled={busy} onChange={event => setComment(event.target.value)} />}
      {wrongRole && <p className="text-sm">К карточке уже привязан профиль «{statusLabels[role!]}». Используйте карточку этого профиля для дальнейшей работы.</p>}
      {binding && <>
        <p className="text-sm">Выберите существующий профиль для привязки к этой карточке.</p>
        <Input aria-label="Поиск профиля" placeholder="Название или имя" maxLength={255}
          value={query} onChange={event => { setQuery(event.target.value); setProfile('') }} disabled={busy} />
        <Select aria-label="Профиль контрагента" value={profile} disabled={busy || loadingProfiles}
          onChange={event => setProfile(event.target.value)}>
          <option value="">{loadingProfiles ? 'Поиск…' : 'Выберите профиль'}</option>
          {profiles.map(value => <option key={value.id} value={value.id}>{value.name} · №{value.id}</option>)}
        </Select>
        {profileError && <p role="alert" className="text-sm text-danger">{profileError}</p>}
        {!loadingProfiles && !profileError && !profiles.length && <p className="text-sm text-muted">Свободные профили не найдены.</p>}
      </>}
      {deal && !role && <p className="text-sm">Сначала выберите «Поставщик» или «Клиент» и привяжите профиль.</p>}
      {deal && role === 'client' && <p className="text-sm">Основанием станет подписанный и проверенный договор из карточки клиента.</p>}
      {supplierProof && <fieldset disabled={busy} className="space-y-3">
        <DocumentInput supplierId={row.supplier_id!} value={evidence}
          change={value => { setEvidence(value); setSigned(false) }} title="Подписанный договор" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={signed} onChange={event => setSigned(event.target.checked)} />
          Подписи сторон в выбранном документе проверены
        </label>
      </fieldset>}
    </div>
  </Modal>
}
