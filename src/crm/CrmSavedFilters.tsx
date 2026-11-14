import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Field, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { filterStorageKey, parseFilterSnapshot, readSavedFilters, removeSavedFilter, storeSavedFilter } from './savedFilters'
import type { CrmFilterSnapshot, SavedCrmFilter } from './savedFilters'

export function CrmSavedFilters({ accountId, kind, current, ready, apply }: {
  accountId: number; kind: string; current: CrmFilterSnapshot; ready: boolean
  apply: (filters: CrmFilterSnapshot) => string | null
}) {
  const key = filterStorageKey(accountId, kind)
  const [items, setItems] = useState<SavedCrmFilter[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<'new' | 'update' | null>(null), [name, setName] = useState('')
  const [removed, setRemoved] = useState<SavedCrmFilter | null>(null)
  const active = items.find(item => item.id === selected)
  let modified = false
  try { modified = !!active && JSON.stringify(active.filters) !== JSON.stringify(parseFilterSnapshot(current)) } catch { modified = !!active }
  const report = (cause: unknown) => setError(cause instanceof Error && cause.name !== 'SecurityError' && cause.name !== 'QuotaExceededError' ? cause.message : 'Браузер не разрешил сохранить настройки. Фильтры не записаны.')
  useEffect(() => {
    const load = () => { try { setItems(readSavedFilters(localStorage, key)); setError('') } catch (cause) { report(cause) } }
    load()
    const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) load() }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [key])
  function save() {
    setError(''); setNotice('')
    try {
      const id = dialog === 'update' ? selected : crypto.randomUUID()
      const next = storeSavedFilter(localStorage, key, { id, name, filters: current }, dialog === 'update')
      setItems(next); setSelected(id); setDialog(null); setNotice('Набор сохранён для вас в этом браузере.'); setRemoved(null)
    } catch (cause) { report(cause) }
  }
  return <section aria-label="Личные фильтры CRM" className="crm-saved-filters">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Select aria-label="Сохранённые фильтры" value={active?.id || ''} disabled={!ready} className="min-w-0 sm:max-w-64" onChange={event => {
        setError(''); setNotice('')
        const id = event.target.value
        if (!id) { setSelected(''); return }
        const item = items.find(value => value.id === id)
        if (!item) return
        const problem = apply(item.filters)
        if (problem) { setError(problem); return }
        setSelected(id); setNotice(`Применён набор «${item.name}».`)
      }}><option value="">Сохранённые фильтры · {items.length}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Button size="sm" variant="secondary" disabled={!ready} onClick={() => { setError(''); setName(''); setDialog('new') }}>Сохранить набор</Button>
      {active && <>{modified && <Button size="sm" variant="secondary" disabled={!ready} onClick={() => { const problem = apply(active.filters); setError(problem || ''); if (!problem) setNotice(`Применён набор «${active.name}».`) }}>Применить набор</Button>}<Button size="sm" variant="secondary" disabled={!ready} onClick={() => { setError(''); setName(active.name); setDialog('update') }}>Изменить набор</Button><Button size="sm" variant="secondary" onClick={() => {
        try { setItems(removeSavedFilter(localStorage, key, active.id)); setRemoved(active); setSelected(''); setError(''); setNotice(`Набор «${active.name}» удалён. Текущая выборка сохранена.`) } catch (cause) { report(cause) }
      }}>Удалить набор</Button></>}
      {modified && <span className="text-xs">Условия изменены · набор ещё не обновлён</span>}
    </div>
    {notice && <p role="status" className="mt-2 text-xs">{notice} {removed && <button className="underline" onClick={() => {
      try { setItems(storeSavedFilter(localStorage, key, removed)); setRemoved(null); setError(''); setNotice('Удалённый набор восстановлен.') } catch (cause) { report(cause) }
    }}>Отменить удаление</button>}</p>}
    {error && !dialog && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    <Modal open={dialog !== null} title={dialog === 'update' ? 'Изменить набор фильтров' : 'Сохранить набор фильтров'} onClose={() => { setDialog(null); setError('') }}>
      <form className="space-y-4 text-ink" onSubmit={event => { event.preventDefault(); save() }}>
        <Field label="Название набора" required><Input autoFocus required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Например: новые заявки без ответственного" /></Field>
        <p className="text-sm text-muted">Сохранятся текущие условия поиска, воронка, этап и вид отображения. Наборы личные, для этого раздела и этого браузера. Указанные даты останутся фиксированными.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setDialog(null)}>Отмена</Button><Button type="submit" disabled={!name.trim()}>Сохранить</Button></div>
      </form>
    </Modal>
  </section>
}
