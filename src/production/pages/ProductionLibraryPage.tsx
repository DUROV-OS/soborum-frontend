import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, Download, FileText, House, Save } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { apiRequest, downloadFile } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { HouseConnections } from '@/costing/CatalogConnections'

type Model = { key: string; title: string; series: string; status: string; basis: string; material_count: number; quantity_count: number; operation_count: number; version: number }
type Material = { key: string; title: string; unit: string; quantity: string | null; basis_quantity: string; state: string; sources: { recipe_id: number; version: number }[] }
type Project = { url: string; revision: string; production_safe: boolean } | null
type Card = Model & { content: { basis: string; basis_title: string | null; materials: Material[]; operations: { key: string; title: string; hours: string | null }[]; warnings: string[]; notes: string; project_links: Record<'AR' | 'KR', Project> } }
type Standard = { id: string; title: string; category: string; status: string; source_url: string; checked_at: string; changes: string; application_note: string }
const request = <T,>(path: string, options: { method?: 'POST' | 'PATCH' | 'PUT'; body?: unknown } = {}) => apiRequest<T>({ section: 'production', path: '/library' + path, ...options })
const stateLabel: Record<string, string> = { source_quantity: 'Из техкарты', requires_calculation: 'Нужен расчёт', requires_check: 'Проверить состав', manually_entered: 'Введено вручную' }
const inputClass = 'min-h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-brand'

