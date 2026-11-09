import { useEffect, useRef, useState } from 'react'
import { Building2, ImagePlus, Trash2 } from 'lucide-react'
import { ApiError } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import type { Entry } from './api'
import { logoContent, logoStatus, removeLogo, saveLogo, type LogoStatus } from './agencyLogoApi'

type Props = { entry: Entry; canEdit: boolean; canFull: boolean; disabled: boolean; stageChanged: boolean;
  onBusy: (busy: boolean) => void; onChanged: (entry: Entry) => void; onReload: () => void }

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function CrmAgencyLogo({ entry, canEdit, canFull, disabled, stageChanged, onBusy, onChanged, onReload }: Props) {
  const [status, setStatus] = useState<LogoStatus | null>(null)
  const [savedImage, setSavedImage] = useState<Blob | null>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflictVersion, setConflictVersion] = useState<number | null>(null)
  const [invalidSelection, setInvalidSelection] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [revision, setRevision] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const selection = useRef(0)
  const savedUrl = useObjectUrl(savedImage)
  const previewUrl = useObjectUrl(selected)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selection.current++ } }, [])

  useEffect(() => {
    const abort = new AbortController()
    let current = true
    setLoading(true); setLoadError('')
    void (async () => {
      const result = await logoStatus(entry.id)
      if (!current) return
      if (result.agency_id !== entry.id || !Number.isInteger(result.version)) throw new Error('Обновите карточку агентства')
      const image = result.logo ? await logoContent(entry.id, result.logo.sha256, abort.signal) : null
      if (current) { setStatus(result); setSavedImage(image) }
    })().catch(error => { if (current) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить логотип') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; abort.abort() }
  }, [entry.id, entry.version, revision])

  const conflict = conflictVersion !== null && entry.version === conflictVersion
  const actionDisabled = disabled || busy || loading || !!loadError || stageChanged || conflict
  const editable = canEdit && !entry.archived

  async function choose(file: File | undefined) {
    if (!file) return
    const ticket = ++selection.current
    setSelected(null); setPreviewReady(false); setError(''); setNotice(''); setInvalidSelection(false); setConfirmRemove(false)
    if (!file.size || file.size > 5 * 1024 * 1024) { setError(file.size ? 'Размер файла должен быть не больше 5 МБ' : 'Выбран пустой файл'); return }
    if (file.type && !['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'].includes(file.type)) {
      setError('Выберите изображение PNG, JPEG или WebP'); return
    }
    try {
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
      if (!png && !jpeg && !webp) { setError('Файл не является изображением PNG, JPEG или WebP'); return }
      if (mounted.current && ticket === selection.current) setSelected(file)
    } catch { if (mounted.current) setError('Не удалось прочитать выбранный файл') }
  }

  async function change(remove = false) {
    if (actionDisabled || (!remove && (!selected || !previewReady || invalidSelection))) return
    setBusy(true); onBusy(true); setError(''); setNotice('')
    try {
      const result = remove ? await removeLogo(entry) : await saveLogo(entry, selected!)
      if (!mounted.current) return
      if (result.entry.id !== entry.id) throw new Error('Не удалось подтвердить сохранение. Обновите карточку.')
      setSelected(null); setPreviewReady(false); setConfirmRemove(false); setConflictVersion(null)
      setNotice(remove ? 'Логотип удалён' : 'Логотип сохранён')
      onChanged(result.entry)
      setRevision(value => value + 1)
    } catch (error) {
      if (!mounted.current) return
      if (error instanceof ApiError) {
        setError(error.message)
        if (error.status === 409 || error.status === 412) setConflictVersion(entry.version)
        if ([413, 415, 422].includes(error.status)) setInvalidSelection(true)
      } else {
        setError('Не удалось подтвердить сохранение. Обновите карточку и проверьте логотип.')
        setConflictVersion(entry.version)
      }
    } finally { if (mounted.current) { setBusy(false); onBusy(false) } }
  }

  function refresh() { onReload(); setRevision(value => value + 1) }

  return <section aria-label="Логотип компании" className="space-y-3 rounded-lg border border-border p-3">
    <h3 className="text-[13px] font-semibold">Логотип компании</h3>
    <div className="flex items-center gap-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
        {savedUrl ? <img src={savedUrl} alt={`Логотип ${entry.name}`} className="h-full w-full object-contain p-1" /> : <Building2 size={30} className="text-muted" aria-hidden="true" />}
      </div>
      <div className="min-w-0 space-y-2 text-[12px] text-muted">
        <p>{loading ? 'Загрузка логотипа…' : status?.logo ? 'Сохранённый логотип' : 'Логотип ещё не добавлен'}</p>
        {editable && <><Button type="button" size="sm" variant="secondary" disabled={disabled || busy || stageChanged} onClick={() => input.current?.click()}><ImagePlus size={14} />{status?.logo ? 'Заменить логотип' : 'Выбрать изображение'}</Button>
          <input ref={input} aria-label="Изображение логотипа компании" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            disabled={disabled || busy || stageChanged} onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} />
          <p>PNG, JPEG или WebP · до 5 МБ</p></>}
      </div>
    </div>
    {loadError && <div role="alert" className="space-y-1 text-[12px] text-danger"><p>{loadError}</p><button type="button" className="underline" disabled={busy} onClick={refresh}>Повторить загрузку логотипа</button></div>}
    {stageChanged && editable && <p className="text-[12px] text-muted">Сначала сохраните выбранный этап.</p>}
    {selected && <div className="space-y-2 rounded-md bg-surface-muted p-3">
      <p className="text-[12px] font-medium">Новый логотип · предпросмотр</p>
      {previewUrl && <img src={previewUrl} alt="Предпросмотр нового логотипа" className="h-32 w-full rounded bg-white object-contain p-2"
        onLoad={event => {
          const image = event.currentTarget
          if (image.naturalWidth > 4096 || image.naturalHeight > 4096 || image.naturalWidth * image.naturalHeight > 8_000_000) {
            setError('Изображение слишком большое: максимум 4096 пикселей по стороне и 8 мегапикселей'); setInvalidSelection(true)
          } else setPreviewReady(true)
        }} onError={() => { setPreviewReady(false); setInvalidSelection(true); setError('Изображение повреждено или не поддерживается') }} />}
      <p className="break-all text-[11px] text-muted">{selected.name}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={actionDisabled || !previewReady || invalidSelection} onClick={() => void change()}>{busy ? 'Сохранение…' : 'Сохранить логотип'}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { selection.current++; setSelected(null); setPreviewReady(false); setError(''); setInvalidSelection(false) }}>Отмена</Button></div>
    </div>}
    {error && <div role="alert" className="space-y-2 text-[12px] text-danger"><p>{error}</p>{conflictVersion !== null && <button type="button" className="underline" disabled={busy} onClick={refresh}>Обновить карточку перед сохранением</button>}</div>}
    {conflictVersion !== null && !conflict && <p role="status" className="text-[12px] text-muted">Карточка обновлена. Проверьте текущий логотип и повторите сохранение, если замена ещё нужна.</p>}
    {notice && <p role="status" className="text-[12px] text-green-700">{notice}</p>}
    {canFull && !entry.archived && status?.logo && !selected && <div>
      {confirmRemove ? <div className="space-y-2 text-[12px]"><p>Удалить сохранённый логотип компании?</p><div className="flex gap-2"><Button type="button" size="sm" variant="danger" disabled={actionDisabled} onClick={() => void change(true)}>Удалить логотип</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(false)}>Отмена удаления</Button></div></div>
        : <button type="button" className="flex items-center gap-1 text-[12px] text-muted hover:text-danger disabled:opacity-40" disabled={actionDisabled} onClick={() => setConfirmRemove(true)}><Trash2 size={13} />Удалить логотип…</button>}
    </div>}
  </section>
}
