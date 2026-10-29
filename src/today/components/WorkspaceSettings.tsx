import { useEffect, useState } from 'react'
import { useAuthStore } from '@/auth/store'
import { JobRole } from '@/auth/types'
import { apiRequest } from '@/shared/lib/httpClient'
import { SectionId } from '@/shared/sections'

export type WorkspaceView = 'general' | JobRole
export type WorkspaceBlock = 'personal_tasks' | 'my_clients' | 'attention' | 'metrics' | 'aktualnoe' | 'marina' | 'warehouse_links' | 'production_links'
export type DashboardSection = 'clients' | 'production' | 'installation' | 'cycle' | 'warehouse' | 'marketing' | 'tasks' | 'users' | 'accounting' | 'ai'
export interface WorkspacePreferences { view: WorkspaceView; blocks: WorkspaceBlock[]; sections: DashboardSection[] }
const labels: Record<WorkspaceBlock, string> = { personal_tasks: 'Мои задачи', my_clients: 'Мои клиенты', attention: 'Требует внимания', metrics: 'Показатели', aktualnoe: 'Актуальные заказы', marina: 'Марина', warehouse_links: 'Работа склада', production_links: 'Работа производства' }
const sectionLabels: Record<DashboardSection, string> = { clients: 'Клиенты и оплаты', production: 'Производство', installation: 'Монтаж', cycle: 'Заказы', warehouse: 'Склад', marketing: 'Маркетинг', tasks: 'Задачи', users: 'Сотрудники', accounting: 'Бухгалтерия', ai: 'Согласования Марины' }
const allowed: Record<WorkspaceView, WorkspaceBlock[]> = {
  general: ['personal_tasks', 'attention', 'metrics', 'aktualnoe', 'marina'],
  director: ['personal_tasks', 'attention', 'metrics', 'aktualnoe', 'marina'],
  manager: ['personal_tasks', 'my_clients'],
  accountant: ['personal_tasks', 'attention', 'metrics', 'marina'],
  storekeeper: ['personal_tasks', 'warehouse_links', 'attention', 'metrics'],
  production_manager: ['personal_tasks', 'production_links', 'attention', 'metrics'],
}
const viewLabels: Record<WorkspaceView, string> = { general: 'Общий', director: 'Руководитель', manager: 'Менеджер', accountant: 'Бухгалтер', storekeeper: 'Специалист по складу и снабжению', production_manager: 'Начальник производства' }
export function defaults(view: WorkspaceView): WorkspacePreferences {
  return { view, blocks: allowed[view], sections: view === 'accountant' ? ['accounting', 'clients', 'tasks', 'ai'] : view === 'storekeeper' ? ['warehouse', 'accounting', 'tasks'] : view === 'production_manager' ? ['production', 'warehouse', 'tasks'] : Object.keys(sectionLabels) as DashboardSection[] }
}

export function WorkspaceSettings({ userId, jobRole, onApply }: { userId: number; jobRole: JobRole | null; onApply: (value: WorkspacePreferences) => void }) {
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const [draft, setDraft] = useState<WorkspacePreferences>(() => defaults(jobRole ?? 'general'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    apiRequest<WorkspacePreferences | null>({ section: 'auth', path: '/me/workspace' }).then((value) => {
      if (!active) return
      let view: WorkspaceView = jobRole ?? value?.view ?? 'general'
      if (!jobRole && !value) { try { const old = localStorage.getItem(`durov.today.view.${userId}`); if (old === 'director' || old === 'manager') view = old } catch { /* Браузер может не поддерживать хранилище. */ } }
      const settings = value && value.view === view ? value : defaults(view)
      setDraft(settings); onApply(settings); setLoading(false)
    }).catch(() => { if (active) { setError('Не удалось загрузить настройки. Повторите попытку.'); setLoading(false) } })
    return () => { active = false }
  }, [userId, jobRole, reload, onApply])
  const sections = (Object.keys(sectionLabels) as DashboardSection[]).filter((section) => {
    if (draft.view === 'accountant' && !['accounting', 'clients', 'tasks', 'ai'].includes(section)) return false
    if (draft.view === 'storekeeper' && !['warehouse', 'accounting', 'tasks'].includes(section)) return false
    if (draft.view === 'production_manager' && !['production', 'warehouse', 'tasks'].includes(section)) return false
    return hasAccess((section === 'users' ? 'admin' : section) as SectionId)
  })
  const blocks = allowed[draft.view].filter((block) => block === 'personal_tasks' ? hasAccess('tasks') : block === 'my_clients' ? hasAccess('clients') : block === 'marina' ? hasAccess('ai') : block === 'aktualnoe' ? hasAccess('cycle') : block === 'warehouse_links' ? hasAccess('warehouse') : block === 'production_links' ? hasAccess('production') : true)
  function toggle<T extends string>(items: T[], item: T): T[] { return items.includes(item) ? items.filter((value) => value !== item) : [...items, item] }
  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const value = await apiRequest<WorkspacePreferences>({ section: 'auth', path: '/me/workspace', method: 'PUT', body: draft })
      setDraft(value); onApply(value); setSaved(true)
    } catch { setError('Не удалось сохранить настройки. Проверьте подключение и попробуйте снова.') }
    finally { setSaving(false) }
  }
  return <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="workspace-settings-title">
    <h2 id="workspace-settings-title" className="text-[15px] font-semibold text-ink">Настроить рабочий экран</h2>
    <p className="mt-1 text-[12px] text-muted">Настройки сохраняются в вашей учётной записи. Права доступа задаёт администратор.</p>
    <details className="mt-3"><summary className="cursor-pointer text-[13px] font-medium text-brand">Выбрать блоки и направления</summary>
    {loading ? <p role="status" className="mt-3 text-[13px] text-muted">Загружаем настройки…</p> : <>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error} <button type="button" onClick={() => setReload((x) => x + 1)} className="font-medium underline">Повторить загрузку</button></p>}
      {!error && <><p className="mt-4 text-[13px] font-medium text-ink">Экран: {viewLabels[draft.view]}</p>
      {!jobRole && <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Рабочий экран">{(Object.keys(viewLabels) as WorkspaceView[]).map((view) => <button key={view} type="button" aria-pressed={draft.view === view} onClick={() => { setDraft(defaults(view)); setSaved(false) }} className={`rounded-lg border px-3 py-2 text-[13px] ${draft.view === view ? 'border-brand bg-brand text-white' : 'border-border text-ink'}`}>{viewLabels[view]}</button>)}</div>}
      <p className="mt-4 text-[13px] font-medium text-ink">Блоки на главной</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{blocks.map((block) => <label key={block} className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" checked={draft.blocks.includes(block)} onChange={() => { setDraft({ ...draft, blocks: toggle(draft.blocks, block) }); setSaved(false) }} />{labels[block]}</label>)}</div>
      {(draft.blocks.includes('attention') || draft.blocks.includes('metrics')) && <><p className="mt-4 text-[13px] font-medium text-ink">Направления сводки</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">{sections.map((section) => <label key={section} className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" checked={draft.sections.includes(section)} onChange={() => { setDraft({ ...draft, sections: toggle(draft.sections, section) }); setSaved(false) }} />{sectionLabels[section]}</label>)}</div></>}
      <div className="mt-4 flex items-center gap-3"><button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{saving ? 'Сохраняем…' : 'Сохранить настройки'}</button>{saved && <span role="status" className="text-[12px] text-success">Сохранено</span>}</div></>}
    </>}
    </details>
  </section>
}