export function ProductionLibraryPage() {
  const [params, setParams] = useSearchParams()
  const tab = ['cards', 'projects', 'standards'].includes(params.get('tab') || '') ? params.get('tab')! : 'cards'
  const key = params.get('model') || 'barn-dh21'
  const activeKey = useRef(key)
  activeKey.current = key
  const canEdit = accessLevelAtLeast(useAccessLevel('production'), 'edit')
  const owner = useAuthStore(s => s.current?.role === 'admin')
  const [models, setModels] = useState<Model[]>([])
  const [standards, setStandards] = useState<Standard[]>([])
  const [card, setCard] = useState<Card | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [link, setLink] = useState<{ kind: 'AR' | 'KR'; url: string; revision: string; production_safe: boolean } | null>(null)
  const applyCard = (value: Card) => { setCard(value); setQuantities(Object.fromEntries(value.content.materials.map(m => [m.key, m.quantity ?? '']))); setNotes(value.content.notes) }
  useEffect(() => {
    let active = true
    Promise.all([request<{ items: Model[] }>('/models'), request<{ items: Standard[] }>('/standards')])
      .then(([m, s]) => { if (active) { setModels(m.items); setStandards(s.items) } })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [reload])
  useEffect(() => {
    let active = true
    setCard(null); setError(''); setLoading(true); setLink(null)
    request<Card>('/models/' + encodeURIComponent(key)).then(value => { if (active) applyCard(value) })
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [key, reload])
  const changeTab = (next: string) => { setParams({ tab: next, model: key }); setSearch(''); setMessage('') }
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие') } finally { setBusy(false) } }
  const save = () => run(async () => {
    if (!card) return
    const next = await request<Card>('/models/' + key, { method: 'PATCH', body: { version: card.version, notes, quantities: card.content.materials.map(m => ({ key: m.key, quantity: quantities[m.key]?.trim().replace(',', '.') || null })) } })
    if (activeKey.current === key) { applyCard(next); setMessage('Черновик сохранён. Для производства его ещё нужно сверить с проектом.') }
  })
  const filtered = useMemo(() => standards.filter(s => (s.id + ' ' + s.title + ' ' + s.category + ' ' + s.application_note).toLowerCase().replace(/ё/g, 'е').includes(search.trim().toLowerCase().replace(/ё/g, 'е').replace(/ь$/, ''))), [standards, search])
  const selectedModel = models.find(m => m.key === key)
  return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.16em] text-muted">Производство · справочники</p><h1 className="text-[28px] font-semibold tracking-tight text-ink">Библиотека производства</h1><p className="mt-2 max-w-3xl text-sm text-muted">Техкарты моделей, рабочие чертежи и нормативные документы.</p></div>
      {canEdit && <Button variant="secondary" disabled={busy} onClick={() => run(async () => { const result = await request<{ created: number; preserved: number }>('/generate', { method: 'POST' }); setReload(r => r + 1); setMessage(`Создано: ${result.created}. Существующие карточки сохранены.`) })}>Заполнить недостающие техкарты</Button>}
    </header>
    <nav aria-label="Разделы библиотеки" className="flex flex-wrap gap-2 border-b border-border pb-3">
      {[['cards', 'Техкарты домов', House], ['projects', 'Проекты АР и КР', FileText], ['standards', 'ГОСТы и СП', BookOpen]].map(([id, title, Icon]) => { const Mark = Icon as typeof House; return <Button key={String(id)} variant={tab === id ? 'primary' : 'ghost'} aria-pressed={tab === id} onClick={() => changeTab(String(id))}><Mark size={17} />{String(title)}</Button> })}
    </nav>
    {error && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-brand/5 p-4 text-sm text-brand">{message}</p>}
    {tab === 'standards' ? <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="w-full max-w-md"><span className="mb-1 block text-xs text-muted">Номер, название или тема</span><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Например, влажность или ГОСТ 8486" /></label><p className="text-xs text-muted">Сверено с официальным фондом: 05.11.2026</p></div>
      <p className="text-sm text-muted">Применимые разделы и комплект изменений проверяются для каждого проекта. Ссылки открывают официальный документ и его изменения.</p>
      <div className="grid gap-4 xl:grid-cols-2">{filtered.map(s => <article key={s.id} className="rounded-2xl border border-border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted">{s.category}</span><span className="text-xs text-brand">{s.status}</span></div><h2 className="mt-3 text-lg font-semibold text-ink">{s.id}</h2><p className="mt-1 text-sm text-ink">{s.title}</p><p className="mt-3 text-xs text-muted">{s.changes}</p><p className="mt-3 text-sm text-muted">{s.application_note}</p><a href={s.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-brand">Официальный источник ↗</a></article>)}</div>
      {!filtered.length && <p className="py-8 text-center text-muted">По этому запросу документов нет.</p>}
    </section> : <div className="grid items-start gap-6 lg:grid-cols-[235px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-surface p-3"><h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Модели домов</h2><label className="block lg:hidden"><span className="sr-only">Модель дома</span><select disabled={busy} className={inputClass} value={key} onChange={e => { setParams({ tab, model: e.target.value }); setMessage('') }}>{models.map(m => <option key={m.key} value={m.key}>{m.title}</option>)}</select></label><div className="hidden space-y-1 lg:block">{models.map(m => <button key={m.key} type="button" disabled={busy} aria-current={key === m.key ? 'page' : undefined} onClick={() => { setParams({ tab, model: m.key }); setMessage('') }} className={'w-full rounded-xl px-3 py-3 text-left text-sm ' + (key === m.key ? 'bg-brand text-white' : 'text-ink hover:bg-surface-muted')}><span className="block font-medium">{m.title}</span><span className={'mt-1 block text-xs ' + (key === m.key ? 'text-white/80' : 'text-muted')}>{m.basis === 'exact' ? `${m.quantity_count} норм из источника` : m.status === 'not_created' ? 'Ожидает заполнения' : 'Состав по аналогу'}</span></button>)}</div></aside>
      <section className="min-w-0 space-y-5">{loading ? <p role="status" className="py-10 text-muted">Загружаем техкарту…</p> : card ? <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold text-ink">{selectedModel?.title || card.title}</h2><p className="mt-1 text-xs text-muted">Черновик · версия {card.version} · {card.content.basis === 'exact' ? 'Есть исходная техкарта этой модели' : 'Основа из другой модели, нужен пересчёт'}</p></div>{tab === 'cards' && <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => run(() => downloadFile('production', '/library/models/' + key + '/export', key + '-draft.csv'))}><Download size={16} />Выгрузить</Button>{canEdit && <Button disabled={busy} onClick={save}><Save size={16} />Сохранить</Button>}</div>}</div>
        <HouseConnections modelKey={key} production />
        {tab === 'projects' ? <div className="space-y-4"><p className="text-sm text-muted">Для каждого раздела хранится своя ссылка и редакция. До проверки документ доступен только собственнику.</p><div className="grid gap-4 sm:grid-cols-2">{(['AR', 'KR'] as const).map(kind => { const project = card.content.project_links[kind]; return <article key={kind} className="rounded-2xl border border-border bg-surface p-5"><FileText className="text-brand" size={25} /><h3 className="mt-4 text-lg font-medium">{kind === 'AR' ? 'АР · Архитектурные решения' : 'КР · Конструктивные решения'}</h3><p className="mt-2 text-sm text-muted">{project ? `Редакция: ${project.revision || 'не указана'}` : 'Документ ещё не предоставлен или не открыт для производства.'}</p>{project && <><p className="mt-2 text-xs text-muted">{project.production_safe ? 'Открыт для производства' : 'Только собственнику · нужна проверка'}</p><a className="mt-3 inline-block text-sm font-medium text-brand" target="_blank" rel="noopener noreferrer" href={project.url}>Открыть проект ↗</a></>}{owner && <Button className="mt-4" variant="secondary" onClick={() => setLink({ kind, url: project?.url || '', revision: project?.revision || '', production_safe: project?.production_safe || false })}>{project ? 'Изменить ссылку' : 'Добавить ссылку'}</Button>}</article> })}</div>
          {link && <form className="space-y-4 rounded-2xl border border-border bg-surface p-5" onSubmit={e => { e.preventDefault(); run(async () => { const next = await request<Card>('/models/' + key + '/project-link', { method: 'PUT', body: { ...link, url: link.url.trim() || null, version: card.version } }); if (activeKey.current === key) { applyCard(next); setLink(null); setMessage('Ссылка на проект сохранена.') } }) }}><h3 className="font-medium">{link.kind === 'AR' ? 'Архитектурные решения' : 'Конструктивные решения'}</h3><label className="block text-sm">Ссылка HTTPS<input type="url" className={inputClass + ' mt-1'} value={link.url} onChange={e => setLink({ ...link, url: e.target.value })} placeholder="https://…" /></label><label className="block text-sm">Редакция проекта<input className={inputClass + ' mt-1'} value={link.revision} onChange={e => setLink({ ...link, revision: e.target.value })} /></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={link.production_safe} onChange={e => setLink({ ...link, production_safe: e.target.checked })} />Документ проверен: персональных данных заказчика и коммерческих условий нет. Открыть производству.</label><div className="flex gap-2"><Button disabled={busy} type="submit">Сохранить ссылку</Button><Button variant="ghost" type="button" onClick={() => setLink(null)}>Отмена</Button></div></form>}
        </div> : <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Для проверки, не для выпуска.</strong><ul className="mt-2 list-disc space-y-1 pl-5">{card.content.warnings.map(w => <li key={w}>{w}</li>)}</ul>{card.content.basis_title && <p className="mt-3">Основа: {card.content.basis_title}</p>}</div>
          <details className="rounded-xl border border-border bg-surface p-4"><summary className="text-sm font-medium">Этапы работ · {card.content.operations.length}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">{card.content.operations.map(o => <li key={o.key}>{o.title}{o.hours ? ` · ${o.hours} ч по источнику` : ''}</li>)}</ol></details>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface-muted text-xs text-muted"><tr><th className="p-4">Материал</th><th className="p-4">Ед.</th><th className="min-w-36 p-4">На этот дом</th><th className="p-4">Источник</th></tr></thead><tbody>{card.content.materials.map(m => <tr key={m.key} className="border-b border-border last:border-0"><td className="min-w-48 p-4"><span className="font-medium">{m.title}</span><span className="mt-1 block text-xs text-muted">{stateLabel[m.state] || m.state}</span></td><td className="p-4 text-muted">{m.unit || '—'}</td><td className="p-4">{canEdit ? <input disabled={busy} aria-label={'Количество: ' + m.title} inputMode="decimal" className={inputClass} value={quantities[m.key] ?? ''} onChange={e => setQuantities({ ...quantities, [m.key]: e.target.value })} placeholder="Уточнить" /> : (m.quantity ?? 'Не рассчитано')}</td><td className="p-4 text-xs text-muted">{[...new Set(m.sources.map(s => `№ ${s.recipe_id}, v${s.version}`))].join('; ')}</td></tr>)}</tbody></table>{!card.content.materials.length && <p className="p-6 text-sm text-muted">Материалы исходной серии не найдены. Нужны проект и исходная комплектация.</p>}</div>
          <label className="block text-sm font-medium">Замечания к проверке<textarea className={inputClass + ' mt-2 min-h-24'} disabled={!canEdit || busy} value={notes} maxLength={3000} onChange={e => setNotes(e.target.value)} /></label>
        </>}
      </> : <p className="py-8 text-muted">Заполните недостающие техкарты, чтобы открыть эту модель.</p>}</section>
    </div>}
  </div>
}
